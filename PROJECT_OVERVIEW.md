# 🦷 PróClínica (OdontoSaaS) — Documentação Oficial da Arquitetura e Sistema

> **Single Source of Truth.** Este documento é a fonte da verdade para
> desenvolvedores humanos e agentes de IA. É um panorama de alto nível que aponta
> para os documentos aprofundados em `docs/` e para os arquivos reais do código.
> Ao mexer no projeto, **valide sempre contra o código** — nada aqui deve ser
> assumido sem conferir o arquivo citado.
>
> Documentos complementares:
> `docs/01-ARQUITETURA.md`, `docs/02-MODELAGEM-DADOS.md`,
> `docs/03-BACKLOG-SPRINTS.md`, `docs/04-OBSERVACOES-PAINEL-ADMIN.md`,
> `docs/05-PLANOS-PAGAMENTOS.md`, `docs/06-AMBIENTES-E-FLUXO.md`,
> `docs/07-GOOGLE-OAUTH-MULTITENANT.md`, e `docs/frontend/01..04`.

---

## 1. 📌 Visão Geral & Proposta de Valor

**PróClínica** (codinome de repositório: *OdontoSaaS*) é um **SaaS multi-tenant de
gestão para clínicas odontológicas**. Cada clínica é um *tenant* isolado, com sua
própria agenda, pacientes, prontuário/odontograma, procedimentos, convênios,
financeiro, estoque e automação de **WhatsApp** + **Google Agenda**.

**Diferenciais:**
- **Confirmação de consulta por WhatsApp** (via WAHA) com resposta "SIM/NÃO" ou link, lembretes, recall e aviso de reagendamento.
- **Sincronização bidirecional com o Google Agenda** por reconciliação periódica (por ID), respeitando cores, escopo por dentista e **sem tocar em eventos criados manualmente pela clínica**.
- **Prontuário com odontograma anatômico** (dentes/procedimentos por consulta e por guia).
- **Isolamento forte por schema de banco** (um schema PostgreSQL por clínica).

**Status atual (2026-08):**
- **Em PRODUÇÃO** numa VPS (Hostinger, São Paulo) sob o domínio **`proclinica.cloud`**; primeira clínica-piloto: `mercadante.proclinica.cloud`.
- Backend com **~62 arquivos de teste** (pytest, `fail_under=80`); frontend com suíte Vitest (~175 testes).
- Estágio: **piloto comercial** — validando com um consultório real antes da venda.

---

## 2. 🏗️ Arquitetura Multi-Tenant

**Estratégia: schema-per-tenant** com **`django-tenants` 3.7** (não é `tenant_id` por linha, nem RLS, nem banco separado). Cada clínica = **um schema PostgreSQL**; o schema `public` guarda o que é da plataforma.

- **Model do tenant:** `apps/tenants/models.py` → `Clinica(TenantMixin)` e `Dominio(DomainMixin)`.
  `TENANT_MODEL = "tenants.Clinica"`, `TENANT_DOMAIN_MODEL = "tenants.Dominio"` (`config/settings/base.py`).
- **`SHARED_APPS` (schema `public`):** `django_tenants`, `apps.core`, `apps.tenants`, `apps.plataforma`, `django_celery_beat`, `drf_spectacular`, `contenttypes`, `staticfiles`.
- **`TENANT_APPS` (schema de cada clínica):** `auth`, `apps.usuarios` (**AUTH_USER_MODEL**), `admin`, `sessions`, `rest_framework`, `apps.dentistas`, `apps.convenios`, `apps.procedimentos`, `apps.pacientes`, `apps.agenda`, `apps.integracoes`, `apps.notificacoes`, `apps.estoque`, `apps.financeiro`, `apps.auditoria`.
- **Importante:** o **usuário vive no schema do tenant** — o login é por clínica; não existe usuário global (exceto superuser no public).

### Ciclo de vida da requisição (identificação → isolamento)
```
Request  →  HealthCheckMiddleware (/health, /health/ready — ANTES do tenant)
         →  TenantMainMiddleware (django-tenants): resolve o tenant pelo HOST
            (subdomínio) via tabela tenants_dominio → seta o search_path do
            PostgreSQL para o schema daquela clínica
         →  SecurityMiddleware / Session / CSRF / Auth
         →  AuditoriaMiddleware (captura o usuário p/ a trilha)
         →  View/DRF  →  queries JÁ rodam dentro do schema do tenant
```
Middlewares em `config/settings/base.py::MIDDLEWARE`; health em `config/middleware.py`.

