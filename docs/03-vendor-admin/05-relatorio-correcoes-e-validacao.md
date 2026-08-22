# 🛠️ Relatório de Correções Aplicadas e Validação Final — Vendor Admin

**Data:** 21 de Agosto de 2026
**Perfil:** Lead Software Architect / Principal Fullstack & DevOps Engineer
**Escopo:** Auditoria de impacto e **correção direta** do ecossistema Vendor Admin (V1–V9 + hardening), com base nos 4 documentos de `docs/03-vendor-admin/`.
**Método:** Leitura integral dos documentos → auditoria do código real (5 frentes paralelas) → verificação manual de cada achado → correção no código → execução das suítes automatizadas.

---

## 1. 📌 Resumo da Intervenção

Foram **auditados** todos os módulos afetados (backend: middlewares, `apps/core/handlers.py`, autenticação JWT multi-tenant, `apps/plataforma_admin/*`, tasks Celery, inbound WAHA; frontend: `vendor-admin/*`, clientes Axios, `App.tsx`). A maioria das 18 correções (VULN-01→18) descritas em `04-relatorio-auditoria-seguranca-devops.md` foi **confirmada como corretamente implementada**. Além disso, foram **encontrados e corrigidos 12 defeitos reais** que os documentos não cobriam — incluindo **1 CRÍTICO** de escalonamento de privilégio cross-tenant e **1 ALTO** de credencial padrão.

**Arquivos de código modificados (13):**

| # | Arquivo | Natureza |
|---|---|---|
| 1 | `apps/plataforma_admin/views.py` | Login vendor exige `is_superuser`; CRUD de planos → SuperAdmin |
| 2 | `apps/usuarios/authentication.py` | Operador exige `is_superuser`; `operator_schema` autoritativo |
| 3 | `apps/plataforma_admin/services.py` | `MASTER_ADMIN_PASSWORD` sem default em produção |
| 4 | `apps/plataforma_admin/studio.py` | Anti-bypass do blocklist (comentários/stacked); gate de senha correto |
| 5 | `apps/plataforma_admin/serializers.py` | `justificativa` no `AlternarStatusTenantInputSerializer` |
| 6 | `apps/core/handlers.py` | Redação de JWT cru / segredos sem aspas; `X-Tenant-Id` só para staff |
| 7 | `apps/notificacoes/views.py` | Webhook WAHA resiliente a `payload:null` / corpo malformado |
| 8 | `apps/notificacoes/tasks.py` | Isolamento do gate por-tenant; gate de módulo no cancelamento |
| 9 | `apps/integracoes/tasks.py` | Isolamento do gate/domínio por-tenant dentro do `try` |
| 10 | `frontend/src/lib/api/token-store.ts` | Guard estrito de JWT (`length !== 3`) |
| 11 | `frontend/src/features/vendor-admin/use-vendor-auth.ts` | Guard estrito de JWT (`length !== 3`) |
| 12 | `deploy/.env.prod.example` | Documenta `MASTER_ADMIN_EMAIL/PASSWORD` |
| 13 | `tests/test_plataforma_admin_v2.py` | Teste de login vendor realinhado à regra segura |

**Estabilidade atual:** backend **357/357** testes-alvo verdes após correção (a rodada completa acusou 3 falhas causadas por um gate de senha meu — corrigidas); frontend **210/210** verdes; `tsc` limpo.

---

## 2. 🔧 Falhas Encontradas e Correções Aplicadas

