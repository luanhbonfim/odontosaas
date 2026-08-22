# 06 — Configurações de Login & Sessão (Vendor Admin)

> **Especificação de uma tela futura do Vendor Admin.**
> Define os parâmetros de **login, sessão, tokens e segurança de acesso** que hoje
> vivem fixos no código/ambiente e que passarão a ser **configuráveis pela interface**
> do painel (sem redeploy). Cada item traz o **valor atual real**, o que significa e a
> proposta de controle na tela.
>
> Público-alvo: operadores do Vendor Admin (schema `public`). As mudanças afetam a
> **plataforma inteira** (todas as clínicas), portanto a tela é restrita a `SuperAdmin`.

---

## 1. 🎯 Objetivo

Uma aba **"Configurações de Login & Sessão"** onde o operador ajusta:
- por quanto tempo uma sessão dura antes de exigir **novo login**;
- de quanto em quanto tempo o token de acesso é **renovado** em segundo plano;
- regras de **proteção contra força bruta** (bloqueio por tentativas);
- **2FA/TOTP** dos operadores;
- validade da **sessão de suporte (impersonate)**;
- limites de **taxa (throttling)** dos endpoints sensíveis.

> Princípio de segurança: alguns parâmetros continuam **somente-ambiente** (`.env`) por
> serem críticos e não devem ser editáveis pela web (ver §8).

---

## 2. ⏱️ Sessão & Tokens JWT

O login gera **dois tokens** (SimpleJWT):

| Token | Papel | Valor atual | Onde vive hoje |
|---|---|---|---|
| **Access** | Autoriza cada requisição. Curto. Renovado sozinho pelo frontend. | **30 minutos** (`ACCESS_TOKEN_LIFETIME`) | `config/settings/base.py` → `SIMPLE_JWT` |
| **Refresh** | Mantém a sessão viva e emite novos access. Define quanto tempo você fica logado. | **24 horas** (`REFRESH_TOKEN_LIFETIME`) | idem |
| **Rotação de refresh** | Trocar o refresh a cada uso (invalida o anterior). | **Desligada** (`ROTATE_REFRESH_TOKENS` não definido → `False`; blacklist off) | idem |

### Como funciona na prática (exemplo)
1. Operador faz login às **09:00** → recebe access (vale até 09:30) + refresh (vale até o dia seguinte 09:00).
2. Durante o uso, a cada ~30 min o frontend **renova o access silenciosamente** usando o refresh — o operador **não percebe**, continua trabalhando.
3. Após **24h** (o refresh expira), a renovação falha → o painel **desloga** e pede **login novamente**.
4. Fechar a aba/navegador não desloga na hora (o refresh fica salvo); o que encerra é a **expiração de 24h** ou o **logout manual**.

### Proposta de configuração na tela
- **Duração da sessão** (refresh): ex. 8h / 12h / 24h / 7 dias. *(Recomendado p/ painel de admin: 8–24h.)*
- **Intervalo de renovação** (access): ex. 15 / 30 / 60 min. *(Menor = mais seguro se um access vazar; maior = menos requisições de refresh.)*
- **Rotação de refresh** (liga/desliga): ligar aumenta a segurança (um refresh roubado é invalidado no próximo uso) — exige habilitar a blacklist do SimpleJWT.
- **"Deslogar ao fechar o navegador"** (opção): guardar o refresh só em `sessionStorage` em vez de `localStorage`.

> ⚠️ Nota: hoje o access token do **impersonate** dura 1h fixo (§5), independente destes valores.

---

## 3. 🔒 Proteção contra Força Bruta (lockout)

Bloqueio por **IP de origem** no cache (Redis), separado para clínica e para o painel.

| Parâmetro | Valor atual | Onde |
|---|---|---|
| Tentativas antes de bloquear (clínica) | **5** (`LOGIN_FALHAS_MAX`) | `apps/usuarios/views.py` |
| Janela de bloqueio (clínica) | **15 min** (`LOGIN_BLOQUEIO_SEGUNDOS`) | idem |
| Tentativas antes de bloquear (painel/vendor) | **5** (`VENDOR_LOGIN_FALHAS_MAX`) | `apps/plataforma_admin/views.py` |
| Janela de bloqueio (painel/vendor) | **15 min** (`VENDOR_LOGIN_BLOQUEIO_SEGUNDOS`) | idem |

- Ao estourar o limite, o login responde **HTTP 429 (Too Many Requests)** e orienta a esperar.
- O IP real vem do **último hop do `X-Forwarded-For`** (atrás do Caddy), à prova de spoofing.

### Proposta de configuração
- **Máx. de tentativas** (ex. 3–10) e **tempo de bloqueio** (ex. 5–60 min), separadamente para clínica e painel.

---

## 4. 🔑 2FA / TOTP dos Operadores

Segundo fator obrigatório da spec §2.2 (código de 6 dígitos de app autenticador).

| Item | Estado atual |
|---|---|
| Segredo TOTP | `plataforma_admin.OperadorMFA` (schema `public`, por e-mail) |
| Padrão | **Desligado** por operador (sem registro = 2FA off) |
| Ativação/Reset | comando `python manage.py vendor_2fa --email <op> [--disable]` |
| Verificação | no `VendorLoginView`; login retorna `mfa_required` quando falta o código |

### Proposta de configuração na tela
- **Ativar/desativar 2FA por operador**, com **enrollment via QR** direto no painel (hoje só via CLI).
- **Exigir 2FA de todos os operadores** (política global; bloqueia login sem 2FA configurado).
- **Códigos de recuperação** (backup codes) para não depender só do celular.

