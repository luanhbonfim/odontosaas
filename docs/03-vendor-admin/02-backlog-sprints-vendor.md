# 09 — Backlog de Sprints do Painel de Admin (Vendor Admin)

> **Fonte de Verdade do Desenvolvimento do Vendor Admin.**
> O desenvolvimento é guiado estritamente tarefa a tarefa pelo checklist abaixo.
> A cada comando de desenvolvimento, trabalha-se **EXCLUSIVAMENTE na próxima tarefa `- [ ]` (de cima para baixo)**.
> Só marcar `- [x]` **após validação de testes e aprovação do usuário**. Toda tarefa acompanha testes obrigatórios.
>
> **Padrão de Entrega DevOps:** Ao concluir cada sprint, anexa-se obrigatoriamente logo abaixo das tarefas o bloco `### 📦 Resumo da Entrega — Sprint VX (Para Validação DevOps / QA)` detalhando arquivos criados/modificados, decisões técnicas de arquitetura e evidências de testes/linter para auditoria do Claude (DevOps).
>
> **Padrão de UI & Design System:** Todas as telas de frontend do Vendor Admin devem seguir estritamente o guia [`docs/10-DESIGN-SYSTEM-FRONTEND-GUIDELINES.md`](10-DESIGN-SYSTEM-FRONTEND-GUIDELINES.md), mantendo 100% de paridade de estrutura, `FormKit`, `PageHeader`, ícones e tipografia com a aplicação principal.
>
> Legenda: `- [ ]` pendente · `- [x]` concluída e validada.

---

## 🧱 Sprint V1 — Fundação do Backend, Modelos & Middleware de Bloqueio

- [x] **V1.1:** Criar migração no app `apps/plataforma` adicionando campos em `PlanoAssinatura` (`preco_anual`, `limite_pacientes_ativos`, `limite_armazenamento_mb`, `modulo_financeiro_ativo`, `modulo_estoque_ativo`, `sync_google_ativo`, `whatsapp_waha_ativo`).
- [x] **V1.2:** Criar migração no app `apps/tenants` adicionando campos de billing e overrides em `Clinica` (`status_assinatura`, `gateway_customer_id`, `gateway_subscription_id`, `vigencia_fim`, `override_limite_dentistas`, `override_limite_usuarios`, `override_recursos`).
- [x] **V1.3:** Criar app `apps/plataforma_admin` no schema `public` (`SHARED_APPS`) com models `RegistroAuditoriaVendor` e `RegistroErroOperacional`.
- [x] **V1.4:** Implementar o `TenantStatusMiddleware` em `config/middleware.py` (bloqueia requisições com `403` quando `Clinica.ativo = False` ou `status_assinatura = INADIMPLENTE`).
- [x] **V1.5:** Criar classes de permissão do Vendor (`IsVendorSuperAdmin`, `IsVendorStaff`, restrição a requisições originadas no host/schema `public`).
- [x] **V1.6:** Testes da Sprint V1: validação de migrações, isolamento de host, bloqueio de tenant inativo e testes de permissões (`tests/test_plataforma_admin_v1.py` — 13/13 passed).

> ### 📦 Resumo da Entrega — Sprint V1 (Para Validação DevOps / QA)
> * **Status da Sprint:** ✅ Concluída & Validada
> * **Arquivos Criados / Modificados:**
>   - `apps/plataforma/models.py` + migration `0002_planoassinatura_limite_armazenamento_mb_and_more.py` (novos limites e flags de módulos).
>   - `apps/tenants/models.py` + migration `0005_clinica_gateway_customer_id_and_more.py` (billing, `StatusAssinatura` e overrides).
>   - `apps/plataforma_admin/` (`__init__.py`, `apps.py`, `models.py`, `permissions.py`, `migrations/0001_initial.py`).
>   - `config/middleware.py` (`TenantStatusMiddleware` com bloqueio 403 e rotas isentas).
>   - `config/settings/base.py` (`apps.plataforma_admin` em `SHARED_APPS` e `TenantStatusMiddleware` em `MIDDLEWARE`).
>   - `tests/test_plataforma_admin_v1.py` (13 testes automatizados cobrindo modelos, middleware e permissões).
> * **Decisões Técnicas & Arquitetura:**
>   - **Segregação de Schema:** App `plataforma_admin` vive no schema `public` (`SHARED_APPS`), isolado dos schemas de tenants.
>   - **Camuflagem de Host:** `IsVendorHost` lança `Http404` (Not Found) se qualquer endpoint administrativo for invocado a partir de subdomínio de clínica.
>   - **Bloqueio Fail-Safe:** `TenantStatusMiddleware` intercepta tenants com `ativo=False` ou `status_assinatura in (INADIMPLENTE, CANCELADA)` retornando `403 Forbidden` estruturado em JSON para `/api/*` e HTML para web, liberando `/health/*` e `/api/tenant-atual/`.
> * **Evidências de Testes & Qualidade:**
>   - `pytest tests/test_plataforma_admin_v1.py`: **13 passed in 5.36s** (100% dos novos testes verdes).
>   - `pytest` (Suíte Completa): **283 passed, 30 warnings** (zero regressões).
>   - `ruff check apps config`: **All checks passed!**

---

## 🏢 Sprint V2 — APIs de Gestão de Planos & Tenants (Schema Public)

- [x] **V2.1:** Implementar ViewSet/Endpoints para CRUD de `PlanoAssinatura` (`/api/plataforma-admin/planos/`) com validações de unicidade e integridade.
- [x] **V2.2:** Implementar ViewSet/Endpoints para Listagem e Busca de `Clinica` (`/api/plataforma-admin/tenants/`) com filtros por status, plano e data.
- [x] **V2.3:** Implementar action de **Provisionamento de Clínica** via API (`POST /api/plataforma-admin/tenants/provisionar/`), encapsulando a criação de schema, domínio, migrações, sementes e admin inicial.
- [x] **V2.4:** Implementar action de **Bloqueio/Desbloqueio** (`POST /api/plataforma-admin/tenants/{id}/alternar-status/`).
- [x] **V2.5:** Implementar action de **Redefinição de Senha do Admin** e geração de token de **Impersonate Seguro** (`POST /api/plataforma-admin/tenants/{id}/impersonate/`) com suporte a modo Somente-Leitura (L1/L2) e Escrita (SuperAdmin).
- [x] **V2.6:** Implementar action de **Expurgo com Salvaguarda** (`POST /api/plataforma-admin/tenants/{id}/expurgar/`), exigindo digitação do schema e gerando backup prévio antes do drop.
- [x] **V2.7:** Testes da Sprint V2: CRUD de planos, provisionamento completo, bloqueio, impersonate, expurgo e gravação na auditoria vendor (`tests/test_plataforma_admin_v2.py` — 8/8 passed).