### 🔴 CRÍTICA — Escalonamento de privilégio cross-tenant: admin de clínica assumia o Vendor Admin
- **Arquivos:** `apps/plataforma_admin/views.py:893` (loop de login), `apps/usuarios/authentication.py:42-65` (resolução no host público).
- **Problema:** o login do vendor e a autenticação no schema `public` aceitavam qualquer usuário com `is_staff OR is_superuser`. O admin de cada clínica é provisionado com `is_staff=True` (`services.py`), enquanto o operador legítimo (Master) é `is_superuser=True`. Logo, **o administrador de uma clínica podia logar em `POST /api/plataforma-admin/auth/login/` com suas próprias credenciais e obter um token de operador da plataforma** — listando todas as clínicas, gerando *impersonate* de qualquer tenant, resetando senha de admin e usando o Database Studio. Contradiz diretamente a spec §2.2 (operadores = `is_superuser` no schema `public`).
- **Correção:** o login e ambos os caminhos de resolução do `MultiTenantJWTAuthentication` passam a exigir **`is_superuser`**. Admins de clínica (`is_staff`, sem superuser) são recusados; apenas o operador Master global (superuser) opera o painel. O teste que codificava o comportamento inseguro (`test_vendor_login_view_sucesso_no_host_publico`) foi realinhado: agora prova que o operador superuser entra (200) **e** que o admin da clínica é bloqueado (401).
- **Nota de produto:** o papel "SUPORTE_L2" (operador `is_staff` sem superuser) previsto na spec **não é seguro no modelo atual** (não há tabela/flag de operador separada; `is_staff` é compartilhado com admins de clínica). Enquanto não existir um marcador dedicado de operador, apenas superusuários devem operar o painel.

### 🟠 ALTA — Credencial Master padrão hardcoded (`ProClinica@2026`) com SuperAdmin em todos os schemas
- **Arquivo:** `apps/plataforma_admin/services.py:151`.
- **Problema:** o provisionamento semeava `admin@proclinica.com.br` / `ProClinica@2026` como `is_superuser=True` em **todos** os tenants. Como essa conta é operador do vendor (após a correção acima, superuser), a senha padrão conhecida seria uma credencial de **Vendor SuperAdmin** em qualquer instalação que não sobrescrevesse o valor.
- **Correção:** a senha passa a ser lida de `settings`/ambiente (`MASTER_ADMIN_PASSWORD`) e é **obrigatória em produção** (`config.settings.prod` → levanta `RuntimeError` se ausente); o default só sobrevive fora de produção. Documentado em `deploy/.env.prod.example`.
- **Ação operacional recomendada:** definir `MASTER_ADMIN_PASSWORD` forte no `.env` de produção e **rotacionar** a senha do Master já semeado (tela *Acesso Master Global* → `POST /api/plataforma-admin/master-admin/`), pois o default pode já estar em uso nos tenants existentes.

### 🟠 MÉDIA — Database Studio: blocklist contornável por comentários e múltiplas instruções (RW)
- **Arquivo:** `apps/plataforma_admin/studio.py`.
- **Problema:** o `COMANDOS_PROIBIDOS_REGEX` juntava palavras-chave com `\s+`, que casa apenas espaços — não comentários. Em modo RW (SuperAdmin, conexão como usuário dono do banco), `COPY/**/(SELECT..)TO/**/PROGRAM 'cmd'` ou `DROP/**/TABLE x` passavam pela blacklist; múltiplas instruções empilhadas (`;`) também eram aceitas.
- **Correção:** antes de checar a blacklist, o SQL é **normalizado removendo comentários** (`/* */` e `-- ...`) e **instruções empilhadas são rejeitadas** (qualquer `;` interno). A checagem de comandos proibidos roda sobre o texto sem comentários. (O modo RO continua protegido também pelo privilégio do role `odonto_studio_ro`.)

### 🟠 MÉDIA — Sanitização de logs incompleta (`apps/core/handlers.py`)
- **Problema 1 (JWT cru):** o padrão exigia prefixo `Bearer `; um token nu (`eyJ...`) embutido em mensagens do SimpleJWT/PyJWT era gravado em claro no `RegistroErroOperacional`.
- **Problema 2 (segredos sem aspas):** o padrão de chaves sensíveis exigia aspas ao redor do valor; `password=hunter2`, `token=abc` e query strings `?token=...` vazavam.
- **Correção:** adicionado padrão de JWT independente de prefixo (`eyJ...`) e o padrão de chaves passou a redigir valores **com ou sem aspas**.

