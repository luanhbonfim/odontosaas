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
- [x] Validar pipeline verde em um push inicial

---

## 🧱 Sprint 1 — Fundação Multi-Tenant & Autenticação

- [x] Instalar e configurar `django-tenants` (DATABASE ENGINE, middleware, `SHARED_APPS`/`TENANT_APPS`)
- [x] Criar app `tenants` com models `Clinica` (tenant) e `Dominio` — schema `public`
- [x] Criar app `plataforma` com `PlanoAssinatura` (schema `public`)
- [x] Criar modelo base abstrato `ModeloBase` (`criado_em`, `atualizado_em`, `ativo`)
- [x] Criar app `usuarios` com `Usuario` custom (AbstractUser, login por e-mail, campo `papel`)
- [x] Configurar Celery + Redis no projeto (`celery.py`, tasks tenant-aware, `django-celery-beat`)
- [x] Criar comando/rotina de provisionamento de tenant (criar `Clinica` + schema + domínio)
- [x] Testes: criação de tenant, isolamento de schema, autenticação por papel

---

## 👨‍⚕️ Sprint 2 — Gestão de Dentistas

- [x] Criar app `dentistas` com models `Dentista` e `Especialidade` (M2M)
- [x] CRUD de `Dentista` (views/serializers/urls) com validação de CRO único
- [x] Vínculo opcional `Dentista` ↔ `Usuario` (login do profissional)
- [x] Testes de CRUD e validações do módulo de dentistas

---

## 🧑‍🤝‍🧑 Sprint 3 — Pacientes, Planos e Guias

- [x] Criar app `pacientes` com model `Paciente` (CPF único, WhatsApp)
- [x] CRUD de `Paciente` + testes
- [x] Model `PlanoOdontologico` (vários por paciente) + CRUD + testes
- [x] Model `Guia` (vínculo plano ↔ consulta, status) + CRUD + testes
- [x] Regra de negócio: transição de status da guia (`EMITIDA → AUTORIZADA → EXECUTADA → PAGA/GLOSADA`)

---

## 📅 Sprint 4 — Atendimento, Agenda & Anamnese

- [x] Criar app `agenda` com model `Consulta` (status + status_confirmacao)
- [x] Agendamento de consulta com verificação de conflito de horário do dentista + testes
- [x] Fluxo "iniciar consulta" (`AGENDADA → EM_ATENDIMENTO → REALIZADA`) + testes
- [x] Model `Anamnese` + registro vinculado à consulta/paciente + testes
- [x] Vincular `Guia` à `Consulta` no momento do atendimento + testes

---

## 🔗 Sprint 5 — Integração Google Calendar (OAuth2 + Sync)

- [x] Criar app `integracoes` com model `CredencialGoogleCalendar` (tokens criptografados)
- [x] Implementar fluxo OAuth2 (authorize + callback) por clínica/dentista + testes (mock)
- [x] Model `AgendaEvento` (espelho local do evento Google)
- [x] Task `sincronizar_evento_google` (insert/update `events`) + armazenar `google_event_id` + testes
- [x] Sincronização incremental por `syncToken` (Celery Beat) + testes
- [x] (Opcional) Webhook de push notifications do Google + renovação de canal + testes

---

## 💬 Sprint 6 — Notificações WhatsApp (WAHA)

- [x] Criar app `notificacoes` com `ConfiguracaoNotificacao` (com `waha_session`), `TemplateMensagem`, `LogNotificacao`
- [x] Tela/endpoint de personalização (template + dias de antecedência) + testes
- [x] Cliente HTTP do WAHA (`POST /api/sendText`, gestão de session) + testes (mock)
- [x] Task periódica (Beat) que varre consultas e dispara pedidos de confirmação + testes
- [x] Webhook de recebimento do WAHA (evento `message`) + parser da resposta (confirma/recusa) + testes
- [x] Gatilho: resposta do paciente → atualiza `Consulta.status_confirmacao` → dispara sync Google + testes

---

## 📦 Sprint 7 — Gestão de Insumos (Estoque)