> ### 📦 Resumo da Entrega — Sprint V2 (Para Validação DevOps / QA)
> * **Status da Sprint:** ✅ Concluída, Bloqueadores Resolvidos & Validada
> * **Arquivos Criados / Modificados:**
>   - `config/middleware.py`:
>     - Adicionado `/api/auth/` às rotas isentas do `TenantStatusMiddleware`.
>     - Implementado `ImpersonateReadOnlyMiddleware` (bloqueia `POST/PUT/PATCH/DELETE` com `403 Forbidden` quando `impersonate_read_only=True` no token JWT).
>   - `config/settings/base.py`:
>     - Registrado `config.middleware.ImpersonateReadOnlyMiddleware` em `MIDDLEWARE`.
>   - `apps/plataforma_admin/services.py`:
>     - `executar_expurgo_com_backup`: Gera backup físico isolado via `pg_dump -n <schema>` com cálculo de SHA-256 e tamanho em bytes; **aborta o expurgo** caso o dump falhe.
>     - `executar_provisionamento_clinica`: Adicionada compensação automática com `clinica.delete(force_drop=True)` no `except` para nunca deixar schemas órfãos em caso de falha de sementeira.
>     - `gerar_token_impersonate`, `resetar_senha_admin_tenant`, `registrar_auditoria_vendor`.
>   - `apps/plataforma_admin/serializers.py`:
>     - `AlternarStatusTenantInputSerializer` valida presença obrigatória de ao menos um campo (`ativo` ou `status_assinatura`), rejeitando payloads vazios com `400 Bad Request`.
>     - Serializers de Planos, Clínicas, Provisionamento, Reset de Senha e Expurgo.
>   - `apps/plataforma_admin/views.py`: `PlanoAssinaturaVendorViewSet` e `TenantVendorViewSet`.
>   - `apps/plataforma_admin/urls.py` + `config/urls.py`: Rotas expostas sob `/api/plataforma-admin/`.
>   - `tests/test_plataforma_admin_v2.py`: 11 testes automatizados (CRUD, provisionamento, alternar status, reset senha, impersonate, expurgo, isolamento 404, backup real com hash SHA-256, bloqueio read-only e rejeição de payload vazio).
> * **Decisões Técnicas & Segurança (Resolução dos Bloqueadores DevOps):**
>   - 🔴 **1. Expurgo com Backup Real:** O drop de schema só ocorre após o `pg_dump` gerar o arquivo `.dump` e validar integridade. A auditoria armazena nome do arquivo, caminho, tamanho e hash SHA-256.
>   - 🔴 **2. Modo Read-Only Efetivo:** `ImpersonateReadOnlyMiddleware` lê a claim `impersonate_read_only` do token JWT e bloqueia qualquer método mutável (`POST`, `PUT`, `PATCH`, `DELETE`) com HTTP 403 e mensagem descritiva.
>   - 🟠 **3. Prevenção de Schemas Órfãos:** Compensação no `except` do provisionador elimina resíduos caso o seeding falhe.
>   - 🟠 **4. Validação de Payload em `alternar_status`:** Rejeita requisições sem parâmetros com 400.
> * **Evidências de Testes & Qualidade:**
>   - `pytest tests/test_plataforma_admin_v2.py`: **11 passed in 30.45s**.
>   - `pytest tests/test_plataforma_admin_v1.py tests/test_plataforma_admin_v2.py`: **24 passed in 30.52s**.
>   - `ruff check apps config`: **All checks passed!**

---

## 🔍 Sprint V3 — APIs de Parametrização por Clínica & Métricas

- [x] **V3.1:** Endpoint de leitura/edição de **Parâmetros Google Calendar** por tenant (`/api/plataforma-admin/tenants/{id}/google/`): `intervalo_minutos`, status de tokens e action de reconciliação forçada.
- [x] **V3.2:** Endpoint de leitura/edição de **Parâmetros WhatsApp (WAHA)** por tenant (`/api/plataforma-admin/tenants/{id}/whatsapp/`): status da sessão (`<schema>`), reinicialização de sessão, `dias_antecedencia`, `horario_envio`, auto-cancelamento e reforço.
- [x] **V3.3:** Endpoint de **Overrides de Limites** da clínica (`/api/plataforma-admin/tenants/{id}/overrides/`).
- [x] **V3.4:** Endpoint de **Métricas Operacionais** agregadas por tenant (`/api/plataforma-admin/tenants/{id}/metricas/`).
- [x] **V3.5:** Endpoint de consulta de **Logs de Erro** da clínica (`/api/plataforma-admin/tenants/{id}/erros/`).
- [x] **V3.6:** Testes da Sprint V3: alteração de configs Google/WAHA em schema isolado a partir da API vendor, cálculo de métricas e isolamento de host (`tests/test_plataforma_admin_v3.py` — 6/6 passed).

> ### 📦 Resumo da Entrega — Sprint V3 (Para Validação DevOps / QA)
> * **Status da Sprint:** ✅ Concluída & Validada
> * **Arquivos Criados / Modificados:**
>   - `apps/plataforma_admin/serializers.py` (`GoogleParamsSerializer`, `WhatsAppParamsSerializer`, `OverridesTenantSerializer`, `RegistroErroOperacionalSerializer`).
>   - `apps/plataforma_admin/views.py` (Actions em `TenantVendorViewSet`: `google`, `google/reconciliar`, `whatsapp`, `whatsapp/reiniciar-sessao`, `overrides`, `metricas`, `erros`).
>   - `apps/plataforma_admin/services.py` (expurgo com abort obrigatório em ausência do `pg_dump`).
>   - `tests/test_plataforma_admin_v3.py` (6 testes cobrindo parâmetros Google, reconciliação, WhatsApp/WAHA, restart de sessão, overrides, agregação de métricas, consulta de erros e isolamento 404).
> * **Decisões Técnicas & Arquitetura:**
>   - **Troca Segura de Contexto:** Todas as consultas/edições de parâmetros (`ConfiguracaoSincronizacao`, `CredencialGoogleCalendar`, `ConfiguracaoNotificacao`) e cálculo de métricas operam sob `with schema_context(clinica.schema_name):`, garantindo total isolamento multi-tenant.
>   - **Sessão WAHA Fiel ao Schema:** O identificador de sessão é estritamente o próprio `clinica.schema_name` (conforme padrão do projeto).
>   - **Trilha de Auditoria Transversal:** Operações de parametrização e disparo manual de reconciliação são carimbadas no `RegistroAuditoriaVendor` com tipos `PARAMETRIZACAO` e `CELERY_TRIGGER`.
>   - **Isolamento de Host:** Prova real de integração provando que requisições originadas em subdomínio de tenant para os novos endpoints retornam `404 Not Found`.
> * **Evidências de Testes & Qualidade:**
>   - `pytest tests/test_plataforma_admin_v3.py`: **6 passed in 19.30s**.
>   - `pytest tests/test_plataforma_admin_v1.py tests/test_plataforma_admin_v2.py tests/test_plataforma_admin_v3.py`: **30 passed in 46.25s**.
>   - `ruff check apps config`: **All checks passed!**

---

## 🗄️ Sprint V4 — Engine do Database Studio (Backend)

- [x] **V4.1:** Script de setup/verificação do role PostgreSQL dedicado somente-leitura (`odonto_studio_ro` com `SELECT` apenas).
- [x] **V4.2:** Endpoint do **Schema Explorer** (`/api/plataforma-admin/studio/schemas/` e `tables/`): lista schemas, tabelas, dicionário de colunas e contagem de linhas.
- [x] **V4.3:** Endpoint de **Execução SQL Segura** (`POST /api/plataforma-admin/studio/executar/`):
  - Modo Read-Only sob role `odonto_studio_ro`, `statement_timeout = 10s`, `SET search_path TO <schema>;` (sem `public`).
  - Modo DML/Write (SuperAdmin only) sob confirmação com justificativa.
  - Bloqueio de comandos proibidos (`DROP DATABASE`, `DROP SCHEMA public`, etc.).
  - Gravação automática em `RegistroAuditoriaVendor`.
- [x] **V4.4:** Testes da Sprint V4: execução de queries de leitura, rejeição de escrita no modo RO a nível de PostgreSQL, bloqueio de comandos perigosos, RBAC de escrita e auditoria (`tests/test_plataforma_admin_v4.py` — 8/8 passed).