---

## 5. 🛟 Sessão de Suporte (Impersonate)

Acesso temporário do operador à conta de uma clínica.

| Parâmetro | Valor atual | Onde |
|---|---|---|
| Validade do token de suporte | **1 hora** fixo | `apps/plataforma_admin/services.py` (`gerar_token_impersonate`) |
| Modo padrão | **Somente-leitura** (`read_only=True`) — mutações bloqueadas por middleware | idem / `config/middleware.py` |
| Revogação antecipada | via "Encerrar Suporte" (grava flag no Redis; token deixa de valer) | `apps/usuarios/views.py` |
| Sessões simultâneas | bloqueio de múltiplas sessões ativas para a mesma clínica | `services.py` |

### Proposta de configuração
- **Validade da sessão de suporte** (ex. 15 / 30 / 60 min).
- **Modo padrão** (Somente-leitura vs Completo) — sabendo que Completo é só SuperAdmin.
- **Exigir justificativa** (já obrigatório) e tamanho mínimo.

---

## 6. 🚦 Limites de Taxa (Throttling)

Rate-limit por escopo nos endpoints sensíveis (por operador/IP).

| Escopo | Valor atual | Env |
|---|---|---|
| Login do painel | **30/min** | `THROTTLE_VENDOR_LOGIN` |
| Impersonate | **30/min** | `THROTTLE_IMPERSONATE` |
| Database Studio | **60/min** | `THROTTLE_STUDIO` |

### Proposta de configuração
- Ajuste dos três limites (com pisos/tetos sensatos). Excedeu → **429**.

---

## 7. 🕵️ Ocultação do Painel (contexto)

Não é "login", mas é acesso — documentado aqui para visão completa:
- **Subdomínio dedicado** do painel (`VENDOR_ADMIN_HOST`) mapeado ao schema `public`.
- **Path secreto** embutido no build (`VENDOR_ADMIN_SECRET_PATH`, ex. `/painel-x7k2`).
- Fora desse host, `/api/plataforma-admin/*` responde **404** (camuflagem).
- Estes ficam em **`.env`/build** (não editáveis pela web — mudar exige rebuild/DNS).

---

## 8. 🗄️ Modelo de Dados & Arquitetura (proposta)

- Criar um **singleton** `plataforma_admin.ConfiguracaoLoginVendor` no schema `public`
  com os campos configuráveis (durações, lockout, throttling, política de 2FA, validade
  de impersonate).
- No boot/uso, o `SIMPLE_JWT` e os throttles passam a **ler desse registro** (com fallback
  para os defaults de `settings`), à semelhança do que já foi feito com o Celery Beat
  (migrado de `settings` para o banco).
- Endpoints: `GET/PATCH /api/plataforma-admin/config-login/` (RBAC **`IsVendorSuperAdmin`**),
  com auditoria (`RegistroAuditoriaVendor` ação `PARAMETRIZACAO`).
- **Validação estrita** de faixas (ex.: sessão entre 15 min e 30 dias; tentativas entre 3 e 20).

### Somente-ambiente (NÃO expor na web — segurança)
`DJANGO_SECRET_KEY`, `FIELD_ENCRYPTION_KEY`, `STUDIO_RO_PASSWORD`, `MASTER_ADMIN_PASSWORD`,
`WAHA_WEBHOOK_TOKEN`, `VENDOR_ADMIN_HOST`, `VENDOR_ADMIN_SECRET_PATH`.

---

## 9. 🎨 UI (proposta, seguindo o Design System)

Aba "Configurações" no menu do Vendor Admin, em seções (cards `FormKit`):
1. **Sessão & Tokens** — duração da sessão, intervalo de renovação, rotação, deslogar ao fechar.
2. **Proteção de Login** — tentativas + tempo de bloqueio (clínica e painel).
3. **2FA** — política global, gestão por operador, códigos de recuperação.
4. **Suporte (Impersonate)** — validade, modo padrão.
5. **Rate-limit** — os três limites.
Cada seção com botão **Salvar** próprio, toast de confirmação e registro em auditoria.

---

## 10. 🧾 Exemplos de Cenários (para a tela explicar ao operador)

- *"Sessão de 24h + renovação de 30 min"*: você loga uma vez e trabalha o dia; depois de 24h, novo login.
- *"Sessão de 8h"*: bom para turnos; força novo login a cada expediente.
- *"3 tentativas / 30 min"*: mais rígido contra força bruta (a clínica/painel trava mais rápido).
- *"2FA obrigatório para todos"*: nenhum operador entra sem app autenticador configurado.
- *"Impersonate de 15 min, somente-leitura"*: janelas de suporte curtas e seguras.

---

## 11. ✅ Backlog de implementação (futuro)

- [ ] Model `ConfiguracaoLoginVendor` (public) + migração de seed com os defaults atuais.
- [ ] Leitura dinâmica de `SIMPLE_JWT`/throttles/lockout a partir do banco (fallback settings).
- [ ] Endpoints `GET/PATCH /api/plataforma-admin/config-login/` (SuperAdmin + auditoria + validação de faixas).
- [ ] Enrollment de 2FA por QR na tela (hoje só CLI) + política global + backup codes.
- [ ] Tela "Configurações de Login & Sessão" (5 seções, FormKit, Dark Navy & Dourado).
- [ ] Testes: durabilidade pós-restart, faixas inválidas rejeitadas, efeito real no login/expiração.

---

*Documento de especificação. Valores "atuais" conferidos contra o código real em 2026-08-22 (`SIMPLE_JWT`, lockout, throttling, impersonate, `OperadorMFA`).*