### 🟠 MÉDIA — `operator_schema` não-autoritativo permitia homônimo de mesmo PK
- **Arquivo:** `apps/usuarios/authentication.py:42-65`.
- **Problema:** com `operator_schema` presente, se o operador existisse ali porém sem privilégio/inativo, o código **caía na varredura** de outros tenants e podia autenticar um usuário de **mesmo PK** que fosse staff em outra clínica (bypass de de-privilégio).
- **Correção:** quando `operator_schema` está presente, ele é **autoritativo** — recusa imediatamente operador sem privilégio/inativo; a varredura legada só ocorre quando o usuário realmente não existe naquele schema. (Combinado à correção crítica, ambos exigem `is_superuser`.)

### 🟠 MÉDIA — Webhook WAHA derrubava com 500 em `payload:null`
- **Arquivo:** `apps/notificacoes/views.py:268`.
- **Problema:** `data.get("payload", {})` retorna `None` quando o corpo traz `"payload": null`; `None.get("fromMe")` levantava `AttributeError` → 500, e o WAHA (ou um atacante no endpoint público `@csrf_exempt`) provocava *retry storms* de 500.
- **Correção:** normalização (`data.get("payload") or {}` + checagem de tipo) e `try/except` amplo que **sempre responde 200**, registrando falhas via `logger.exception`.

### 🟡 MÉDIA/BAIXA — `X-Tenant-Id` permitia envenenamento do painel de erros
- **Arquivo:** `apps/core/handlers.py:57`.
- **Problema:** no host público, um chamador **anônimo** podia enviar `X-Tenant-Id: <schema_de_outra_clínica>` e atribuir ruído de erro ao painel daquela clínica (o header já era validado contra injeção e existência, mas não contra autorização).
- **Correção:** o header só é honrado quando o requisitante é **operador autenticado** (`is_staff`/`is_superuser`).

### 🟡 MÉDIA/BAIXA — Isolamento por-tenant incompleto nas rotinas Celery
- **Arquivos:** `apps/notificacoes/tasks.py:450`, `apps/integracoes/tasks.py:91/133/178`.
- **Problema:** o gate `recurso_habilitado(...)` (e, no `renovar_watch_channels`, a resolução de domínio) ficava **fora** do `try/except` por-tenant. Um erro ao resolvê-los abortaria toda a varredura do Beat, anulando o isolamento pretendido (VULN-06).
- **Correção:** gate e lookup de domínio movidos para **dentro** do `try` (o `finally: close_old_connections()` sempre roda).

### 🟢 BAIXA — Correções de consistência
- **Planos → SuperAdmin** (`views.py`): mutações de `PlanoAssinatura` (create/update/destroy) agora exigem `IsVendorSuperAdmin` (spec §2.2); leitura permanece staff.
- **`justificativa` auditável** (`serializers.py`): `AlternarStatusTenantInputSerializer` passou a declarar o campo `justificativa`, que a auditoria de bloqueio/desbloqueio já lia (antes gravava sempre vazio).
- **Cancelamento respeita módulo** (`tasks.py`): `enviar_cancelamento_task` agora pula clínicas com WhatsApp desativado (EXTRA-V7.25).
- **`STUDIO_RO_PASSWORD` de fato exigido em produção** (`studio.py`): o gate antigo dependia de uma variável `ENVIRONMENT` inexistente e **nunca** disparava; agora exige a senha sob `config.settings.prod`.
- **Guard de JWT no frontend** (`token-store.ts`, `use-vendor-auth.ts`): validação estrita de 3 segmentos, conforme a spec de VULN-17.

---

## 3. 🧪 Resultados da Validação Automatizada

> **Nota metodológica importante:** o `pytest-django` força `settings.DEBUG=False` durante os testes. Por isso os gates de "obrigatório em produção" **não podem** depender de `DEBUG` (quebrariam a suíte) — foram ancorados no módulo de settings de produção (`config.settings.prod`), que o pytest não sobrescreve.

