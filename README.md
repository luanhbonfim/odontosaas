# OdontoSaaS 🦷

Sistema **SaaS multi-tenant** para gestão de clínicas de Odontologia, construído em **Django**.

Cada clínica é um *tenant* isolado (schema-per-tenant via `django-tenants`), com módulos de dentistas,
pacientes/planos, agenda (sincronizada com o Google Calendar), notificações via WhatsApp (WAHA),
estoque e financeiro.

## Stack

Django 5.x · PostgreSQL 16 · django-tenants · Celery/Redis/Beat · WAHA (WhatsApp HTTP API) · Google Calendar API ·
Docker · GitHub Actions.

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/01-ARQUITETURA.md](docs/01-ARQUITETURA.md) | Visão geral, multi-tenant, async, Google, WhatsApp, CI/CD, segurança |
| [docs/02-MODELAGEM-DADOS.md](docs/02-MODELAGEM-DADOS.md) | Models por schema/app, ERD, relacionamentos |
| [docs/03-BACKLOG-SPRINTS.md](docs/03-BACKLOG-SPRINTS.md) | Backlog em checklist (fonte de verdade do desenvolvimento) |

## Módulos

1. **Gestão de Dentistas** — cadastro e gerenciamento dos profissionais.
2. **Pacientes e Planos** — pacientes, planos odontológicos e guias.
3. **Atendimento, Clínica e Google Agenda** — agendamento, anamnese, sincronização com Google Calendar.
4. **Comunicação e Notificações** — WhatsApp via WAHA (WhatsApp HTTP API), confirmação de presença.
5. **Gestão de Insumos** — estoque de materiais.
6. **Gestão Financeira** — contas a receber/pagar, faturamento.

## Metodologia de desenvolvimento

O desenvolvimento é guiado tarefa a tarefa pelo checklist em
[docs/03-BACKLOG-SPRINTS.md](docs/03-BACKLOG-SPRINTS.md):

1. Focar sempre na próxima tarefa `- [ ]` (de cima para baixo).
2. Escopo estrito — só o que a tarefa pede.
3. Testes obrigatórios acompanham toda implementação.
4. Não quebrar tarefas anteriores.
5. Marcar `- [x]` somente após validação.

> Próximo passo: **Sprint 0 — Ambiente & Infraestrutura (Docker + CI/CD)**.
