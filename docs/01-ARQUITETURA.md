# OdontoSaaS — Documentação de Arquitetura

> Documento vivo. Fonte de verdade da estratégia técnica do sistema multi-tenant para clínicas de Odontologia.
> Stack decidida: **Django 5.x + PostgreSQL 16 + django-tenants (schema-per-tenant) + Celery/Redis/Beat + WAHA (WhatsApp HTTP API)**.

---

## 1. Visão Geral

O OdontoSaaS é uma plataforma **SaaS multi-tenant** onde cada clínica odontológica é um *tenant* isolado.
A aplicação Django serve todas as clínicas a partir de uma única base de código, roteando cada
requisição para o **schema** PostgreSQL correto com base no subdomínio (ex.: `clinicasorriso.odonto.app`).

```
                                   ┌─────────────────────────────┐
                                   │        Load Balancer         │
                                   │   *.odonto.app (wildcard)    │
                                   └──────────────┬──────────────┘
                                                  │
                        ┌─────────────────────────┼─────────────────────────┐
                        │                          │                         │
                 ┌──────▼──────┐           ┌───────▼───────┐         ┌───────▼───────┐
                 │  Django Web  │           │  Django Web   │  ...    │  Django Web   │
                 │  (Gunicorn)  │           │  (Gunicorn)   │         │  (Gunicorn)   │
                 └──────┬──────┘           └───────┬───────┘         └───────┬───────┘
                        │  django-tenants: resolve subdomínio → schema        │
                        └───────────────────────────┬────────────────────────┘
                                                     │
              ┌──────────────────┬───────────────────┼──────────────────┬──────────────────┐
              │                  │                   │                  │                  │
       ┌──────▼──────┐   ┌───────▼───────┐   ┌───────▼───────┐  ┌───────▼──────┐   ┌───────▼───────┐
       │ PostgreSQL   │   │     Redis     │   │ Celery Worker │  │ Celery Beat  │   │ WAHA WhatsApp │
       │ 16           │   │ (broker+cache)│   │ (assíncrono)  │  │ (scheduler)  │   │ (WhatsApp)    │
       │ public +     │   └───────────────┘   └───────┬───────┘  └──────────────┘   └───────┬───────┘
       │ schema/tenant│                               │                                     │
       └──────────────┘                               │  Google Calendar API ◄──────────────┘
                                                       └────────────────────► (OAuth2 por tenant/dentista)
```

---

## 2. Estratégia Multi-Tenant — *Schemas* vs `tenant_id`

### Decisão: **Schema-per-tenant** com a biblioteca [`django-tenants`](https://django-tenants.readthedocs.io/).

| Critério | Schema-per-tenant (ESCOLHIDO) | Row-level (`tenant_id`) |
|---|---|---|
| Isolamento de dados | **Forte** — separação física por schema | Fraco — depende de filtro em toda query |
| Risco de vazamento | Praticamente nulo (search_path) | Alto (um `WHERE` esquecido vaza dados) |
| Conformidade LGPD (dados de saúde) | **Excelente** — backup/restore/expurgo por clínica | Complexo |
| Migrações | Por schema (mais lento em escala) | Única (rápida) |
| Analytics cross-tenant | Mais trabalhoso | Trivial |
| Escala ideal | Dezenas a milhares de tenants | Centenas de milhares |

**Justificativa:** o sistema manipula **dados sensíveis de saúde** (prontuários, anamnese), sujeitos à
**LGPD**. O volume esperado é de **dezenas a algumas centenas de clínicas**, faixa em que o
schema-per-tenant oferece o melhor equilíbrio entre isolamento forte, facilidade de backup/expurgo por
cliente e simplicidade operacional. O risco de vazamento acidental entre clínicas é eliminado no nível do
banco (`search_path`), e não apenas no ORM.

### Organização dos schemas

- **`public` (SHARED_APPS)** — dados da plataforma, comuns a todas as clínicas:
  - `Clinica` (tenant) e `Dominio` (roteamento por subdomínio)
  - App de provisionamento/billing da própria plataforma (assinatura do SaaS)
  - Django `contenttypes`, `sessions`