- **Backend (pytest, no container `odonto_web`):**
  - Rodada completa do repositório: **354 passed / 3 failed** (as 3 falhas foram causadas por gate de senha meu keyed em `DEBUG`; **corrigidas** e revalidadas → **357/357** no alvo).
  - Suíte vendor+auth+segurança revalidada verde após as correções finais.
  - `test_action_provisionamento_completo`, `test_studio_executar_select_read_only`, `test_studio_read_only_bloqueia_mutacoes_no_banco`: **PASS** após o fix do gate.
- **Frontend (Vitest):** **210 passed / 48 arquivos** (100% verdes).
- **TypeScript (`tsc -b`):** **0 erros**.
- **Lint (ruff):** as correções aplicadas **não adicionam** erros de lint. Observação: o repositório já possuía ~39 achados pré-existentes (`I001`/`E402` por imports locais em funções e `UP038`) — cosméticos, não corrigidos aqui para evitar churn amplo em código de terceiros.

---

## 4. 🚦 Parecer de Prontidão Operacional

- [x] **Ambiente de Desenvolvimento Local:** **Estável e Seguro** — suítes verdes (backend alvo + frontend), typecheck limpo, escalonamento crítico fechado.
- [ ] **Prontidão para Deploy na VPS:** **LIBERADO COM CONDIÇÕES OBRIGATÓRIAS:**
  1. Definir no `.env` de produção: **`MASTER_ADMIN_PASSWORD`** (forte) e **`STUDIO_RO_PASSWORD`** (forte) — sem eles o provisionamento/Studio falham de propósito (fail-closed).
  2. **Rotacionar** a senha do Master já semeado nos tenants existentes (tela *Acesso Master Global*), pois o default `ProClinica@2026` pode estar em uso.
  3. Rodar a suíte completa de backend no container antes do deploy (os middlewares de tenant/impersonate são globais).

### Recomendações não-bloqueantes (não corrigidas — registradas para decisão)
- **RBAC de operador dedicado:** substituir o uso de `is_staff` como marca de operador por uma tabela/flag própria de operador do vendor, para reabilitar com segurança o papel SUPORTE_L2.
- **Celery Beat (partial_update/disparar):** hoje sob `IsVendorStaff` (coberto por testes que usam operador staff). Se o princípio "RW = SuperAdmin" for adotado, mover para `IsVendorSuperAdmin` (exigirá ajustar os testes V5).
- **Studio RO — leak entre schemas:** `GRANT SELECT ON ALL TABLES` persiste por schema; com nomes qualificados (`schema.tabela`) um operador pode ler schemas previamente consultados. Read-only e operator-only, mas quebra o isolamento estrito por-query — avaliar `REVOKE`/roles por-schema.
- **Backup do expurgo:** validar não-vacuidade do `pg_dump` (o `-n <schema>` sai 0 mesmo para schema inexistente).
- **Endpoint `EncerrarSuporteTenantView` (`AllowAny`):** permite a um chamador não autenticado disparar a flag (fail-safe) de revogação de suporte do schema atual — nuisance/DoS leve; considerar exigir token.
- **Débito de lint pré-existente (~39):** organizar imports locais / `isinstance` (`ruff --fix`) numa passada dedicada.

---

## 5. 🔁 Rodada 2 de Validação (alterações posteriores no Vendor Admin)

Após novas alterações no código (EXTRA-V9.03 → V9.06), foi feita **nova auditoria**. Arquivos revisados: `apps/plataforma_admin/{serializers,celery_manager,urls}.py`, `frontend/src/features/vendor-admin/vendor-token-store.ts`, `frontend/src/App.tsx` (`SessaoWatcher`).