### Identificação do tenant
- **Por subdomínio (Host header):** `mercadante.proclinica.cloud` → schema `mercadante`.
- Em dev: `demo.localhost` → schema `demo`.
- Um **DNS curinga** `*.proclinica.cloud` cobre todas as clínicas; `ALLOWED_HOSTS=.proclinica.cloud`.

### Prevenção de vazamento entre clínicas (data leakage)
1. **Isolamento no banco:** cada query roda no `search_path` do schema resolvido — o `django-tenants` troca o schema por requisição; uma clínica **não enxeà** as tabelas da outra.
2. **Escopo row-level do dentista** (dentro do tenant): `apps/core/mixins.py::escopo_dentista_q` — um `DENTISTA` só vê pacientes/consultas onde é responsável, compartilhado ou tem consulta (fail-closed).
3. **RBAC por módulo** (ver §6) e **hierarquia de papéis** (`pode_gerenciar`) em toda mutação de `Usuario`.
4. **Health antes do tenant:** o `/health/` responde sem resolver tenant (evita 404 de host desconhecido no healthcheck).

---

## 3. 💻 Stack Tecnológica

| Camada | Tecnologia / Lib | Versão | Uso |
|---|---|---|---|
| **Backend** | Django | 5.1.4 | Framework principal |
| | Django REST Framework | 3.15.2 | API REST |
| | djangorestframework-simplejwt | 5.3.1 | Auth JWT (login por e-mail) |
| | drf-spectacular | 0.28.0 | OpenAPI / Swagger / ReDoc + geração de tipos do front |
| | **django-tenants** | 3.7.0 | Multi-tenant schema-per-tenant |
| **Banco** | PostgreSQL | 16 (`psycopg[binary]` 3.2.3) | Um schema por clínica |
| **Cache/Filas** | Redis | 5.2.1 | Broker/result do Celery + cache (lockout de login) |
| | Celery | 5.4.0 | Tarefas assíncronas |
| | django-celery-beat | 2.7.0 | Agenda periódica persistida no banco |
| **Integrações** | google-api-python-client / google-auth-oauthlib | 2.156 / 1.2.1 | Google Calendar OAuth2 |
| | requests | 2.32.3 | Cliente HTTP do WAHA (WhatsApp) |
| **Segurança** | cryptography (Fernet) | 44.0.0 | `EncryptedTextField` (tokens Google no banco) |
| **Config/Server** | django-environ / gunicorn / whitenoise | 0.11 / 23.0 / 6.8 | `.env`, WSGI, estáticos em prod |
| **Frontend** | React + React DOM | 19 | SPA |
| | Vite (rolldown-vite) | 8 | Build/dev server |
| | TypeScript | 6 (strict) | Tipagem |
| | Tailwind CSS v4 + shadcn/Radix UI | 4.x | Design system |
| | TanStack Query + TanStack Table | 5 / 8 | Data fetching + tabelas |
| | React Hook Form + Zod | 7 / 4 | Formulários + validação |
| | React Router | 7 | Rotas |
| | Zustand | 5 | Estado de UI (sidebar, etc.) |
| | FullCalendar | 6 | Agenda visual |
| | Recharts | 3 | Dashboard |
| | axios | 1.x | HTTP client (`baseURL: '/api'`) |
| | sonner / lucide-react | — | Toasts / ícones |
| | openapi-typescript | 7 | Gera `src/lib/api/schema.d.ts` do OpenAPI |
| **Testes** | pytest / Vitest / Playwright | — | Backend / Frontend / E2E |
| **Infra** | Docker + Docker Compose + **Caddy** | — | Containers + proxy reverso c/ **HTTPS automático** |

---

## 4. 📂 Estrutura do Repositório