- **`<schema_da_clinica>` (TENANT_APPS)** — dados isolados de cada clínica:
  - `usuarios` (equipe da clínica: dentistas, recepção, admin da clínica)
  - `dentistas`, `pacientes`, `agenda`, `notificacoes`, `estoque`, `financeiro`, `integracoes`

> **Nota sobre autenticação:** os usuários operacionais (dentistas, recepcionistas) pertencem a **uma
> clínica** → modelo `Usuario` fica no **schema do tenant**. Contas de superadmin da plataforma vivem no
> `public`. Isso evita colisão de e-mails entre clínicas e mantém o isolamento.

---

## 3. Processamento Assíncrono (Cron / Schedulers)

### Stack: **Celery + Redis (broker) + Celery Beat + `django-celery-beat`**

| Componente | Papel |
|---|---|
| **Redis** | Broker de mensagens e backend de resultado/cache |
| **Celery Worker** | Executa tarefas (envio WhatsApp, chamadas Google API, geração financeira) |
| **Celery Beat** | Agendador (cron) que dispara tarefas periódicas |
| **`django-celery-beat`** | Persiste os agendamentos no banco → cada clínica define sua própria antecedência sem redeploy |

### Fluxo de disparo de lembretes (tenant-aware)

```
Celery Beat (a cada X min)
        │
        ▼
 varrer_confirmacoes_pendentes()   ──► para cada Clinica (schema):
        │                                 lê ConfiguracaoNotificacao.dias_antecedencia
        ▼                                 seleciona Consultas na janela
 enviar_lembrete.delay(consulta_id, schema)  ──► Celery Worker
        │
        ▼
 WAHA API (HTTP)  ──► registra LogNotificacao(status=ENVIADO)
```

> **Importante (multi-tenant + Celery):** cada task precisa saber em qual schema operar. Usaremos
> `tenant_context(clinica)` do django-tenants dentro das tasks, propagando o `schema_name` como argumento.
> A varredura periódica itera sobre todos os tenants e agenda uma sub-task por clínica.

---

## 4. Integração com Google Calendar

### 4.1 Autenticação OAuth2 (por Tenant/Dentista)

- Cada **clínica** (e opcionalmente cada **dentista**) autoriza o acesso ao seu Google Calendar via
  **OAuth2 Authorization Code Flow**.
- O sistema armazena, de forma **criptografada**, `refresh_token`, `access_token`, `expiry` e `scope` no
  modelo **`CredencialGoogleCalendar`** (schema do tenant).
- Escopo mínimo: `https://www.googleapis.com/auth/calendar.events`.

```
Dentista/Clínica clica "Conectar Google Agenda"
        │
        ▼
 Redirect → Google Consent Screen (state = assinado, contém schema+dentista_id)
        │
        ▼
 Callback /integracoes/google/callback  ──► troca code por tokens
        │
        ▼
 Salva CredencialGoogleCalendar (refresh_token criptografado)
```

### 4.2 Gravação/Atualização do evento (gatilho pela confirmação)

O evento é gravado/atualizado quando o **paciente confirma** (via WhatsApp):

```
Webhook WAHA recebe resposta do paciente
        │
        ▼
 atualiza Consulta.status_confirmacao = CONFIRMADA
        │
        ▼ (signal / task)
 sincronizar_evento_google.delay(consulta_id, schema)
        │
        ▼
 events.insert/update  ──► guarda Consulta.google_event_id + AgendaEvento
```

### 4.3 Sincronização de volta (Google → Sistema)

Duas estratégias combinadas para robustez:

1. **Push notifications (watch channels)** — endpoint `/integracoes/google/webhook` recebe notificações
   quando o calendário muda. Requer HTTPS público. Guarda `channel_id`/`resource_id` para renovação.
2. **Sincronização incremental por `syncToken`** — task do Celery Beat que faz `events.list(syncToken=…)`
   periodicamente como *fallback* (cobre janelas em que o webhook falhou / canal expirou).

---

## 5. Comunicação WhatsApp (WAHA — WhatsApp HTTP API)