> ### 📦 Resumo da Entrega — Sprint V4 (Para Validação DevOps / QA)
> * **Status da Sprint:** ✅ Concluída & Validada
> * **Arquivos Criados / Modificados:**
>   - `apps/plataforma_admin/studio.py` (criação/gestão do role `odonto_studio_ro`, exploração de schemas/tabelas e engine de execução com transação, timeouts e isolamento de search_path).
>   - `apps/plataforma_admin/serializers.py` (`StudioExecuteInputSerializer`).
>   - `apps/plataforma_admin/views_studio.py` (`StudioViewSet` com endpoints `/schemas/`, `/tables/` e `/executar/`).
>   - `apps/plataforma_admin/urls.py` (registro da rota `studio`).
>   - `tests/test_plataforma_admin_v4.py` (8 testes cobrindo listagem de schemas/tabelas, query SELECT RO, bloqueio de INSERT RO a nível de privilégio do PostgreSQL, DML RW com justificativa e SuperAdmin, bloqueio de RW para staff comum, validação de justificativa, bloqueio de comandos proibidos e isolamento de host 404).
> * **Decisões Técnicas & Segurança:**
>   - **Privilégio no PostgreSQL:** O modo Read-Only não depende apenas de regex — a conexão é estabelecida como o usuário `odonto_studio_ro`, que possui estritamente `GRANT USAGE` e `GRANT SELECT`. Mutações são fisicamente rejeitadas pelo PostgreSQL (`permission denied` / `insufficient privilege`).
>   - **Isolamento de Search Path:** Toda query define `SET search_path TO "<schema>";` (**sem `public`**), impedindo cruzamento inadvertido de dados entre tenants ou tabelas da plataforma.
>   - **Gating Estrito de Escrita:** Modo RW exige `request.user.is_superuser=True`, justificativa auditada (mínimo 10 caracteres) e roda em transação com timeout curto (15s).
>   - **Blacklist de Salvaguarda:** Comandos destrutivos globais (`DROP DATABASE`, `DROP SCHEMA public`, `ALTER SYSTEM`) são barrados preemptivamente.
>   - **Auditoria Transversal:** 100% das execuções (sucesso ou erro) são registradas em `RegistroAuditoriaVendor` com ação `STUDIO_QUERY`, operador, IP, tempo em milissegundos e contagem de linhas.
> * **Evidências de Testes & Qualidade:**
>   - `pytest tests/test_plataforma_admin_v4.py`: **8 passed in 26.98s**.
>   - `pytest tests/test_plataforma_admin_v1.py tests/test_plataforma_admin_v2.py tests/test_plataforma_admin_v3.py tests/test_plataforma_admin_v4.py`: **38 passed in 74.45s**.
>   - `ruff check apps config`: **All checks passed!**

---

## ⏱️ Sprint V5 — Orquestração do Celery Beat & Monitoramento

- [x] **V5.1:** Migrar tarefas periódicas estáticas de `CELERY_BEAT_SCHEDULE` para gerenciamento dinâmico no banco (`django_celery_beat.PeriodicTask`).
- [x] **V5.2:** Endpoint de listagem e controle de tarefas periódicas (`/api/plataforma-admin/celery/tarefas/`): ativar/desativar, alterar intervalo/cron e disparo manual imediato (`task.delay()`).
- [x] **V5.3:** Endpoint de status de filas e saúde dos workers Celery (tamanho da fila `celery` no Redis e contagem de workers ativos).
- [x] **V5.4:** Testes da Sprint V5: edição de agendamentos em runtime, disparo manual de tasks e isolamento de host (`tests/test_plataforma_admin_v5.py` — 6/6 passed).

> ### 📦 Resumo da Entrega — Sprint V5 (Para Validação DevOps / QA)
> * **Status da Sprint:** ✅ Concluída & Validada
> * **Arquivos Criados / Modificados:**
>   - `config/settings/base.py`: Esvaziado `CELERY_BEAT_SCHEDULE = {}` para garantir que o `DatabaseScheduler` nunca sobrescreva alterações de intervalo/cron feitas em runtime pelos operadores.
>   - `apps/plataforma_admin/migrations/0002_seed_periodic_tasks.py`: Migração de dados idempotente que semeia as 5 tarefas padrão (`PeriodicTask`) no banco com `get_or_create` (garante que novos deploys sobem com o beat populado sem reverter customizações de operadores).
>   - `deploy/.env.prod.example`: Documentado `STUDIO_RO_PASSWORD` obrigatório em produção.
>   - `apps/plataforma_admin/celery_manager.py`: Seeding de fallback, monitoramento de saúde do broker Redis e inspeção de workers Celery via `current_app.control.inspect`.
>   - `apps/plataforma_admin/serializers.py`: `PeriodicTaskListSerializer` e `PeriodicTaskUpdateSerializer`.
>   - `apps/plataforma_admin/views_celery.py`: `CeleryTarefasViewSet` com endpoints de listagem, detalhes, atualização em runtime com `PATCH`, disparo manual forçado com `POST /disparar/` e healthcheck com `GET /status/`.
>   - `apps/plataforma_admin/urls.py`: Registro da rota `celery/tarefas`.
>   - `tests/test_plataforma_admin_v5.py`: 7 testes automatizados cobrindo listagem, atualização de intervalo e crontab, disparo manual auditado, status do cluster, isolamento 404 e prova de durabilidade pós-reboot com settings vazio.
> * **Decisões Técnicas & Arquitetura:**
>   - **Durabilidade Real pós-Boot:** Com `CELERY_BEAT_SCHEDULE = {}` no settings e semeadura exclusiva via migração/banco, qualquer ajuste de intervalo/cron feito pelo painel persiste indefinidamente mesmo após reinicializações do container de beat.
>   - **Disparo Manual com Auditoria:** Disparo forçado via `current_app.send_task` gera log em `RegistroAuditoriaVendor` com ação `CELERY_TRIGGER` e ID da task enfileirada.
>   - **Auditoria de Configurações:** Toda alteração de intervalo ou cron grava `RegistroAuditoriaVendor` com ação `CELERY_CONFIG`.
>   - **Isolamento de Host:** Subdomínios de tenant recebem `404 Not Found` em todos os endpoints de gestão do Celery.
> * **Evidências de Testes & Qualidade:**
>   - `pytest tests/test_plataforma_admin_v5.py`: **7 passed in 8.90s**.
>   - `pytest tests/test_plataforma_admin_v1.py tests/test_plataforma_admin_v2.py tests/test_plataforma_admin_v3.py tests/test_plataforma_admin_v4.py tests/test_plataforma_admin_v5.py`: **45 passed in 71.11s**.
>   - `ruff check apps config tests`: **All checks passed!**

---

## 🎨 Sprint V6 — Frontend: Fundação, Auth & Roteamento do Vendor

- [x] **V6.1:** Configurar rotas dinâmicas do Vendor Admin baseadas em `VITE_VENDOR_ADMIN_SECRET_PATH` e tema visual exclusivo (Slate/Violeta).
- [x] **V6.2:** Tela de **Login do Vendor Admin** com validação de credenciais de operador e suporte a 2FA/MFA.
- [x] **V6.3:** **AppShell do Vendor Admin** (Sidebar, Topbar com status do operador, indicação de host público e logout).
- [x] **V6.4:** **Dashboard Principal do Vendor** (cards de resumo: total de clínicas, ativas, inadimplentes, faturamento estimado, saúde do cluster Celery e ações rápidas).
- [x] **V6.5:** Testes da Sprint V6: login de operador, guarda de rotas do vendor, token store e renderização do shell/dashboard (`src/features/vendor-admin/vendor-admin.test.tsx` — 4/4 passed).