```
ODONTO/
├── apps/                      # Apps Django (domínio)
│   ├── core/                  # ModeloBase (audit + soft-flag), mixins, paginação
│   ├── tenants/               # Clinica + Dominio + comando `provisionar_clinica`
│   ├── plataforma/            # PlanoAssinatura (SaaS) — schema public
│   ├── usuarios/              # Usuario (AUTH_USER_MODEL), perfis/RBAC, login JWT
│   ├── dentistas/             # Dentista + Especialidade (+ seed de especialidades)
│   ├── pacientes/             # Paciente, PlanoOdontologico, Guia
│   ├── agenda/                # Consulta, Anamnese, AgendaEvento, EventoGoogleRemovido, signals
│   ├── procedimentos/         # Catálogo de Procedimento (recall)
│   ├── convenios/             # Convenio (catálogo por clínica)
│   ├── notificacoes/          # WhatsApp (WAHA): config, templates, logs, tasks, inbound
│   ├── integracoes/           # Google Calendar: OAuth, reconciliação, tasks
│   ├── estoque/               # Insumo, Categoria, Movimentação, Consumo
│   ├── financeiro/            # Fatura, LancamentoFinanceiro
│   └── auditoria/             # RegistroAuditoria (trilha LGPD) + middleware
├── config/                    # settings/{base,dev,prod}.py, urls.py, celery.py, middleware.py, wsgi/asgi
├── frontend/                  # SPA React (Vite)
│   ├── src/features/          # Um diretório por domínio (agenda, pacientes, auth, ...)
│   ├── src/components/        # ui/ (shadcn), common/ (DataTable, form-kit, ...), layout/ (sidebar)
│   ├── src/lib/api/           # client axios + schema.d.ts (gerado do OpenAPI)
│   ├── src/routes/            # nav.ts (menu por papel)
│   └── public/                # logo.png, favicon.svg
├── deploy/                    # Kit de produção (ver §9)
│   ├── Caddyfile              # Proxy + HTTPS automático + SPA + landing do apex
│   ├── edge.Dockerfile        # Build do SPA embutido no Caddy
│   ├── deploy.sh              # Deploy idempotente (build → migra → collectstatic → up)
│   ├── backup-postgres.sh     # Backup diário do Postgres (todos os schemas)
│   ├── .env.prod.example      # Template dos segredos de produção
│   ├── landing/index.html     # Página "em breve" do apex (site de vendas futuro)
│   └── README.md              # Passo a passo do deploy + hardening
├── docs/                      # Documentação aprofundada (arquitetura, modelagem, backlog...)
├── tests/                     # ~62 arquivos pytest (por domínio + segurança)
├── docker-compose.yml         # DEV (db, redis, web, celery worker/beat, waha)
├── docker-compose.prod.yml    # PROD (+ edge/Caddy; db/redis/waha sem porta pública)
├── Dockerfile                 # Imagem da app (multi-stage, não-root, gunicorn)
└── requirements/{base,dev,prod}.txt
```

Convenções do backend por app: `models.py`, `serializers.py`, `views.py` (ViewSets DRF),
`tasks.py` (Celery), `signals.py`, `migrations/`. Sem camada separada de "repositories":
a lógica vive em serializers/views/services (ex.: `apps/estoque/services.py`, `apps/financeiro/services.py`).

---

## 5. 🗄️ Modelagem de Dados & Schema

**Base comum:** `apps/core/models.py::ModeloBase` (abstrata) injeta em todos os models de negócio:
`criado_em` (auto_now_add), `atualizado_em` (auto_now) e `ativo` (bool — soft-flag, **não é soft-delete universal**; exclusão real existe onde faz sentido). PKs são **BigAutoField** (inteiro), **não UUID** — exceto tokens públicos (`Consulta.confirmacao_token` é UUID). `TIME_ZONE=America/Sao_Paulo`, `USE_TZ=True`.

