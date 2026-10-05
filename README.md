# OdontoSaaS (PróClínica) 🦷

Sistema **SaaS multi-tenant** para gestão de clínicas de Odontologia. Cada clínica é um *tenant*
isolado (schema-per-tenant via `django-tenants`), com agenda sincronizada ao Google Calendar,
confirmação de consultas por WhatsApp (WAHA), prontuário com odontograma, convênios, estoque e
financeiro. Há ainda um **Vendor Admin** (governança da plataforma) e uma **landing** de vendas.

## Stack

- **Backend:** Django 5 · DRF · PostgreSQL 16 · django-tenants · Celery + Redis + Beat · JWT.
- **Integrações:** WAHA (WhatsApp HTTP API, sessão por clínica) · Google Calendar API.
- **Frontend:** React 19 · TypeScript · Vite · Tailwind v4 · shadcn/ui · TanStack Query ·
  Vitest · Playwright — ver [`frontend/README.md`](frontend/README.md).
- **Infra:** Docker · Caddy (HTTPS automático, wildcard on-demand) · GitHub Actions ·
  VPS — ver [`deploy/README.md`](deploy/README.md).

## Como rodar (desenvolvimento)

```bash
# Backend (API em http://localhost:8000)
docker compose up -d db redis web

# Frontend (http://<clinica>.localhost:5173)
cd frontend && npm install && npm run dev
```

Detalhes (multi-tenant em dev, scripts, testes, E2E, build): [`frontend/README.md`](frontend/README.md).

Testes do backend (no container): `docker exec odonto_web python -m pytest -q`.
Lint: `docker exec odonto_web ruff check apps tests`.

## Documentação

Toda a documentação está em [`docs/`](docs/README.md):

| Categoria | Conteúdo |
|---|---|
| [docs/01-arquitetura/](docs/01-arquitetura/) | Arquitetura geral, multi-tenancy, modelagem de dados, ambientes e Google OAuth |
| [docs/02-backlog-tenants/](docs/02-backlog-tenants/) | Backlogs de backend e frontend das clínicas e planos de pagamento |
| [docs/03-vendor-admin/](docs/03-vendor-admin/) | Especificação, backlog e relatórios de segurança do painel de governança |
| [docs/04-frontend-design-system/](docs/04-frontend-design-system/) | Design system, diretrizes de UI/UX e padrão de formulários |
| [docs/05-landing-page/](docs/05-landing-page/) | Especificação e backlog da landing de vendas |
| [docs/06-roadmap/](docs/06-roadmap/) | Validação de planos/limites e novas features (nuvem, IA, TISS, NFS-e, gateway) |

Visão geral de arquitetura e sistema: [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md).

## Módulos

1. **Dentistas** — cadastro, especialidades e vínculo com o login.
2. **Pacientes e Planos** — pacientes, planos odontológicos, convênios e guias.
3. **Atendimento** — agenda, anamnese, fichas/odontograma, Google Agenda bidirecional.
4. **Comunicação** — WhatsApp (confirmação por SIM/NÃO ou link, lembretes, recall).
5. **Estoque** — insumos, movimentações, fornecedores e alertas.
6. **Financeiro** — contas a receber/pagar, faturas, fluxo de caixa e Dashboard.
7. **Administração** — equipe, permissões por papel, auditoria (LGPD) e plano contratado.

## Metodologia de desenvolvimento

O desenvolvimento é guiado tarefa a tarefa pelos checklists em `docs/` (backlogs de
[backend](docs/02-backlog-tenants/01-backlog-backend-tenants.md),
[frontend](docs/02-backlog-tenants/02-backlog-frontend-tenants.md) e
[vendor](docs/03-vendor-admin/02-backlog-sprints-vendor.md)):

1. Focar sempre na próxima tarefa `- [ ]` (de cima para baixo).
2. Escopo estrito — só o que a tarefa pede.
3. Testes obrigatórios acompanham toda implementação.
4. Não quebrar tarefas anteriores.
5. Marcar `- [x]` somente após validação.

## Estado atual

Sprints do backend e do frontend (F0–F9) concluídas — resta a validação real do Google OAuth em produção (depende de domínio). Próximos passos em
[`docs/06-roadmap/`](docs/06-roadmap/00-plano-sprints-planos-e-novas-features.md): validação de planos,
limites e permissões (Sprint V), limite de pacientes ativos (Sprint P) e as novas funcionalidades.