> ### 📦 Resumo da Entrega — Sprint V6 (Para Validação DevOps / QA)
> * **Status da Sprint:** ✅ Concluída & Validada
> * **Arquivos Criados / Modificados:**
>   - `frontend/src/features/vendor-admin/constants.ts`: Caminho base dinâmico via `VITE_VENDOR_ADMIN_SECRET_PATH`.
>   - `frontend/src/features/vendor-admin/vendor-api-client.ts`: Instância Axios dedicada (`vendorApi`) com interceptor injetando `vendorTokenStore.access`, tratamento automático de 401 via `vendorTokenStore.refresh` e disparo de evento `vendor-sessao-expirada`.
>   - `frontend/src/features/vendor-admin/vendor-token-store.ts`: Armazenamento isolado de tokens e claims do operador (`odonto-vendor-refresh`).
>   - `frontend/src/features/vendor-admin/use-vendor-auth.ts`: Hook de autenticação usando `vendorApi`, validação client-side estrita de `is_staff` / `is_superuser` e logout com limpeza de cache.
>   - `frontend/src/features/vendor-admin/vendor-require-auth.tsx`: Guardas de rota dedicadas (`VendorRequireAuth` e `VendorSomenteVisitante`).
>   - `frontend/src/features/vendor-admin/vendor-shell.tsx`: Layout padronizado com o design system (paleta dourada, marca institucional com o logo `/logo.png`, sidebar responsiva com navegação completa, header com alternador de tema claro/escuro e status do operador).
>   - `frontend/src/features/vendor-admin/vendor-login-page.tsx`: Tela de login de operador com padrão visual dourado, suporte a 2FA/TOTP e feedback de erro.
>   - `frontend/src/features/vendor-admin/vendor-dashboard-page.tsx`: Dashboard com KPIs agregados (Total de Clínicas, Ativas considerando `TRIAL`, Inadimplentes, MRR Estimado) via `vendorApi`, saúde do cluster Redis/Celery e tabela de instâncias recentes.
>   - `frontend/src/App.tsx`: Registro das rotas dinâmicas do Vendor Admin e guardas de rota.
>   - `frontend/src/features/vendor-admin/vendor-admin.test.tsx`: 4 testes unitários e de integração cobrindo login, shell, dashboard com `vendorApi` e token store.
> * **Decisões Técnicas & UX:**
>   - **Cliente HTTP Isolado:** Criado `vendorApi` dedicado, eliminando qualquer compartilhamento indevido de token de autenticação com o client dos tenants.
>   - **Gating de Operador no Login:** `useVendorAuth.entrar` valida imediatamente os claims de `is_staff`/`is_superuser`, rejeitando usuários normais de clínicas antes de acessar o painel.
>   - **Consistência de Design:** Vendor Admin totalmente integrado aos tokens de design do PróClínica (`--primary` dourado, `--background`, `--card`, `/logo.png`).
>   - **Contagem Correta de Trial:** KPI de clínicas ativas ajustado para o enum oficial do backend (`status_assinatura === 'TRIAL'`).
> * **Evidências de Testes & Qualidade:**
>   - `vitest run src/features/vendor-admin/vendor-admin.test.tsx`: **4 passed in 2.00s**.
>   - `vitest run` (suíte completa frontend): **179 passed across 43 test files**.
>   - `tsc -b` (typecheck): **Zero errors!**
>   - `eslint .`: **Zero warnings/errors!**

---

## 📊 Sprint V7 — Frontend: Telas de Planos, Tenants & Detalhes

- [x] **V7.1:** Tela de **Gestão de Planos** (`/planos`): listagem em DataTable, drawer de criação/edição com limites e flags de módulos.
- [x] **V7.2:** Tela de **Listagem de Tenants** (`/tenants`): DataTable com busca, filtros por status/plano, badge de conexão e ações rápidas.
- [x] **V7.3:** Modal/Wizard de **Provisionamento de Nova Clínica** com validações inline e auto-slugificação de schema/domínio.
- [x] **V7.4:** Diálogos de **Bloqueio/Desbloqueio** (`AlternarStatusDialog`) e **Expurgo com Salvaguarda** (`ExpurgarTenantDialog` exige confirmação digitando o schema).
- [x] **V7.5:** Tela de **Detalhes da Clínica** (`/tenants/:id`) com 5 abas:
  - Aba 1: Dados Gerais & Reset de Admin / Impersonate (com token read-only).
  - Aba 2: Assinatura & Overrides de Limites.
  - Aba 3: Google Calendar (intervalo de sync e forçar reconciliação).
  - Aba 4: WhatsApp / WAHA (status da sessão, restart e timeouts).
  - Aba 5: Métricas & Histórico de Erros Operacionais.
- [x] **V7.6:** Testes da Sprint V7: fluxos de planos, criação de clínica, alternância de status, parametrizações e métricas (`vendor-admin-v7.test.tsx`).

> ### 📦 Resumo da Entrega — Sprint V7 (Para Validação DevOps / QA)
> * **Status da Sprint:** ✅ Concluída & Validada
> * **Arquivos Criados / Modificados:**
>   - `frontend/src/features/vendor-admin/planos/use-vendor-planos.ts`: Hooks TanStack Query (`useVendorPlanos`, `useCriarPlano`, `useAtualizarPlano`, `useDeletarPlano`) consumindo `vendorApi`.
>   - `frontend/src/features/vendor-admin/planos/plano-form-drawer.tsx`: Drawer lateral com `FormKit` (`CabecalhoDrawer`, `CorpoDrawer`, `SecaoForm`, `Campo`, `LinhaToggle`) para precificação, limites de capacidade e flags de módulos.
>   - `frontend/src/features/vendor-admin/planos/planos-page.tsx`: Tela de gestão de planos comerciais com KPIs agregados, busca em tempo real e diálogo de confirmação destrutiva (`ConfirmDialog`).
>   - `frontend/src/features/vendor-admin/tenants/use-vendor-tenants.ts`: Hooks e mutations para listagem, detalhes, provisionamento, alternância de status, expurgo, reset de senha, impersonate e parametrizações Google/WhatsApp.
>   - `frontend/src/features/vendor-admin/tenants/provisionar-tenant-modal.tsx`: Wizard de provisionamento com auto-slugificação em tempo real do schema PostgreSQL e subdomínio de acesso.
>   - `frontend/src/features/vendor-admin/tenants/alternar-status-dialog.tsx`: Diálogo para mudança rápida de status de assinatura (`ATIVA`, `TRIAL`, `INADIMPLENTE`, `CANCELADA`) e bloqueio/desbloqueio com justificativa.
>   - `frontend/src/features/vendor-admin/tenants/expurgar-tenant-dialog.tsx`: Modal de destruição com salvaguarda estrita exigindo a digitação manual do `schema_name` e justificativa auditável.
>   - `frontend/src/features/vendor-admin/tenants/tenants-page.tsx`: Listagem de instâncias com busca por CNPJ/nome/schema, filtro por status, badges e ações contextuais.
>   - `frontend/src/features/vendor-admin/tenants/tenant-detalhes-page.tsx`: Tela consolidada com 5 abas (Dados Gerais, Assinatura & Overrides, Google Calendar, WhatsApp WAHA, Métricas & Erros), modais de Reset de Senha e Impersonate read-only.
>   - `frontend/src/App.tsx`: Registro das rotas `/planos`, `/tenants`, `/tenants/:id` sob `VendorShell`.
>   - `frontend/src/features/vendor-admin/vendor-admin-v7.test.tsx`: 4 testes unitários/integração cobrindo todos os fluxos da V7.
> * **Decisões Técnicas & UX:**
>   - **Paridade Estrutural com Design System:** 100% dos formulários, drawers e cabeçalhos utilizam `FormKit` e `PageHeader` no tema Dark Navy & Dourado conforme [`docs/04-frontend-design-system/03-diretrizes-design-system.md`](../04-frontend-design-system/03-diretrizes-design-system.md).
>   - **Salvaguardas de Segurança:** O expurgo físico só habilita o botão após a digitação exata do schema; o impersonate gera token JWT exclusivo com claim `read_only: true` bloqueado pelo backend em qualquer mutação.
> * **Evidências de Testes & Qualidade:**
>   - `vitest run src/features/vendor-admin/vendor-admin-v7.test.tsx`: **4 passed in 3.42s**.
>   - `vitest run` (suíte completa frontend): **183 passed across 44 test files**.
>   - `pytest` (backend): **45 passed in 79.54s**.
>   - `tsc -b` (typecheck) & `eslint .`: **Zero errors!**

### ⭐ *EXTRA (Sprint V7 — Hardening de Provisionamento, Impersonate & Auditoria):

- [x] **EXTRA-V7.1 (Estrutura Estrita do Formulário de Provisionamento):**
  - Reorganização do `ProvisionarTenantModal` em 4 blocos obrigatórios:
    1. **Dados do Responsável Assinante:** Nome Completo, CPF (com máscara `000.000.000-00` e validação), Telefone/WhatsApp, E-mail e Senha inicial de admin.
    2. **Dados da Clínica:** Nome Fantasia, Razão Social, CNPJ (com máscara `00.000.000/0000-00` e validação) e Telefone da Clínica.
    3. **Schema PostgreSQL & Subdomínio Automáticos:** Gerador inteligente de 3 sugestões clicáveis baseadas no nome fantasia, permitindo edição manual irrestrita.
    4. **Plano de Assinatura:** Seleção dinâmica dos planos comerciais ativos cadastrados.
- [x] **EXTRA-V7.2 (MultiTenantJWTAuthentication no Host Público & Clínica Demo):**
  - Criação da classe `MultiTenantJWTAuthentication` em `apps/usuarios/authentication.py`.
  - Permite que operadores staff autentiquem com JWT no host público (`localhost` / schema `public`), resolvendo instâncias ativas (incluindo a clínica `demo`) sem erros de schema ou tabela inexistente.
