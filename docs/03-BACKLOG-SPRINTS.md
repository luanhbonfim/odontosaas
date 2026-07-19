# OdontoSaaS — Backlog de Sprints (Checklist)

> **Fonte de verdade do desenvolvimento.** A cada comando de "iniciar desenvolvimento", trabalha-se
> EXCLUSIVAMENTE na próxima tarefa `- [ ]` (de cima para baixo). Só marcar `- [x]` **após validação do
> usuário**. Toda tarefa de código acompanha testes.
>
> Legenda: `- [ ]` pendente · `- [x]` concluída e validada.
>
> Sprint 0 = infraestrutura (Docker + WAHA + CI/CD). Demais sprints ≈ semanais, focadas em regra
> de negócio.

---

## 🏗️ Sprint 0 — Ambiente & Infraestrutura (Docker + CI/CD)

### Estrutura base do projeto
- [x] Criar estrutura de pastas do projeto (`config/`, `apps/`, `docs/`, `tests/`, `requirements/`)
- [x] Criar `requirements/base.txt`, `requirements/dev.txt`, `requirements/prod.txt`
- [x] Adicionar `.gitignore`, `.editorconfig`, `.env.example` e `README.md`
- [x] Configurar `ruff` (lint + format) e `pre-commit` hooks
- [x] Inicializar projeto Django (`config`) com settings modularizado (base/dev/prod)

### Docker
- [x] Criar `Dockerfile` da aplicação Django (multi-stage, usuário não-root)
- [x] Criar serviço **db** no `docker-compose.yml` (PostgreSQL 16 + volume + healthcheck)
- [x] Criar serviço **redis** no `docker-compose.yml` (Redis 7 + healthcheck)
- [x] Criar serviço **web** (Django/Gunicorn) no `docker-compose.yml` com `depends_on` e `.env`
- [x] Criar serviço **celery_worker** no `docker-compose.yml`
- [x] Criar serviço **celery_beat** no `docker-compose.yml`
- [x] Criar serviço **waha** no `docker-compose.yml` (imagem `devlikeapro/waha`, engine NOWEB, porta 3000, volume de sessões, variáveis de ambiente e webhook global)
- [x] Documentar variáveis de ambiente do WAHA no `.env.example` (API key, engine, webhook URL)
- [x] Criar `Makefile`/scripts de conveniência (`up`, `down`, `migrate`, `test`, `logs`)
- [x] Validar `docker-compose up` sobe todos os containers e healthchecks ficam verdes

### CI/CD
- [x] Criar workflow GitHub Actions `.github/workflows/ci.yml` (trigger em push/PR)
- [x] Job de **lint** (ruff) no CI
- [x] Job de **testes** (pytest + coverage) com serviços `postgres:16` e `redis:7`
- [x] Configurar limite mínimo de cobertura (falha se abaixo do alvo)
- [x] (Opcional) Job de **build** da imagem Docker em `main`/tags
- [ ] Validar pipeline verde em um push inicial

---

## 🧱 Sprint 1 — Fundação Multi-Tenant & Autenticação

- [ ] Instalar e configurar `django-tenants` (DATABASE ENGINE, middleware, `SHARED_APPS`/`TENANT_APPS`)
- [ ] Criar app `tenants` com models `Clinica` (tenant) e `Dominio` — schema `public`
- [ ] Criar app `plataforma` com `PlanoAssinatura` (schema `public`)
- [ ] Criar modelo base abstrato `ModeloBase` (`criado_em`, `atualizado_em`, `ativo`)
- [ ] Criar app `usuarios` com `Usuario` custom (AbstractUser, login por e-mail, campo `papel`)
- [ ] Configurar Celery + Redis no projeto (`celery.py`, tasks tenant-aware, `django-celery-beat`)
- [ ] Criar comando/rotina de provisionamento de tenant (criar `Clinica` + schema + domínio)
- [ ] Testes: criação de tenant, isolamento de schema, autenticação por papel

---

## 👨‍⚕️ Sprint 2 — Gestão de Dentistas

- [ ] Criar app `dentistas` com models `Dentista` e `Especialidade` (M2M)
- [ ] CRUD de `Dentista` (views/serializers/urls) com validação de CRO único
- [ ] Vínculo opcional `Dentista` ↔ `Usuario` (login do profissional)
- [ ] Testes de CRUD e validações do módulo de dentistas