- [x] Criar app `estoque` com models `Insumo`, `CategoriaInsumo`, `MovimentacaoEstoque`
- [x] CRUD de insumos + cálculo de saldo por movimentações + testes
- [x] Alerta de estoque mínimo + testes
- [x] Baixa automática de insumo vinculada à consulta realizada + testes

---

## 💰 Sprint 8 — Gestão Financeira

- [x] Criar app `financeiro` com models `LancamentoFinanceiro` e `Fatura`
- [x] Geração automática de contas a receber a partir de consultas/guias realizadas + testes
- [x] Lançamentos e ajustes manuais (contas a pagar/receber) + testes
- [x] Faturamento por operadora (agrupar guias em `Fatura`) + testes
- [x] Relatório/consulta de fluxo de caixa (a receber x a pagar) + testes

---

## 🛡️ Sprint 9 — Hardening, Observabilidade & Entrega

- [ ] Auditoria/log de ações sensíveis (LGPD)
- [ ] Rotina de backup por schema e expurgo de tenant
- [ ] Monitoramento (health endpoints, logs estruturados, Sentry opcional)
- [ ] Documentação de API (drf-spectacular / OpenAPI)
- [ ] Revisão de segurança e testes de carga básicos

---

## 🔧 Evoluções pós-teste (validadas ao vivo — fora do fluxo de sprints)

> Ajustes e melhorias que surgiram durante os **testes manuais** (WhatsApp real + Google Calendar
> real), já implementados, testados e **validados pelo usuário**. Não são tarefas de sprint — ficam
> aqui como histórico do que evoluiu além do checklist original.

### Notificações / WhatsApp (WAHA)
- [x] Matching **híbrido** da confirmação: (a) resposta **citando** a mensagem (`replyTo` ↔ `LogNotificacao.provider_message_id`) **ou** (b) **SIM/NÃO digitado direto** casado pelo **telefone do paciente**, exigindo uma confirmação nossa pendente para consulta **futura**. Um "SIM" avulso (sem confirmação pendente) **não** dispara o gatilho.
- [x] Resolução do **telefone real** quando o WhatsApp entrega o remetente como **LID de privacidade** (extraído de `_data.key.remoteJidAlt`).
- [x] Campo `provider_message_id` no `LogNotificacao` (migração `notificacoes.0002`).
- [x] **Mensagem de agradecimento** automática ao confirmar.
- [x] Constatação: botões interativos (`sendButtons`) não são confiáveis na engine NOWEB → padrão é texto "responda SIM/NÃO".

### Agenda / Google Calendar
- [x] Consulta **confirmada** deixa o evento **verde** no Google (`colorId=10`).
- [x] **Descrição** do evento com Paciente / Telefone (formatado) / Dentista.
- [x] **Import bidirecional (Google → sistema):** evento criado pela dentista no Google Agenda é importado como `Consulta`. Convenção: **título = nome do paciente**, **telefone na descrição**. Paciente **criado automaticamente**; dentista = credencial ou 1º ativo (fallback); consulta entra `PENDENTE` (segue para a confirmação de 1 dia antes).

### Pacientes
- [x] Property `Paciente.telefone_formatado` → formato **`(DDD) número`** (remove código do país 55).
- [x] `CPF` **opcional** no model (`null=True, blank=True`) para permitir auto-criação (ex.: import do Google); **a API continua exigindo** CPF (migração `pacientes.0005`).

### Qualidade
- [x] Suíte: **131 testes** · **100%** de cobertura · `ruff` lint+format limpos.

---

_Última atualização de estado: **Sprint 8 concluída (100%)** — app `financeiro` com `Fatura` e `LancamentoFinanceiro`; geração automática de contas a receber (Guia EXECUTADA / Consulta REALIZADA, via signals); CRUD + ajustes manuais (contas a pagar/receber) com baixa (`/quitar/`); faturamento por operadora (`/api/faturas/faturar/`); relatório de fluxo de caixa (`/api/lancamentos/fluxo-caixa/`). Suíte: pytest 156/156 (100%) + lint. **Próxima: Sprint 9 — Hardening, Observabilidade & Entrega** (auditoria/LGPD, backup por schema, monitoramento, docs de API, revisão de segurança)._