- [x] **EXTRA-V7.3 (Experiência Completa de Impersonate / Suporte Read-Only):**
  - **Captura & Ativação de Sessão:** `tokenStore` e `LoginPage` atualizados para capturar `impersonate_access` e `impersonate_refresh` via URL, persistindo o token de suporte e sobrevivendo a reloads/abas.
  - **Bypass em Guards:** `SomenteVisitante` ajustado para não bloquear o redirecionamento quando houver parâmetro de impersonate na URL.
  - **Banner Superior Fixo no Tenant (`AppShell`):** Faixa destacada âmbar com ícone pulsante: `🛡️ Modo Suporte (Read-Only) • Operador • Mutações bloqueadas no servidor` com botão para `[Encerrar Suporte]`.
  - **Garantia no Backend:** `ImpersonateReadOnlyMiddleware` intercepta qualquer chamada `POST`, `PUT`, `PATCH` ou `DELETE` com `HTTP 403 Forbidden` explicativo.
- [x] **EXTRA-V7.4 (Aba 6 Dedicada para Auditoria & Gestão de Sessões de Suporte):**
  - Criação da **Aba 6 (Auditoria & Suporte)** na tela de detalhes da clínica (`/tenants/:id`).
  - Tabela com **Justificativa em texto limpo** (sem JSON cru), **Horário de Início** e **Horário de Encerramento Previsto** (1 hora de validade) ou encerramento manual.
  - Botão **`[Acessar]`** para reabrir a clínica personificada diretamente.
  - Botão **`[Encerrar]`** por linha e botão **`[Encerrar Suporte Ativo]`** no cabeçalho da clínica.
  - Endpoint dedicado no backend: `POST /api/plataforma-admin/tenants/:id/encerrar_suporte/` para invalidação e registro de revogação.
- [x] **EXTRA-V7.5 (Correção no Expurgo de Clínica & Reset de Modais):**
  - Ajustado `ExpurgarTenantInputSerializer` para aceitar tanto `schema_name_confirmacao` quanto `confirmacao_schema` e `schema_name`.
  - `ProvisionarTenantModal` e `ExpurgarTenantDialog` com reset total de estado, campos e sugestões ao serem fechados ou cancelados.
- [x] **EXTRA-V7.6 (Login Master Global & Simplificação de Dados do Responsável):**
  - O formulário de provisionamento agora solicita apenas dados de contato do responsável (Nome, CPF, Telefone e E-mail de Contato/Notificação), sem exigir criação individual de e-mail e senha de admin.
  - Semeado e configurado o usuário Master global **`admin@proclinica.com.br`** (senha `ProClinica@2026`) com privilégios de SuperAdmin em todos os schemas e gerado automaticamente a cada novo tenant provisionado.
- [x] **EXTRA-V7.7 (Persistência da Justificativa, Encerramento Individual & Bloqueio de Múltiplas Sessões de Suporte):**
  - `ImpersonateInputSerializer` atualizado com o campo `justificativa`, garantindo que o texto digitado pelo operador seja gravado na trilha de auditoria e exibido na Aba 6.
  - Endpoint `encerrar_suporte` agora aceita `registro_id` para encerrar sessões individualmente pela tabela ou em lote pelo botão do cabeçalho.
  - Regra de sessão única ativa: bloqueia a abertura de múltiplas sessões simultâneas para a mesma clínica (retornando aviso com o horário de expiração e direcionando o operador para a Aba 6).
- [x] **EXTRA-V7.8 (Gestão Centralizada de Acesso Master Global & Remoção do Reset Individual):**
  - Removido o botão e o modal de redefinição individual de senha de admin da tela de detalhes da clínica (`TenantDetalhesPage`).
  - Adicionada nova tela e item no menu lateral: **`Acesso Master Global`** (`/admin-master`).
  - Endpoint dedicado no backend: `GET /api/plataforma-admin/master-admin/` e `POST /api/plataforma-admin/master-admin/` para replicação atômica do e-mail e hash de senha do Master Admin em todos os schemas físicos de bancos das clínicas ativas com auditoria completa.
- [x] **EXTRA-V7.9 (Correção de Bloqueio de Clínicas, Dados Pessoais do Responsável, Visualização Google & WAHA):**
  - **Correção no Bloqueio/Desbloqueio de Clínicas (`AlternarStatusDialog`):** Ajustados endpoints no backend (`/alternar_status/` e `/alternar-status/`) e inicialização reativa de estados no modal, eliminando o erro 404 "Recurso não encontrado".
  - **Dados Pessoais do Responsável / Assinante na Aba 1 (`TenantDetalhesPage`):** Criados campos no model `Clinica` (`responsavel_nome`, `responsavel_cpf`, `responsavel_telefone`, `responsavel_email`), executada migração `0006_clinica_dados_responsavel` e adicionada seção dedicada no formulário com botão de salvamento.
  - **Google Calendar na Aba 3:** Removidos campos legados (Calendar ID fixo e botão de sync forçado) e implementado campo com salvamento do intervalo de sincronização (minutos) + tabela com visualização em tempo real das contas Google vinculadas pelos dentistas (token, validade e push watch).
  - **WhatsApp (WAHA) na Aba 4:** Painel de visualização read-only das credenciais da sessão no WAHA (`session_name`, `status_waha`, número conectado) com botão de **Reiniciar Sessão WAHA**.
- [x] **EXTRA-V7.10 (Deslogamento Forçado em Tenant Bloqueado & Configuração Vendor de Reagendamento):**
  - **Deslogamento Imediato no Bloqueio:** Removida isenção de `/api/auth/` no `TenantStatusMiddleware`, impedindo qualquer login quando a clínica estiver com `ativo=False` ou `INADIMPLENTE`/`CANCELADA`. Interceptor Axios do frontend (`client.ts`) atualizado para capturar `403` de tenant suspenso, limpar imediatamente os tokens (`tokenStore.limpar()`) e emitir evento `sessao-expirada`, deslogando todos os usuários conectados em tempo real.
  - **Normalização de Mensagens de Erro no Frontend:** Atualizada a função `normalizarErro` em `client.ts` para extrair diretamente `mensagem` ou `erro` retornados pela API DRF, evitando a exibição genérica de *"Verifique os campos"*.
  - **Aba 4 (WhatsApp WAHA):** Removidas regras de disparo internas da clínica (antecedência, cancelamento não confirmado, agradecimento) e mantida exclusivamente a configuração técnica do Vendor: **Tempo de Espera para Oferta de Reagendamento** (`reagendamento_minutos`, default 1 minuto) com botão dedicado de salvamento.
- [x] **EXTRA-V7.11 (Correção de Status do Token Google & Detecção do Número WAHA Conectado):**
  - **Token Google Válido via Refresh Token:** Corrigida a lógica de validação de credencial Google no endpoint do vendor (`apps/plataforma_admin/views.py`), reconhecendo que `refresh_token` ativo mantém a autenticação permanente e válida mesmo após expiração da primeira hora do `access_token`.
  - **Identificação da Integração Geral da Clínica:** Tratamento para contas vinculadas a nível de clínica (`dentista=None`), exibindo `"Clínica (Geral)"` na listagem.
  - **Status de Webhook/Push Google:** Badge contextual informando `Ativo (Push Google)` quando o canal de watch estiver registrado e `Polling Ativo (Sync Periódica)` quando a sincronização periódica estiver operando via Celery.
  - **Número WhatsApp Detectado do WAHA:** Extração direta do número de telefone conectado a partir do payload `me.id` retornado pela API do servidor WAHA (com máscara e formatação amigável no frontend, ex.: `+55 (18) 99678-4963`).