> **Decisão (revisada):** adotamos o **WAHA** (WhatsApp HTTP API). A partir da versão **2026.6.1** o WAHA
> tornou-se **100% gratuito e open source**, incluindo **sessões ilimitadas** (antes exclusivas do WAHA
> Plus pago) — o que atende ao nosso requisito de solução 100% gratuita e ao cenário **multi-tenant** (cada
> clínica conecta o próprio número). Ver a análise comparativa que motivou a troca em relação à Evolution
> API no histórico do projeto.

- **WAHA** roda como **um único container** (Docker-first), expondo REST para envio e webhooks para
  recebimento. Engine recomendada: **NOWEB** (WebSocket via Baileys, sem navegador ≈ 200 MB/sessão);
  **GOWS** (Go) é alternativa ainda mais leve. Evita-se a engine **WEBJS** (Chromium/Puppeteer, pesada).
- **Sessões por clínica:** cada tenant possui sua própria **session** WAHA (ex.: `clinica-<schema>`),
  mapeada em `ConfiguracaoNotificacao.waha_session`. Sessões ilimitadas no mesmo container.
- **Envio:** task Celery chama `POST /api/sendText` (payload com `session`, `chatId`, `text`) com o
  template renderizado.
- **Recebimento:** WAHA → webhook `/notificacoes/whatsapp/webhook` (evento `message`) → parser interpreta a
  resposta (ex.: "1"/"SIM" = confirma, "2"/"NÃO" = cancela) → atualiza `LogNotificacao` e `Consulta` →
  dispara a sincronização com o Google Agenda.
- **Personalização por clínica:** `ConfiguracaoNotificacao` (dias de antecedência, janela de envio,
  `waha_session`) e `TemplateMensagem` (corpo com variáveis `{{paciente}}`, `{{data}}`, `{{hora}}`,
  `{{dentista}}`).

---

## 6. CI/CD (Esteira de Testes e Deploy)

### GitHub Actions — pipeline por *push* / *pull request*

```
push / PR
   │
   ├─ lint      → ruff (lint + format check)
   ├─ test      → pytest + pytest-django + coverage  (serviço postgres:16 + redis:7)
   ├─ security  → pip-audit / bandit (opcional)
   └─ build     → docker build (imagem da aplicação)   [somente em main/tags]
              └─ deploy (manual/approval)               [opcional, ambiente]
```

- **Testes obrigatórios** em cada push (regra da metodologia): sem testes verdes, sem merge.
- Cobertura mínima configurável (ex.: falha se < 80%).
- Banco e Redis sobem como *services* do job, espelhando o `docker-compose` local.

---

## 7. Segurança e Isolamento

- **Isolamento de schema** garantido pelo `django-tenants` (middleware resolve o tenant antes das views).
- **Tokens Google criptografados** em repouso (Fernet / `django-cryptography` ou KMS).
- **Segredos** via variáveis de ambiente (`.env` local, secrets no CI/CD e no orquestrador de produção).
- **Webhooks assinados/validados** (WAHA: assinatura HMAC + `X-Api-Key`; Google: validação de `channel_id`).
- **LGPD:** trilha de auditoria, expurgo por clínica (drop de schema), consentimento registrado.

---

## 8. Stack Tecnológica (resumo)

| Camada | Tecnologia |
|---|---|
| Linguagem/Framework | Python 3.12+, Django 5.x, Django REST Framework |
| Multi-tenant | django-tenants (schema-per-tenant) |
| Banco de dados | PostgreSQL 16 |
| Assíncrono | Celery + Redis + Celery Beat + django-celery-beat |
| WhatsApp | WAHA — WhatsApp HTTP API (container, engine NOWEB/GOWS) |
| Agenda | Google Calendar API (OAuth2) |
| Servidor app | Gunicorn / Uvicorn |
| Containerização | Docker + docker-compose |
| CI/CD | GitHub Actions |
| Testes | pytest, pytest-django, factory-boy, coverage |
| Qualidade | ruff (lint/format), pre-commit |

---

Ver também: [Modelagem de Dados](02-MODELAGEM-DADOS.md) · [Backlog de Sprints](03-BACKLOG-SPRINTS.md)