### 🟠 REGRESSÃO encontrada e corrigida — `MultiTenantJWTAuthentication` afrouxado para `is_staff`
- **Arquivo:** `apps/usuarios/authentication.py` (bloco `operator_schema` e fallback).
- **Problema:** a EXTRA-V9.05 reverteu o gate de operador no host público de `is_superuser` para `is_staff OR is_superuser` — desfazendo a correção CRÍTICA da rodada 1 e ficando **mais permissivo que o `VendorLoginView`** (que permanece `is_superuser`) e em contradição com os próprios comentários do método e a spec §2.2. Não é diretamente explorável hoje (o login só emite token de schema `public` para superusuário), mas é uma **regressão de defesa-em-profundidade**: qualquer futuro caminho que emitisse um token `public` para um `is_staff` seria aceito.
- **Correção:** restaurado `is_superuser` nos dois pontos. Como **todo** token de schema `public` é emitido apenas para superusuários pelo login, a mudança **não bloqueia nenhum operador legítimo** — confirmado pela suíte (a alegação da V9.05 de que "superuser-only quebrava o dashboard" era um diagnóstico incorreto; o fix real do F5 foi a persistência de token em `vendor-token-store.ts`).

### ✅ Alterações revisadas e aprovadas (sem falhas)
- `celery_manager.py` (V9.06): `DESCRICOES_PADRAO` + `garantir_tarefas_padrao_no_banco()` idempotente + `obter_status_celery()` enriquecido — correto.
- `serializers.py` (V9.04/V9.06): `PeriodicTaskListSerializer` com todos os getters de `interval`/`crontab` protegidos contra `None` — sem risco de crash. Campos `justificativa` adicionais mantêm a auditoria.
- `urls.py`: rotas do `CeleryTarefasViewSet`/`StudioViewSet`/login coerentes.
- `App.tsx` `SessaoWatcher` (V9.03): mantém os dois listeners (`sessao-expirada` + `vendor-sessao-expirada`) com `queryClient.clear()`; o guard de `/plataforma-admin` só evita que um evento de *tenant* expulse o operador — não desativa o logout do tenant.

### 🟡 Observação (não-bloqueante)
- **`vendor-token-store.ts` (V9.05):** o `access_token` passou a ser persistido em `localStorage` (além de `sessionStorage`). Resolve o F5, mas aumenta levemente a superfície a XSS (o `refresh` já ficava em `localStorage`). Aceitável; se quiser endurecer, manter o `access` só em memória/`sessionStorage`.

### 🧪 Revalidação (rodada 2)
- Backend (vendor V1–V9 + `auth_jwt` + `auth_me` + `seguranca_audit`): **88 passed**, exit 0.
- Frontend (`vendor-admin/`): **24 passed**, exit 0.
- `ruff apps/usuarios/authentication.py`: **All checks passed!**

---

## 6. 🔴 Rodada 3 — Teste Adversarial ("tente quebrar") + Parecer de Produção

Método: 3 agentes red-team independentes atacando (auth/RBAC/impersonate; Database Studio/expurgo; endpoints públicos/tasks/config de prod) + probes dinâmicos executados contra o stack real.

### ✅ Ataques que FALHARAM (defesas sólidas — confirmado)
Admin de clínica / usuário comum → acesso vendor: **bloqueado**. Replay de token cross-tenant: **bloqueado**. Impersonate read-only + revogação (inclusive via refresh): **mantém**. Studio RO é realmente somente-leitura; bypass da blacklist por comentários `/**/`, statements empilhados, `DO $$`, `COPY … PROGRAM`, `RESET/SET search_path`, case/unicode: **todos rejeitados**. Expurgo só dropa após `pg_dump` bem-sucedido. Webhook com corpo malformado (`payload:null`): **200, sem crash**. Vazamento em erro 500 em produção: **nenhum**. ReDoS no sanitizador: **nenhum** (100k chars em 13ms). Envenenamento de `X-Tenant-Id`: **bloqueado**. IDOR no link de confirmação: **inviável** (UUID 122-bit).