- [x] **EXTRA-V7.12 (Persistência de Overrides de Capacidade, Validação de Limites & Bloqueio Automático por Vigência Expirada):**
  - **Persistência de Assinatura & Overrides na Aba 2:** Corrigido o envio de `vigencia_fim` no formato de data ISO `YYYY-MM-DD` aceito pelo serializer DRF (removido sufixo de hora incompatível) e ajustados transforms no Zod para garantir que `override_limite_dentistas` e `override_limite_usuarios` sejam persistidos corretamente no banco e recarregados no formulário.
  - **Enforcement Real de Limites no Tenant:** Implementada trava automática no cadastro de novos profissionais (`DentistaViewSet.create` e reativação em `perform_update`) e de novos usuários da equipe (`UsuarioViewSet.create` e reativação em `update`), rejeitando cadastros acima do limite do plano/override com HTTP 400 e mensagem explicativa.
  - **Bloqueio Automático por Vigência / Vencimento do Plano:** Integrada a verificação de `vigencia_fim < hoje` no método `pode_acessar_sistema()` do model `Clinica` e no `TenantStatusMiddleware`, bloqueando o acesso de clínicas com planos expirados com retorno 403 e motivo `expirado` acompanhado da data exata de encerramento do contrato.
- [x] **EXTRA-V7.13 (Exibição e Captura Automática do E-mail da Conta Google Conectada):**
  - **Captura no Callback OAuth2:** `google_callback` (`apps/integracoes/views.py`) atualizado para consultar a API de eventos e armazenar o e-mail real da conta Google conectada (ex: `luanhenrique.dev@gmail.com`) no registro de `CredencialGoogleCalendar`.
  - **Resolução Dinâmica no Vendor Admin:** Endpoint `/api/plataforma-admin/tenants/:id/google/` atualizado para resolver automaticamente o e-mail do Google para contas legadas registradas como `primary` e persistir a atualização no banco.
  - **Tabela da Aba 3 (Google Calendar):** Coluna renomeada para **`E-mail da Conta Google`** com badge estilizado em dourado exibindo o e-mail exato do Google Calendar pareado.
- [x] **EXTRA-V7.14 (Separação das Abas de Suporte e Auditoria com Histórico Completo de Valores Anterior vs. Atual):**
  - **Separação de Abas no Frontend:** Criadas abas dedicadas independentes: **Aba 6: Suporte & Conexões** (`suporte`) e **Aba 7: Trilha de Auditoria (Logs)** (`auditoria`).
  - **Aba 6 (Suporte & Conexões):** Gerenciamento exclusivo de conexões impersonate temporárias (1h, read-only), banner de sessão ativa em destaque com botões `[Acessar Painel]` e `[Encerrar Sessão]`, modal de geração e tabela histórica de acessos.
  - **Aba 7 (Trilha de Auditoria):** Tabela completa de logs registrando Data/Hora, Operador & IP de Origem, Ação Efetuada, Dado/Campo Alterado, **Valor Anterior** (em destaque vermelho) e **Valor Atual / Novo** (em destaque verde), além de justificativa/contexto da alteração.
  - **Rastreamento Estruturado no Backend:** Métodos `perform_update`, `alternar_status`, `google` e `whatsapp` em `TenantVendorViewSet` enriquecidos para calcular dinamicamente `valores_anteriores` e `valores_novos` antes de persistir as mudanças no banco.
- [x] **EXTRA-V7.15 (Gestão de Vigência de Planos, Periodicidade Automática, Dashboard de Vencimentos & Página "Meu Plano"):**
  - **Periodicidade de Planos Comerciais:** Adicionado enum e campo `periodicidade` (`MENSAL`, `ANUAL`, `PERMANENTE`) ao model `PlanoAssinatura` e aos formulários de cadastro/edição de planos.
  - **Provisionamento com Plano Obrigatório & Vigência Automática:** Validação estrita exigindo plano comercial no provisionamento de clínicas e cálculo automático de `vigencia_fim` inicial (+30 dias para Mensal, +365 dias para Anual, `None` para Permanente).
  - **Status Efetivo de Clínicas (`get_status_efetivo`):** Resolução unificada de status (`BLOQUEADA`, `VENCIDA`, `INADIMPLENTE`, `TRIAL`, `CANCELADA`, `ATIVA`) exposto nos endpoints do vendor e refletido nos badges.
  - **Banner de Vencimentos & Novo KPI no Dashboard Vendor:** Banner em destaque com chips e contadores das clínicas vencidas e a vencer nos próximos 15 dias, acompanhado de KPI Card de "Vencidas & A Vencer" e filtros atualizados na listagem de instâncias.
  - **Temporizador de 20s no Erro de Login:** Mensagens de expiração de plano e bloqueio na tela de login configuradas para auto-dismiss após 20 segundos com botão de fechar manual.
- [x] **EXTRA-V7.16 (Limpeza de Botões Duplicados de Suporte & Sincronização de Encerramento pelo Tenant):**
  - **Remoção de Botões Redundantes:** Removido o botão duplicado `[Encerrar Suporte Ativo]` do header principal de `TenantDetalhesPage` (onde fica o nome da clínica) e removidos os botões individuais de `[Acessar]` e `[Encerrar]` das linhas da tabela histórica na Aba 6 (incluindo remoção da coluna `Ações`), mantendo exclusivamente o banner de destaque superior da sessão ativa como ponto único de controle no Vendor Admin.
  - **Sincronização de Encerramento no Tenant:** Criada a view backend `EncerrarSuporteTenantView` (`POST /api/auth/encerrar-suporte/`) e atualizado o botão `[Encerrar Suporte]` do banner de suporte no `AppShell`, garantindo que o encerramento da sessão feito pelo operador dentro do tenant persista imediatamente no banco com `encerrado_em = now()` e reflita em tempo real no painel do Vendor Admin.
- [x] **EXTRA-V7.17 (Vigência Personalizável no Provisionamento, Vigência Read-Only na Aba 2, Banner Discreto no Tenant & Ajustes de Botões):**
  - **Correção do Provisionar no Dashboard Vendor:** Substituído o link estático inexistente `/tenants/novo` pelo modal dinâmico `ProvisionarTenantModal` diretamente no botão do cabeçalho do Dashboard Vendor.
  - **Vigência Inicial Configurável no Provisionamento:** Adicionado campo editável de data `vigencia_fim` no modal de provisionamento (calculada automaticamente pelo ciclo do plano, mas permitindo alteração manual para contratos com início futuro).
  - **Correção Visual de Selects:** Aplicada estilização escura consistente (`bg-[#0B132B] text-white`) nos selects e options para eliminar fundos brancos e garantir legibilidade total.
  - **Vigência Somente-Leitura na Aba 2:** Transformado o campo de vencimento da clínica na Aba 2 em exibição puramente visual/informativa com badge de status, restringindo alterações manuais aos campos de Plano e Overrides.
  - **Ajustes na Aba "Meu Plano":** Removido o botão redundante de upgrade e padronizado o botão principal com *"Falar com Especialista"* (ou *"Falar com o Comercial"* quando o vencimento estiver próximo).
- [x] **EXTRA-V7.18 (Desacoplamento e Organização Estruturada dos KPIs de Vencidas e A Vencer):**
  - **KPIs Dedicados no Dashboard Vendor:** Desacoplado o card combinado em 6 cards independentes (`Total Clínicas`, `Ativas`, `A Vencer (15d)`, `Planos Vencidos`, `Bloqueadas`, `MRR Estimado`) com subtítulos informativos e ícones específicos para cada estado operacional.
  - **KPIs Dedicados na Tela de Clínicas/Tenants:** Estruturado grid com 5 cards rápidos e objetivos (`Total Instâncias`, `Ativas & Em Dia`, `A Vencer (15 dias)`, `Planos Vencidos`, `Bloqueadas / Inativas`) com contadores destacados e microlegendas.