### Entidades principais (arquivo → model)
- **Plataforma (public):** `plataforma/PlanoAssinatura`; `tenants/Clinica` (TenantMixin), `tenants/Dominio` (DomainMixin).
- **Usuários/Acesso (tenant):** `usuarios/Usuario` (AbstractUser, login por **e-mail**, campo `papel`), vinculado opcionalmente a um `Dentista`.
- **Equipe:** `dentistas/Dentista` (CRO, especialidades M2M), `dentistas/Especialidade`.
- **Pacientes:** `pacientes/Paciente` (CPF único opcional, `dentista_responsavel`, `dentistas_compartilhados` M2M), `pacientes/PlanoOdontologico` (FK `convenio`, validade), `pacientes/Guia` (FK `plano`, `dentes` JSON — odontograma).
- **Agenda/Prontuário:** `agenda/Consulta` (FK `paciente` PROTECT, `dentista` PROTECT, `procedimento_catalogo` PROTECT, `convenio`, `inicio`/`fim`, `status`, `status_confirmacao`, `dentes` JSON + `anotacoes` — ficha/odontograma, `confirmacao_token` UUID, `reagendada_em`), `agenda/Anamnese`, `agenda/AgendaEvento` (espelho de evento Google por `(consulta, credencial)`, com `origem` SISTEMA/IMPORTADO + `assinatura`), `agenda/EventoGoogleRemovido` (tombstone de exclusão).
- **Procedimentos/Convênios:** `procedimentos/Procedimento` (catálogo, recall), `convenios/Convenio`.
- **Notificações (WhatsApp):** `notificacoes/ConfiguracaoNotificacao` (1 por clínica — antecedência, horário, flags de envio, sessão WAHA), `notificacoes/TemplateMensagem` (Confirmação/Cancelamento/Agradecimento/Reagendamento singletons + Lembretes N), `notificacoes/LogNotificacao` (histórico).
- **Integrações Google:** `integracoes/CredencialGoogleCalendar` (tokens **criptografados** via `EncryptedTextField`; `dentista` nulo = credencial da clínica), `integracoes/ConfiguracaoSincronizacao` (intervalo por clínica + última sync).
- **Estoque:** `estoque/{CategoriaInsumo, Insumo, MovimentacaoEstoque, ConsumoInsumo}`.
- **Financeiro:** `financeiro/{Fatura, LancamentoFinanceiro}`.
- **Auditoria/LGPD:** `auditoria/RegistroAuditoria` (trilha por usuário via middleware).

Detalhes de relacionamentos e diagramas: **`docs/02-MODELAGEM-DADOS.md`**.

---

## 6. 🦷 Módulos e Regras de Negócio

### Agenda / Consultas (`apps/agenda`)
- Status da consulta (`Consulta.Status`): **AGENDADA → EM_ATENDIMENTO → REALIZADA**; terminais **CANCELADA / FALTOU**. Transições válidas em `Consulta.TRANSICOES` / `pode_transicionar_para()`.
- `status_confirmacao`: PENDENTE / CONFIRMADA / RECUSADA / SEM_RESPOSTA (gatilho do WhatsApp).
- **Cores no Google** espelham o estado (ver §7). Consultas CANCELADA/FALTOU/EM_ATENDIMENTO **não** vão ao Google.
- Ficha do atendimento persiste **`dentes`** (JSON: lista de `{dente, procedimento}` — odontograma) + `anotacoes`.

### Prontuário & Odontograma
- O odontograma é armazenado como **JSON** em `Consulta.dentes` (ficha da consulta) e em `Guia.dentes` (procedimentos por dente na guia). O front renderiza SVG de dentes (`frontend/src/features/pacientes/odontograma.tsx`, `dentes-svg.ts`).

### Planos/Guias & Convênios
- `PlanoOdontologico` referencia um `Convenio` (catálogo por clínica) e tem validade; `Guia` pertence a um plano (regra N4: não emitir/executar guia de plano vencido).

### Procedimentos & Recall (`apps/procedimentos` + `apps/notificacoes`)
- Catálogo de `Procedimento` alimenta o **recall** (chamar de volta quem fez um procedimento há mais de X meses) — template LEMBRETE tipo RECALL.

### Financeiro & Estoque
- `financeiro/services.py` e signals geram lançamentos a partir de consultas REALIZADA; `estoque/services.py` movimenta insumos (política: estoque negativo permitido; estorno automático em glosa/cancelamento se não pago). **Telas de front F7/F8 ainda em desenvolvimento** (ver §10).

### Notificações WhatsApp (`apps/notificacoes`) — regras centrais
- **Confirmação** disparada com `dias_antecedencia`/`horario_envio` (respeita o horário; janela pega agendamentos de última hora — catch-up).
- **Matriz recíproca template↔permissão:** só ativa a permissão de envio se o template estiver ativo, e vice-versa (Confirmação↔"Notificações ativas", Cancelamento, Agradecimento, Reagendamento).
- **Reforço** "responda SIM ou NÃO" só quando há confirmação **pendente** (não dispara em resposta a reagendamento/aviso).
- **Fila** (`/api/logs-notificacao/fila/`): projeção do que ainda vai sair.
- Matching da resposta: `replyTo` (id da mensagem) **ou** telefone; ver `apps/notificacoes/inbound.py`.

