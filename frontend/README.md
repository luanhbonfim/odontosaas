# PróClínica — Frontend (SPA)

SPA da plataforma **PróClínica / OdontoSaaS**: o app das clínicas (tenants), o **Vendor Admin**
(governança da plataforma) e a **landing** pública de vendas — tudo no mesmo bundle, escolhido
pelo host/rota.

**Stack:** React 19 · TypeScript · Vite (Rolldown) · Tailwind CSS v4 · shadcn/ui (Radix) ·
TanStack Query · TanStack Table · React Router · Zustand · React Hook Form + Zod · Recharts ·
FullCalendar · Vitest + Testing Library · axe-core · Playwright.

Docs de arquitetura, design system e backlog: [`../docs/04-frontend-design-system/`](../docs/04-frontend-design-system/)
e [`../docs/02-backlog-tenants/02-backlog-frontend-tenants.md`](../docs/02-backlog-tenants/02-backlog-frontend-tenants.md).

## Rodando em desenvolvimento

O backend (Django + Postgres + Redis) roda em Docker; o frontend, no host.

```bash
# 1) Backend (na raiz do repositório)
docker compose up -d db redis web          # API em http://localhost:8000

# 2) Frontend
cd frontend
npm install
npm run dev                                # http://localhost:5173
```

### Multi-tenant em dev

Cada clínica é um subdomínio. O Vite aceita `*.localhost` e repassa o `Host` ao backend
(`vite.config.ts`), então o django-tenants resolve o tenant:

| URL | O que abre |
|---|---|
| `http://demo.localhost:5173` | App da clínica `demo` (login, dashboard, agenda…) |
| `http://localhost:5173` | Host público → landing de vendas |
| `http://localhost:5173/plataforma-admin` | Vendor Admin (caminho configurável, ver abaixo) |

Para criar uma clínica de desenvolvimento:
`docker exec odonto_web python manage.py provisionar_clinica --schema minha --nome "Minha Clínica" --dominio minha.localhost --admin-email admin@minha.com --admin-senha <senha>`.

## Scripts

| Comando | Para quê |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (HMR) |
| `npm run build` | `tsc -b` + build de produção em `dist/` |
| `npm run build:check` | Build + **orçamento de bundle** (falha se estourar; ver abaixo) |
| `npm run typecheck` | `tsc -b` (⚠️ não use `tsc --noEmit` solto: o tsconfig raiz é *solution-style* e checaria 0 arquivos) |
| `npm run lint` / `format` | ESLint (inclui `jsx-a11y`) / Prettier |
| `npm test` | Vitest (unitários e de componente) |
| `npm run e2e` | Playwright (fluxos críticos; ver abaixo) |
| `npm run gen:api` | Regenera `src/lib/api/schema.d.ts` a partir do OpenAPI do backend (precisa do backend em `:8000`) |

## Estrutura

```
src/
  components/ui/       primitivos shadcn (button, dialog, sheet, table…)
  components/common/   DataTable, EmptyState, ErroCarregamento, CarregandoPagina, FormKit…
  components/layout/   AppShell, Sidebar, Topbar
  features/<módulo>/   telas + hooks de dados (use-*.ts) + testes, por domínio
  lib/api/             cliente Axios, JWT, schema.d.ts (gerado), query client
  routes/paginas.ts    TODAS as telas carregadas sob demanda (React.lazy)
  routes/nav.ts        menu lateral e gating por papel/módulo
  stores/              Zustand (UI, tema)
  test/                utilitários de teste (axe) e testes de acessibilidade
e2e/                   Playwright
scripts/               verificar-bundle.mjs (orçamento de bundle)
```

### Convenções

- **Tipos da API:** vêm de `schema.d.ts` (`npm run gen:api`) — não digite à mão o que o OpenAPI já descreve.
- **Dados:** TanStack Query (um hook por recurso em `features/<módulo>/use-*.ts`).
- **Formulários/gavetas:** use o **FormKit** (`components/common/form-kit.tsx`); guia em
  [`docs/04-frontend-design-system/04-padrao-formularios.md`](../docs/04-frontend-design-system/04-padrao-formularios.md).
- **Listas:** `DataTable` (cards no mobile). Erro de carga: `ErroCarregamento` (nunca mostre "sem dados" quando falhou).
- **Telas novas:** exporte em `routes/paginas.ts` (lazy) e registre a rota em `App.tsx`.
- **Cor de texto dourada:** use `text-primary-text` (contraste AA); `text-primary` só em ícones decorativos.

## Testes

- **Unitários/componentes:** `npm test`. Em máquinas lentas (Docker rodando junto), use
  `npx vitest run --testTimeout=60000 --maxWorkers=3`.
- **Acessibilidade:** `src/test/axe.ts` (`violacoesAxe`) roda axe WCAG 2.1 A/AA no jsdom. Contraste de cor
  **não** é checado no jsdom — foi auditado no navegador (axe ao vivo) nos dois temas.
- **E2E (Playwright):** `e2e/fluxo-critico.spec.ts` cobre login → agendar → confirmar → atender → pagamento →
  financeiro, mais busca global e auditoria.
  - Requer o backend no ar. O *setup global* roda `python manage.py preparar_e2e` (via
    `docker exec odonto_web …`; sobrescreva com `E2E_PREPARAR_CMD`), que cria/zera a clínica isolada
    `e2e` (`e2e.localhost`) — **nunca toca no tenant `demo`**.
  - Usa o **Microsoft Edge** instalado (sem download). Em CI: `npx playwright install chromium` e
    `E2E_CANAL=chromium npm run e2e`.

## Build e deploy

A produção serve o SPA e a API **no mesmo domínio**: o build vira estáticos no Caddy, que faz proxy de
`/api`, `/admin`, `/static` etc. para o Django e entrega `index.html` como fallback do React Router.

- **Imagem de borda:** [`../deploy/edge.Dockerfile`](../deploy/edge.Dockerfile) (stage 1 compila com
  `npm run build`; stage 2 é o Caddy com `dist/` em `/srv`). Guia completo: [`../deploy/README.md`](../deploy/README.md).
- **Caminho do Vendor Admin:** `VITE_VENDOR_ADMIN_SECRET_PATH` (default `/plataforma-admin`) é embutido
  **em tempo de build** (vem do `.env` de produção via build arg).
- **Cache** (`../deploy/Caddyfile`): `/assets/*` (nomes com hash) → `immutable` por 1 ano; `index.html` e rotas do SPA → `no-cache`.

### Orçamento de bundle

`npm run build:check` falha (exit 1) se, em KB **gzip**: o JS do carregamento inicial passar de 180, o CSS
inicial de 25 ou algum chunk de 130. Estado atual: ~171 KB de JS inicial (era 536 KB num único arquivo);
gráficos (Recharts) e calendário (FullCalendar) só carregam nas telas que os usam. Não force *chunks*
nomeados para essas bibliotecas em `vite.config.ts`: isso as puxa para o carregamento inicial.

## Acessibilidade, tema e movimento

- WCAG 2.1 AA: landmarks e `h1` por página, link "Pular para o conteúdo", foco no título a cada troca de rota.
- Tema claro/escuro: segue o sistema por padrão, aplicado antes do React (sem *flash*); a escolha do usuário fica salva.
- `prefers-reduced-motion` desliga animações/transições não essenciais (regra global em `index.css`).