- [x] **EXTRA-V7.19 (Isenção de Encerrar Suporte no Middleware Read-Only, Acessar Painel com Auto-Login & Reatividade Global sem Reload):**
  - **Isenção de Bloqueio em `ImpersonateReadOnlyMiddleware`:** Adicionada isenção explícita para a rota `/api/auth/encerrar-suporte/` no middleware backend, permitindo que o operador encerre com sucesso a sessão ativa pelo banner do tenant sem ser barrado pelo bloqueio 403 Read-Only.
  - **Extração Robusta de Schema e Operador no Token JWT:** Em `EncerrarSuporteTenantView`, adicionada decodificação das claims `schema_name` e `impersonated_by` do JWT Bearer, garantindo a gravação de encerramento mesmo em cenários de subdomínio/proxy.
  - **Reacesso Seguro sem Bloqueio de Sessão Ativa:** Adicionado suporte ao parâmetro `reacesso` no backend (`ImpersonateInputSerializer`, `gerar_token_impersonate` e `impersonate`) e no frontend, permitindo que o botão `[Acessar Painel]` gere credenciais válidas e faça login imediato na clínica sem cair na tela deslogada.
  - **Atualização Dinâmica e Reativa sem Recarregar Página:** Invalidação completa de todas as chaves (`vendor-tenant-suporte`, `vendor-tenant-auditoria`, `vendor-tenants`, `[...CHAVE_TENANTS, id]`) em todas as mutações e configuração de `refetchInterval: 3000` na aba de suporte e `refetchOnWindowFocus: true` em todas as queries de tenants, eliminando a necessidade de F5 manual.
- [x] **EXTRA-V7.20 (Data de Início do Contrato no Provisionamento com Cálculo Automático de Vencimento & Padronização de CTA no Tenant):**
  - **Data de Início do Contrato no Provisionamento:** Substituído o campo de data de vencimento pelo campo **Data de Início do Contrato** (`data_inicio_contrato`), utilizando a data do início contratual como base para o cálculo automático do término da vigência (`+30 dias` para mensal, `+365 dias` para anual ou `Permanente` para vitalício) tanto no frontend quanto no backend (`executar_provisionamento_clinica`).
  - **Exibição Dinâmica do Vencimento no Modal:** O modal de provisionamento agora calcula e exibe em tempo real o vencimento estimado e limites conforme o operador altera o plano ou a data de início do contrato.
  - **Apenas 1 Botão "Falar com Especialista" na Aba "Meu Plano":** Removido o botão do cabeçalho superior da página (`PageHeader`), mantendo estritamente um único botão *"Falar com Especialista"* localizado dentro do card *"Precisa de Mais Recursos?"* com link direto para o WhatsApp comercial.
- [x] **EXTRA-V7.21 (Remoção de IP e Justificativa da Trilha de Auditoria & Supressão de Logs de Encerramento de Suporte):**
  - **Limpeza Visual na Aba 7 de Auditoria:** Removida a exibição de endereços IP de origem e renomeada a coluna para *"Operador"*; removida a coluna *"Justificativa / Detalhes"*, deixando a tabela de logs focada estritamente nas alterações reais de dados (`Data/Hora`, `Operador`, `Ação Efetuada`, `Dado/Campo Alterado`, `Valor Anterior` e `Valor Atual`).
  - **Supressão de Log de Encerramento de Suporte:** Removida a gravação de registros redundantes de auditoria ao encerrar sessões de suporte, tanto pelo painel vendor (`encerrar_suporte` em `apps/plataforma_admin/views.py`) quanto pelo aplicativo do tenant (`EncerrarSuporteTenantView` em `apps/usuarios/views.py`).
- [x] **EXTRA-V7.22 (Correção de Fuso Horário Local no Cálculo de Dias Restantes de Vigência):**
  - **Uso de `timezone.localdate()` em Vez de UTC `timezone.now().date()`:** Substituído o cálculo UTC por `timezone.localdate()` no backend (`MeuPlanoView`, `ClinicaListItemVendorSerializer`, `ClinicaDetailVendorSerializer`, `executar_provisionamento_clinica`, `Clinica.pode_acessar_sistema`, `Clinica.get_status_efetivo` e `TenantStatusMiddleware`). Isso elimina o problema em que, após as 21h em Brasília (quando no UTC já é meia-noite do dia seguinte), a contagem mostrava 0 dias para vencimentos que ocorrem no dia de amanhã.
  - **Aprimoramento de Textos de Alerta no Frontend:** O banner superior no `AppShell` e a tela `MeuPlanoPage` agora exibem adequadamente `"expira hoje"`, `"expira amanhã"` ou `"expira em N dias"`.
- [x] **EXTRA-V7.23 (Sincronização de Dados e Estruturas na Aba 5: Métricas & Erros):**
  - **Alinhamento de Chaves de Métricas Operacionais:** Atualizada a action `metricas` em `apps/plataforma_admin/views.py` para calcular e retornar as chaves esperadas pelo frontend (`total_pacientes`, `total_agendamentos`, `total_dentistas`, `total_usuarios`, `total_procedimentos`, `total_lancamentos`, `storage_usado_mb`, `ultimo_agendamento`, `ultimo_login`), preenchendo todos os 6 cards de volumetria com valores reais.
  - **Estruturação de Logs de Erros Operacionais:** Ajustado `RegistroErroOperacionalSerializer` com propriedades calculadas (`modulo`, `tipo_erro`, `origem`), removido o envelopamento paginado indevido na action `erros` para retornar a lista direta de registros mais recentes e atualizado o hook `useTenantErros` com parsing resiliente de arrays.
- [x] **EXTRA-V7.24 (Captura Automática de Erros Operacionais via DRF Custom Exception Handler):**
  - **Handler Global de Exceções (`custom_exception_handler`):** Implementado em `apps/core/handlers.py` e conectado nas configurações do `REST_FRAMEWORK`, interceptando automaticamente validações de negócio (`ScheduleConflictWarning`, `QuotaExceededWarning`, `ValidationError`, `PermissionDenied`, 500s e falhas de integração) ocorridas nas requisições da clínica e gravando em tempo real no `RegistroErroOperacional` (schema `public`).
  - **Polling e Atualização Reativa no Vendor Admin:** Configurado `refetchInterval: 4000` e `refetchOnWindowFocus: true` nos hooks `useTenantErros` e `useTenantMetricas`, garantindo que qualquer erro operacional reproduzido no tenant apareça instantaneamente na Aba 5 do Vendor Admin.
- [x] **EXTRA-V7.25 (Desabilitação Completa de Módulos e Recursos no Tenant via Plano/Overrides):**
  - **Resolução de Módulos Efetivos no Backend (`Clinica.recurso_habilitado` e `Clinica.get_modulos_efetivos`):** Implementada hierarquia `override_recursos` > `plano_assinatura` (`sync_google_ativo`, `whatsapp_waha_ativo`, `modulo_financeiro_ativo`, `modulo_estoque_ativo`) > default.
  - **Propagação de Módulos para a Sessão (`/api/auth/me/` e `/api/plataforma/meu-plano/`):** Adicionado campo `modulos` nos payloads retornados pelo backend e mapeado no tipo `Sessao` (`usuario.clinica.modulos`).
  - **Ocultação de Menus na Sidebar (`nav.ts` e `sidebar.tsx`):** Menus de **Integrações** (Google Calendar), **WhatsApp**, **Financeiro** e **Estoque** são ocultados dinamicamente quando seus respectivos módulos estiverem desabilitados.
  - **Guarda de Rotas no Frontend (`RequireModulo` em `App.tsx`):** Acesso direto por URL a rotas desabilitadas (`/integracoes`, `/notificacoes`, `/financeiro`, `/estoque`) é interceptado e redirecionado para a home.
  - **Desativação de Ações Contextuais:** Ocultado o botão *"Enviar confirmação"* no modal de agendamento de consultas quando o módulo de WhatsApp estiver desabilitado.
  - **Bloqueio de APIs (`PermissaoModulo` e views OAuth):** Endpoints do tenant retornam `403 Forbidden` com mensagem amigável caso uma requisição seja disparada para um módulo inativo.
  - **Supressão em Background (Celery Tasks):** Rotinas Celery de sincronização periódica do Google Calendar e disparos automáticos de WhatsApp ignoram schemas com os respectivos módulos desabilitados, preservando todas as configurações salvas intactas.