### 🔧 Corrigido nesta rodada
- 🔴 **H3 — Segredos fail-closed em produção:** `config/settings/prod.py` agora **recusa subir** se `DJANGO_SECRET_KEY` ou `FIELD_ENCRYPTION_KEY` estiverem ausentes/no default de dev (antes: defaults commitados → forja de JWT + tokens Google decifráveis).
- 🟠 **F1 — `EncerrarSuporteTenantView`:** era `AllowAny` e decodificava o JWT **sem verificar assinatura** → anônimo encerrava sessões de suporte de qualquer clínica e forjava a auditoria (inclusive cross-tenant). Agora exige autenticação e deriva schema/operador do contexto **já validado**. Regressão determinística: `test_v9_5b_encerrar_suporte_exige_autenticacao`.
- 🟠 **Gate de produção robusto:** `"prod" in SETTINGS_MODULE` (pega `production`, `prod_gcp`) em `studio.py` e `services.py`.
- 🟡 **Studio — falso-positivo:** `;` dentro de literal de string (`SELECT 'a;b'`) não é mais barrado como "múltiplas instruções" (blacklist segue sobre o SQL completo).

### 🔧 Corrigido — H1 (webhook WAHA) [rodada 4 — "configurar para produção"]
- 🔴 **H1 — Webhook WAHA agora autenticado por segredo compartilhado.** `POST /notificacoes/whatsapp/webhook` (público via Caddy) passou a exigir `WAHA_WEBHOOK_TOKEN` (em `?token=` ou header `X-Webhook-Token`, comparação constant-time). **Design atômico, sem janela de mismatch:** a MESMA variável `WAHA_WEBHOOK_TOKEN` do `.env` (a) alimenta a `WHATSAPP_HOOK_URL` do container WAHA via interpolação no `docker-compose.prod.yml` (`...webhook?token=${WAHA_WEBHOOK_TOKEN}`) e (b) é verificada pelo Django. Quando o token está vazio (dev/piloto), a verificação é ignorada — retrocompatível, não quebra o piloto até o cutover. Documentado em `deploy/.env.prod.example`. Teste: `test_webhook_exige_token_quando_configurado`.
  - **H2 mitigado por consequência:** com o webhook autenticado, um anônimo não alcança mais `schema_da_sessao` (401 antes), eliminando o vetor de amplificação O(N) via sessões forjadas.
  - *Observação de topologia:* o schema continua vindo do corpo `session` (o WAHA chama um endpoint único interno, sem host por-tenant), por isso a defesa correta é o segredo — não binding por host.

### 🚧 Hardening NÃO corrigido (exige decisão/ação de ops)
- 🟠 **Studio RW é denylist** (SuperAdmin pode `DELETE FROM public...` / cross-schema via nomes qualificados; auditoria grava `schema_alvo` enganoso). Abuso por operador de confiança, mas quebra o isolamento anunciado → migrar para allowlist / bloquear referências fora do schema-alvo.
- 🟠 **Senha Master default (`ProClinica@2026`)** ainda vale em dev/staging (só falha-fechado em módulo `*prod*`).
- 🟡 Sem throttling DRF (login/impersonate/studio/webhook); lockout de login confia em `X-Forwarded-For` (spoofável atrás do Caddy); Swagger/ReDoc públicos em prod; senha efêmera do RO stompa entre workers; fallback de operador por PK (homônimo) em token legado/conta deletada (F3).

### 🧪 Validação final (rodada 3)
- **Backend — suíte COMPLETA (limpa, nada concorrente): `358 passed`, exit 0.**
- **Frontend: `210 passed` (48 arquivos); `vendor-admin` `24 passed`; `tsc -b` limpo.**
- `makemigrations --check`: **No changes detected** (sem migração faltando).
- *(a rodada intermediária que acusou "124 failed" foi contaminação por execuções pytest concorrentes no mesmo Postgres — não regressão.)*

### 🚦 Parecer de Prontidão para Produção
Os dois bloqueadores (H1 webhook e H3 segredos) foram **fechados no código/config**. O que resta para o deploy é **operacional** (definir os valores dos segredos no servidor — o código já os exige):

**Checklist obrigatório de deploy (o operador executa na VPS):**
1. No `.env` de produção, gerar/definir todos os segredos (o código agora falha-fechado sem eles):
   - `DJANGO_SECRET_KEY` → `python -c "import secrets;print(secrets.token_urlsafe(64))"`
   - `FIELD_ENCRYPTION_KEY` → `python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"`
   - `STUDIO_RO_PASSWORD`, `MASTER_ADMIN_PASSWORD` → `openssl rand -base64 32`
   - `WAHA_WEBHOOK_TOKEN` → `openssl rand -hex 32`  *(NÃO definir `WHATSAPP_HOOK_URL` — o compose monta a URL com o token)*