### Controle de Acesso (RBAC) — `apps/usuarios/perfis.py`
Papéis (`Usuario.Papel`): **ADMIN**, **DENTISTA_GERENTE**, **DENTISTA**, **RECEPCAO**.

| Módulo | RECEPCAO | DENTISTA | DENTISTA_GERENTE | ADMIN |
|---|---|---|---|---|
| agenda | FULL | FULL | FULL | FULL |
| pacientes | FULL | FULL | FULL | FULL |
| dentistas | READ | READ | FULL | FULL |
| convenios | FULL | READ | FULL | FULL |
| procedimentos | FULL | READ | FULL | FULL |
| estoque | FULL | READ | FULL | FULL |
| financeiro | — | — | FULL | FULL |
| notificacoes | FULL | — | FULL | FULL |
| auditoria | — | — | READ | FULL |
| usuarios | — | — | FULL | FULL |

- Módulo ausente = **sem acesso**. `PermissaoModulo` aplica isso via grupos do Django (`sincronizar_grupos`).
- **Hierarquia** (`RANK_PAPEL` + `pode_gerenciar`): um usuário só cria/edita/bloqueia/reseta senha de cargos **estritamente abaixo**; auto-edição = só nome+senha. **Obrigatório** em todo endpoint que mute `Usuario` (pentest achou takeover via dentistas).
- **Escopo row-level do dentista:** `escopo_dentista_q` (§2).

---

## 7. 🔌 Integrações Externas & Serviços

### WhatsApp — WAHA (WhatsApp HTTP API), self-hosted
- Container `waha` (imagem `devlikeapro/waha`, engine **GOWS**). **Uma sessão por clínica** (sessão = schema do tenant). Pareamento por **QR dentro do app** (WhatsApp → Configuração → Conectar).
- Código: `apps/notificacoes/waha.py` (envio, sessão, "digitando"), `tasks.py` (disparos/recall/aviso/reagendamento), `inbound.py` (respostas), webhook em `POST /notificacoes/whatsapp/webhook`.
- Config via `.env`: `WAHA_API_URL`, `WAHA_API_KEY`, `WHATSAPP_HOOK_URL` (interno `http://web:8000/...`).

### Google Agenda — OAuth2 + reconciliação periódica
- Código: `apps/integracoes/google_calendar.py` (+ `tasks.py`, `views.py`). Credencial por **clínica (dentista=null, vê todas)** e por **dentista (vê só as suas)** — `CredencialGoogleCalendar` com tokens **criptografados**.
- **Sync NÃO é imediata:** reconciliação periódica por **ID** (`reconciliar_google`), com **snapshot/diff** por `AgendaEvento.assinatura`, **cores** (Pendente=Blueberry `9`, Confirmado=Sage `2`, Realizada=Basil `10`), **tombstone** durável para exclusões (`EventoGoogleRemovido.processado`), e a **regra crítica**: só cria/atualiza/remove eventos **`origem=SISTEMA`** — eventos que a clínica criou à mão no Google (**`IMPORTADO`**) são **intocáveis**.
- **Piloto:** `redirect_uri` registrado por subdomínio + conta da clínica como *usuário de teste* (app OAuth em modo Teste). **Fluxo definitivo (a desenvolver):** callback fixo no apex + `state` + verificação do app — ver **`docs/07-GOOGLE-OAUTH-MULTITENANT.md`**.

### Pagamentos (planejado, ainda não implementado)
- Cobrança das clínicas (assinatura) via **gateway** (Asaas/Pagar.me/Mercado Pago/Stripe), **sem armazenar cartão**. Detalhes: **`docs/05-PLANOS-PAGAMENTOS.md`**. Não há NF-e/NFS-e no escopo atual.

---

## 8. 🚀 Guia de Desenvolvimento Local

**Pré-requisitos:** Docker + Docker Compose; Node 22+ (para o frontend). Windows: usar o Git Bash/PowerShell (o backend roda em containers).