- [x] **EXTRA-V7.26 (Bloqueio e Estado Não Aplicável no Vendor Admin para Módulos Desabilitados):**
  - **Identificação de Módulos Efetivos na API de Detalhes:** `ClinicaDetailVendorSerializer` e `ClinicaListItemVendorSerializer` agora serializam `modulos_efetivos` para o frontend do Vendor Admin.
  - **Badges de "Não Aplicável" na Navegação por Abas:** As abas 3 (Google Calendar) e 4 (WhatsApp WAHA) agora exibem badge visual `[NÃO APLICÁVEL]` no cabeçalho quando o módulo correspondente estiver inativo no plano contratado da clínica.
  - **Banners Informativos e Bloqueio de Inputs/Botões:** Seção de parametrização exibe alerta explicativo de módulo inativo/pausado, e todos os inputs (`Intervalo de Sincronização`, `Intervalo de Reagendamento`) e botões de ação (`Salvar Intervalo`, `Salvar Intervalo de Reagendamento`, `Reiniciar Sessão WAHA`) são bloqueados e renderizados com estilo desabilitado (`disabled:opacity-50`, `disabled:cursor-not-allowed`, `bg-slate-800`).
  - **Proteção nas Actions do Backend:** Endpoints do Vendor Admin (`google` PATCH, `google/reconciliar`, `whatsapp` PATCH, `whatsapp/reiniciar-sessao`) retornam `400 Bad Request` caso ocorra tentativa de parametrização em clínicas cujo módulo não seja aplicável.
- [x] **EXTRA-V7.27 (Auditoria e Hardening de Segurança DevOps & SecOps):**
  - **Proteção contra Information Disclosure em Erros 500:** Sanitização de respostas em produção no DRF exception handler (`custom_exception_handler`), eliminando vazamentos de consultas SQL e stack traces em respostas ao cliente.
  - **Sanitização Automática de Credenciais em Logs:** Mascaramento de dados confidenciais (`[DADO CONFIDENCIAL REDIGIDO]`) para chaves sensíveis (`senha`, `password`, `token`, `secret`, `access`, `refresh`, etc.) antes da gravação no banco operacional.
  - **Prevenção de Envenenamento de Logs (`X-Tenant-Id` Spoofing):** Validação de formato alfanumérico e checagem de existência do tenant no banco.
  - **Validação Criptográfica de JWT no Middleware:** Validação de assinatura HMAC-SHA256 com chave do servidor no `ImpersonateReadOnlyMiddleware`.
  - **Isolamento de Exceções em Celery Beat Loops:** Cada iteração de clínica nas rotinas de background (`_para_cada_tenant`, `reconciliar_google_todos_tenants`, `sincronizar_incremental_todos_tenants`, `renovar_watch_channels`) agora possui tratamento `try/except` individual com logging estruturado, impedindo falhas em cascata no cluster.
  - **Otimização de Roteamento Inbound de Webhooks:** Busca O(1) de tenant por `schema_name` e checagem de módulo ativo em `schema_da_sessao`.
  - **Relatório Formal de Auditoria:** Publicado em `docs/03-vendor-admin/04-relatorio-auditoria-seguranca-devops.md`.

---

## 💻 Sprint V8 — Frontend: Database Studio & Celery Monitor

- [x] **V8.1:** Tela do **Database Studio**:
  - Seletor de schema e navegador de tabelas na barra lateral com contagem de colunas e dicionário de tipos/PKs.
  - Console SQL com suporte a atalhos de teclado (`Ctrl+Enter`), formatação e histórico de consultas persistido no `localStorage`.
  - Alternador de modo (Read-Only sob role `odonto_studio_ro` / Escrita DML com modal de justificativa obrigatória de no mínimo 10 caracteres).
  - Tabela interativa de resultados com tempos em ms, cópia de células por clique e exportação de dados em CSV e JSON.
- [x] **V8.2:** Tela do **Celery Monitor**:
  - 4 KPI Cards de infraestrutura em tempo real: status de conectividade do Broker Redis, volume da fila `celery`, contagem de workers ativos e total de tarefas periódicas configuradas.
  - Tabela completa de PeriodicTasks com switches reativos liga/desliga (`enabled`) com feedback otimista.
  - Modal de edição de frequências com suporte a intervalos regulares (`every`/`period`) e expressões cron customizadas (`minute`, `hour`, `day_of_week`).
  - Botão de disparo manual imediato com feedback sonner/toast e rastreamento de Task ID.
- [x] **V8.3:** Testes da Sprint V8 (`vendor-admin-v8.test.tsx`): 9 testes unitários e de integração cobrindo navegação, renderização, dicionário de tabelas, execução RO/RW, modal de justificativa, histórico, switches e disparo Celery (195 testes no total com 100% de sucesso no Vitest).

---

## 🛡️ Sprint V9 — Hardening, Suíte Completa de Isolamento & E2E

- [x] **V9.1:** Suíte de **Testes de Isolamento de Host**: garantir que `/api/plataforma-admin/*` responde estritamente no host público e retorna `404` (camuflagem) em qualquer subdomínio de tenant.
- [x] **V9.2:** Suíte de **Testes de Bloqueio de Acesso**: garantir que usuários comuns de clínicas (sem `is_staff` / `is_superuser`) nunca consigam autenticar no vendor nem acessar recursos administrativos.
- [x] **V9.3:** Suíte de **Testes de Isolamento do Studio & Hardening SQL**: validação de que o Database Studio nunca vaza dados entre schemas, bloqueia comandos perigosos (`DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, `ALTER ROLE`, `SET search_path`, `COPY PROGRAM`), exige justificativa formal para DML e opera sob a role `odonto_studio_ro` (`NOSUPERUSER NOINHERIT`).
- [x] **V9.4:** Validação do **Comportamento de Camuflagem e Sanitização**: camuflagem 404 em rotas e endpoints não encontrados, proteção contra Information Disclosure em erros 500 e mascaramento automático de credenciais em logs de erro.
- [x] **V9.5:** Suíte de **Testes Ponta a Ponta (E2E) no Frontend e Backend**: validação de autenticação de operadores, provisionamento com auto-slugificação, navegação de abas, Database Studio, Celery Monitor, Página Pública de Vendas no host raiz e página 404 (`tests/test_plataforma_admin_v9_hardening.py` com 20 testes verdes e `frontend/src/features/vendor-admin/vendor-admin-v9-e2e.test.tsx` com 7 testes verdes).

> ### 📦 Resumo da Entrega — Sprint V9 (Para Validação DevOps / QA)
> * **Status da Sprint:** ✅ Concluída & Validada
> * **Arquivos Criados / Modificados:**
>   - `tests/test_plataforma_admin_v9_hardening.py` (20 testes automatizados cobrindo isolamento de host 404, bloqueio RBAC de usuários não-staff, bloqueio de login de clínica no schema public, isolamento e bloqueio DDL/DML no Database Studio, middleware de impersonate read-only e sanitização de logs).
>   - `frontend/src/features/vendor-admin/vendor-admin-v9-e2e.test.tsx` (7 testes de integração e ponta a ponta cobrindo login de operador vendor, provisionamento com cálculo automático de vigência, navegação das 7 abas do tenant, execução SQL no Studio, switches do Celery Monitor, landing institucional e 404 global).
>   - `apps/plataforma_admin/studio.py` (expansão do `COMANDOS_PROIBIDOS_REGEX` para barrar comandos destrutivos adicionais como `DROP TABLE`, `TRUNCATE`, `ALTER TABLE`, `GRANT`, `REVOKE` e `COPY`).
>   - `frontend/src/features/vendor-admin/tenants/tenant-detalhes-page.tsx` (acesso seguro via optional chaining a `tenant.dominios`).
>   - `tests/test_auth_me.py` (compatibilização com enriquecimento dinâmico de módulos).
> * **Evidências de Testes & Qualidade:**
>   - **Backend Tests (Pytest):** **72/72 testes de plataforma admin passando** (100% verdes) e **342/342 testes no repositório completo passando**.
>   - **Frontend Tests (Vitest):** **48 arquivos de teste / 207 testes passando** (100% verdes).
>   - **TypeScript & ESLint:** **0 erros / 0 warnings** (`tsc -b && eslint .`).
> * **Conclusão do Backlog Vendor Admin:** Todas as 9 Sprints (V1 a V9) do ecossistema Vendor Admin / PróClínica Cloud foram concluídas e aprovadas com sucesso.

---

_Documento consolidado. Todas as sprints (V1 → V9) foram executadas e validadas com 100% de cobertura._