2. **Rotacionar** o que já foi semeado com defaults: a senha Master (`ProClinica@2026`) via tela *Acesso Master Global*, e — como a chave Fernet default é pública — **reconectar as contas Google** após trocar `FIELD_ENCRYPTION_KEY` (tokens antigos ficam ilegíveis com a chave nova).
3. `docker compose -f docker-compose.prod.yml up -d --build` e rodar as migrações. O WAHA recria com a hook URL contendo o token.

**Hardening adicional implementado (rodada 5):**
- **Throttling (rate-limit)** por-escopo nos endpoints sensíveis: login do vendor (`30/min`), impersonate (`30/min`) e Database Studio (`60/min`) — taxas configuráveis por env (`THROTTLE_*`). `apps/core/throttling.py`.
- **IP real no lockout**: `_ip_cliente`/`_vendor_ip_cliente` passam a usar o ÚLTIMO hop do `X-Forwarded-For` (o que o Caddy anexa) em vez do primeiro (spoofável) + `NUM_PROXIES=1` em prod para o DRF resolver o IP do throttle.
- **Swagger/ReDoc restritos a staff em produção** (`SERVE_PERMISSIONS = IsAdminUser` em `prod.py`).
- Testes: `test_ip_cliente_usa_ultimo_hop_do_xff`, `test_throttle_bloqueia_apos_limite`, `test_views_sensiveis_tem_throttle_configurado`.

**Ainda recomendado (não bloqueia):** migrar o Studio RW de denylist para allowlist (abuso por SuperAdmin de confiança); provisionar a role `odonto_studio_ro` por ops (não via app).

## 7. 🕵️ Painel Vendor "escondido" (rodada 6)

Objetivo: deixar o painel acessível só num host/rota não óbvios, sem depender de obscuridade para a segurança real (auth superuser + throttling + camuflagem 404 já cobrem isso).

- **Path secreto no build**: `VITE_VENDOR_ADMIN_SECRET_PATH` embutido no bundle via build-arg (`deploy/edge.Dockerfile` + `docker-compose.prod.yml`), alimentado por `VENDOR_ADMIN_SECRET_PATH` no `.env`. Default `/plataforma-admin`.
- **Subdomínio dedicado → schema public**: `VENDOR_ADMIN_HOST` (não óbvio) mapeado ao schema `public` pelo comando `bootstrap_vendor`. Deve constar também em `SITE_ADDRESS` (Caddy serve o SPA + `/api`). Em subdomínio de clínica, `/api/plataforma-admin/*` continua dando **404** (camuflagem por `IsVendorHost`).
- **Comando `bootstrap_vendor`** (`apps/plataforma_admin/management/commands/`): idempotente — mapeia o host do painel → public, cria um plano padrão e (opcional) provisiona a **primeira clínica**, que semeia o operador **Master** (`is_superuser`) e habilita o login. Da 2ª clínica em diante, tudo pelo painel.
- **Nota de arquitetura**: `apps.usuarios` é TENANT-only (não há tabela `Usuario` no `public`), então o operador **vive no schema de um tenant** (o Master é replicado). Por isso a 1ª clínica precisa ser provisionada por CLI (`bootstrap_vendor`) — não há como logar no painel antes de existir um operador.
- **Residual (defesa em profundidade)**: o certificado do subdomínio secreto aparece nos CT logs (HTTP-01). Para ocultá-lo de verdade, usar wildcard DNS-01 no Caddy — melhoria de infra futura.
- Teste: `tests/test_bootstrap_vendor.py` (bootstrap → Master semeado → login no painel OK).

**Veredito:** com o checklist de segredos aplicado, **liberado para produção**. Sem os segredos, o sistema recusa subir (fail-closed) — proteção intencional, não um bug.