```bash
# 1) Backend + infra (Docker)
cp .env.example .env                    # ajuste se necessário
docker compose up -d --build            # sobe db, redis, web, celery worker/beat, waha
docker exec odonto_web python manage.py migrate_schemas   # migra public + tenants

# 2) Provisionar uma clínica (tenant) de teste
docker exec -it odonto_web python manage.py provisionar_clinica \
  --schema demo --nome "Clínica Demo" --dominio demo.localhost \
  --admin-email admin@demo.com --admin-senha OdontoDemo2026
# (semeia grupos de perfil, templates de WhatsApp e especialidades padrão)

# 3) Frontend (Vite) — acessa via subdomínio do tenant
cd frontend
npm install
npm run dev            # http://demo.localhost:5173
npm run gen:api        # regenera src/lib/api/schema.d.ts a partir do OpenAPI (backend up)
```

**Variáveis de ambiente (principais — ver `config/settings/base.py` e `deploy/.env.prod.example`):**
`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `FIELD_ENCRYPTION_KEY` (Fernet, cripta tokens Google), `DATABASE_URL` (+ `POSTGRES_*`), `CELERY_BROKER_URL`/`CELERY_RESULT_BACKEND`/`REDIS_CACHE_URL`, `GOOGLE_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI`, `GOOGLE_OAUTH_FRONTEND_URL`, `APP_BASE_URL`, `WAHA_API_URL/API_KEY`, `WHATSAPP_HOOK_URL`.

**Usuários demo (dev):** `admin@demo.com`, `gerente@demo.com`, `dentista@demo.com`, `recepcao@demo.com` — senha `OdontoDemo2026` (um por papel).

**Gates (rodar antes de commit):**
```bash
# Backend
docker exec odonto_web python -m pytest -q         # (NUNCA rodar 2 pytest no mesmo DB)
docker exec odonto_web ruff check apps config
# Frontend
cd frontend && npm run typecheck && npm run lint && npx vitest run --maxWorkers=2 && npm run build
```
Mais detalhes: **`docs/06-AMBIENTES-E-FLUXO.md`** e `docs/frontend/`.

---

## 9. 🌐 Ambiente de Produção & Infraestrutura VPS

**Topologia (2026-08):** VPS **Hostinger KVM 2** (2 vCPU / 8 GB / São Paulo), **Ubuntu 24.04 LTS**, Docker. Domínio **`proclinica.cloud`** (DNS curinga `*` → IP). Piloto: `mercadante.proclinica.cloud`.

**Containers (`docker-compose.prod.yml`):**
- `edge` — **Caddy** (único exposto, portas 80/443): **HTTPS automático** (Let's Encrypt), serve o SPA (`deploy/edge.Dockerfile` compila o React e embute no Caddy) e faz proxy de `/api`, `/admin`, `/integracoes`, `/notificacoes`, `/static`, `/health` para o `web`. Serve a landing "em breve" no apex.
- `web` — Django + Gunicorn (WhiteNoise serve estáticos). **Sem porta pública.**
- `db` (Postgres 16), `redis`, `waha`, `celery_worker`, `celery_beat` — **rede interna**; `db` e `waha` publicados **só no loopback** (`127.0.0.1`) para acesso via **túnel SSH** (ex.: DBeaver no banco).

**Deploy (fluxo `desenvolve local → git push → pull + deploy na VPS`):**
```bash
cd /opt/odonto && git pull && bash deploy/deploy.sh
# deploy.sh: build (web+edge) → up db/redis → migrate_schemas → collectstatic → up -d
```
Passo a passo completo + **checklist de hardening** (SSH por chave, firewall 80/443/SSH, `fail2ban`, segredos fora do git): **`deploy/README.md`**.

**Backups:** `deploy/backup-postgres.sh` (cron diário 03h) — `pg_dump` do banco único captura **todos os schemas/clínicas**. Recomendado copiar off-site (rclone). **Restore** via `pg_restore` (ver README).

**Observabilidade:** logs estruturados JSON (`config/logging.py`), Sentry opcional (`SENTRY_DSN`), `/health/` (liveness) e `/health/ready/` (readiness/DB).

**Segredos:** `.env` na raiz da VPS (nunca no git; `.gitignore` cobre). `FIELD_ENCRYPTION_KEY`, `DJANGO_SECRET_KEY`, senhas de DB/WAHA — gerar fortes (ver `deploy/.env.prod.example`).

---

## 10. 🗺️ Status Atual, Sprints & Roadmap

Fonte detalhada: **`docs/03-BACKLOG-SPRINTS.md`** e `docs/frontend/03-BACKLOG-SPRINTS-FRONTEND.md`.

### ✅ Em Produção (operando e testado)
- Multi-tenant (schema-per-clínica) + provisionamento; **login por clínica** (JWT).
- **Pacientes** (CRUD, escopo, exclusão só sem registros), **Dentistas/Equipe**, **Convênios**, **Procedimentos**.
- **Agenda/Consultas** + ficha (odontograma + anotações), Anamnese.
- **WhatsApp/WAHA**: pareamento por QR, confirmação (SIM/NÃO + link), cancelamento, agradecimento, **reagendamento**, **lembretes/recall**, fila, reforço.
- **Google Agenda**: OAuth por clínica/dentista, reconciliação periódica por ID (cores, escopo, tombstone, **IMPORTADO intocável**).
- Auditoria (LGPD), Integrações (tela + status/sync).

### 🚧 Em desenvolvimento / parcial
- **Financeiro (F8)** e **Estoque (F7)**: modelos/serviços no backend existem; **telas de front** em evolução.
- **Dashboard (F9)**: em construção.
- **Google OAuth multi-tenant definitivo** (callback fixo + `state` + verificação do app) — `docs/07`.

### 🔮 Backlog / próximos passos
- **Planos e pagamentos** via gateway (`docs/05`).
- **Painel de admin (vendor)** para tornar configurável o que hoje é fixo (frequências do Beat, intervalo de sync, parâmetros globais) — `docs/04-OBSERVACOES-PAINEL-ADMIN.md`.
- **Uploads** (fase nuvem): raio-X na guia/consulta e foto 3x4 do paciente.
- Site institucional/vendas no apex `proclinica.cloud` (hoje "em breve").

---

## 11. ⚠️ Gotchas, Armadilhas e Decisões Críticas

**NÃO quebrar:**
1. **Isolamento multi-tenant.** Toda operação roda no schema do tenant (resolvido pelo Host). Em scripts/tasks, **sempre** use `with schema_context(schema): ...`. Migrações: `migrate_schemas` (nunca `migrate` puro). Nunca vaze query entre schemas.
2. **Google: só toque no que é seu.** Reconciliação/`sincronizar_consulta`/`remover_evento`/tombstone só agem em `AgendaEvento.origem == SISTEMA`. Evento `IMPORTADO` (criado pela clínica no Google) é **intocável** — não atualiza, não apaga. Sync é **periódica, não imediata**.
3. **RBAC + hierarquia.** Toda mutação de `Usuario` passa por `pode_gerenciar` (só cargos abaixo). Respeite a `MATRIZ` de módulos. `PermissaoModulo` é o default do DRF.
4. **Templates de WhatsApp:** Confirmação/Cancelamento/Agradecimento/Reagendamento são **singletons pré-semeados** (só editáveis); trava recíproca template↔permissão. Lembretes podem ser vários.
5. **Concorrência de agenda / status:** respeite `Consulta.TRANSICOES`. Só AGENDADA/REALIZADA sincronizam ao Google.
6. **Segredos & LGPD:** dados de saúde = sensíveis. `.env` fora do git; tokens Google criptografados (`FIELD_ENCRYPTION_KEY`). Backups são obrigatórios.
7. **Desenvolvimento:** **nunca** desenvolver/editar direto na VPS (produção com dado real). Fluxo é local → git → `deploy.sh`. Ao mudar `docker-compose`/env, é preciso **recriar o container** na VPS (`up -d <serviço>`) — mudar no git não muda o container em execução.
8. **Testes:** **nunca** rodar dois `pytest` ao mesmo tempo no mesmo banco de teste; Celery **não** roda eager nos testes; rodar Vitest com `--maxWorkers=2` em máquinas lentas.
9. **Frontend:** um formulário/drawer novo **reutiliza** o `form-kit` (`docs/frontend/04-PADRAO-FORMULARIOS.md`); ações de linha seguem o padrão da Equipe (lápis → ativar/desativar → excluir). API base é `/api` (same-origin); regenere `schema.d.ts` (`npm run gen:api`) ao mudar a API.
10. **WAHA:** sessão = schema do tenant; a clínica só usa o botão **Conectar** do app (não o dashboard do WAHA, que fica só no loopback para admin).

---

*Documento gerado por varredura do repositório. Ao divergir do código, o **código** é a verdade — atualize este arquivo.*