---

## 🧑‍🤝‍🧑 Sprint 3 — Pacientes, Planos e Guias

- [ ] Criar app `pacientes` com model `Paciente` (CPF único, WhatsApp)
- [ ] CRUD de `Paciente` + testes
- [ ] Model `PlanoOdontologico` (vários por paciente) + CRUD + testes
- [ ] Model `Guia` (vínculo plano ↔ consulta, status) + CRUD + testes
- [ ] Regra de negócio: transição de status da guia (`EMITIDA → AUTORIZADA → EXECUTADA → PAGA/GLOSADA`)

---

## 📅 Sprint 4 — Atendimento, Agenda & Anamnese

- [ ] Criar app `agenda` com model `Consulta` (status + status_confirmacao)
- [ ] Agendamento de consulta com verificação de conflito de horário do dentista + testes
- [ ] Fluxo "iniciar consulta" (`AGENDADA → EM_ATENDIMENTO → REALIZADA`) + testes
- [ ] Model `Anamnese` + registro vinculado à consulta/paciente + testes
- [ ] Vincular `Guia` à `Consulta` no momento do atendimento + testes

---

## 🔗 Sprint 5 — Integração Google Calendar (OAuth2 + Sync)

- [ ] Criar app `integracoes` com model `CredencialGoogleCalendar` (tokens criptografados)
- [ ] Implementar fluxo OAuth2 (authorize + callback) por clínica/dentista + testes (mock)
- [ ] Model `AgendaEvento` (espelho local do evento Google)
- [ ] Task `sincronizar_evento_google` (insert/update `events`) + armazenar `google_event_id` + testes
- [ ] Sincronização incremental por `syncToken` (Celery Beat) + testes
- [ ] (Opcional) Webhook de push notifications do Google + renovação de canal + testes

---

## 💬 Sprint 6 — Notificações WhatsApp (WAHA)

- [ ] Criar app `notificacoes` com `ConfiguracaoNotificacao` (com `waha_session`), `TemplateMensagem`, `LogNotificacao`
- [ ] Tela/endpoint de personalização (template + dias de antecedência) + testes
- [ ] Cliente HTTP do WAHA (`POST /api/sendText`, gestão de session) + testes (mock)
- [ ] Task periódica (Beat) que varre consultas e dispara pedidos de confirmação + testes
- [ ] Webhook de recebimento do WAHA (evento `message`) + parser da resposta (confirma/recusa) + testes
- [ ] Gatilho: resposta do paciente → atualiza `Consulta.status_confirmacao` → dispara sync Google + testes

---

## 📦 Sprint 7 — Gestão de Insumos (Estoque)

- [ ] Criar app `estoque` com models `Insumo`, `CategoriaInsumo`, `MovimentacaoEstoque`
- [ ] CRUD de insumos + cálculo de saldo por movimentações + testes
- [ ] Alerta de estoque mínimo + testes
- [ ] Baixa automática de insumo vinculada à consulta realizada + testes

---

## 💰 Sprint 8 — Gestão Financeira

- [ ] Criar app `financeiro` com models `LancamentoFinanceiro` e `Fatura`
- [ ] Geração automática de contas a receber a partir de consultas/guias realizadas + testes
- [ ] Lançamentos e ajustes manuais (contas a pagar/receber) + testes
- [ ] Faturamento por operadora (agrupar guias em `Fatura`) + testes
- [ ] Relatório/consulta de fluxo de caixa (a receber x a pagar) + testes

---

## 🛡️ Sprint 9 — Hardening, Observabilidade & Entrega

- [ ] Auditoria/log de ações sensíveis (LGPD)
- [ ] Rotina de backup por schema e expurgo de tenant
- [ ] Monitoramento (health endpoints, logs estruturados, Sentry opcional)
- [ ] Documentação de API (drf-spectacular / OpenAPI)
- [ ] Revisão de segurança e testes de carga básicos

---

_Última atualização de estado: Sprint 0 — job `build` (main/tags, needs lint+test, build-push-action) adicionado e validado (YAML). Próxima: validar pipeline verde em um push inicial (requer repo GitHub)._
