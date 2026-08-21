# OdontoSaaS 🦷

Sistema **SaaS multi-tenant** para gestão de clínicas de Odontologia, construído em **Django**.

Cada clínica é um *tenant* isolado (schema-per-tenant via `django-tenants`), com módulos de dentistas,
pacientes/planos, agenda (sincronizada com o Google Calendar), notificações via WhatsApp (WAHA),
estoque e financeiro.

## Stack

Django 5.x · PostgreSQL 16 · django-tenants · Celery/Redis/Beat · WAHA (WhatsApp HTTP API) · Google Calendar API ·
Docker · GitHub Actions.

## Documentação

A documentação do projeto está categorizada em [`docs/`](docs/README.md):

| Categoria | Conteúdo |
|---|---|
| [docs/01-arquitetura/](docs/01-arquitetura/) | Arquitetura geral, multi-tenancy, modelagem de dados, ambientes e Google OAuth |
| [docs/02-backlog-tenants/](docs/02-backlog-tenants/) | Backlog de sprints e planos de pagamento das clínicas (tenants) |
| [docs/03-vendor-admin/](docs/03-vendor-admin/) | Especificação e backlog de sprints do painel de governança da plataforma |
| [docs/04-frontend-design-system/](docs/04-frontend-design-system/) | Design system oficial, diretrizes de UI/UX e catálogo de formulários |

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
