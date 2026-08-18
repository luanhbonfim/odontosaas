# OdontoSaaS — Arquitetura do Frontend

> Documento vivo. Fonte de verdade técnica do **frontend** (SPA) que consome a API REST do OdontoSaaS.
> Stack decidida: **React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack Query**, com
> **cliente de API tipado gerado do OpenAPI** (`/api/schema/`).
>
> Perfil de quem escreve/executa: **front-end sênior com foco em UI/UX**. Toda decisão prioriza clareza
> clínica, eficiência operacional (recepção), acessibilidade (WCAG 2.1 AA) e consistência.

---

## 1. Visão geral

O frontend é uma **Single Page Application (SPA)** servida por **subdomínio de clínica**
(`clinicasorriso.odonto.app`). Como o backend (`django-tenants`) resolve o *tenant* pelo **Host** da
requisição, o frontend **não precisa enviar o tenant explicitamente**: ele apenas chama a API na **mesma
origem** (`/api/...`) e o subdomínio já direciona para o schema correto.

```
  Navegador (clinicasorriso.odonto.app)
        │
        ├── HTML/JS/CSS estáticos (SPA)  ← CDN / WhiteNoise / Nginx
        │
        └── fetch /api/...  (mesma origem → mesmo subdomínio → mesmo tenant)
                    │
                    ▼
             Django REST API  ──(django-tenants resolve o schema pelo Host)
```

**Princípios arquiteturais**

1. **Type-safety ponta a ponta** — os tipos do frontend são **gerados do schema OpenAPI** do backend, então
   contratos quebrados aparecem em tempo de compilação, não em produção.
2. **Server state ≠ client state** — dados do servidor vivem no **TanStack Query** (cache, revalidação,
   mutações); estado de UI (tema, sidebar, sessão) vive em stores leves.
3. **Feature-first** — o código é organizado por **domínio/módulo** (espelhando os apps do backend), não por
   tipo de arquivo.
4. **Acessível e responsivo por padrão** — componentes acessíveis (Radix/shadcn) e layout adaptável
   (recepção no desktop, dentista no tablet/celular).

---

## 2. Stack tecnológica

| Camada | Tecnologia | Por quê |
|---|---|---|
| Linguagem | **TypeScript** (strict) | Type-safety; casa com o client do OpenAPI |
| Framework | **React 18** | Ecossistema maduro, componibilidade |
| Build/dev | **Vite** | Dev server instantâneo, build otimizado (Rollup) |
| Roteamento | **React Router v6** | Rotas aninhadas, loaders, guards |
| Server state | **TanStack Query (React Query)** | Cache, refetch, mutations, optimistic updates |
| Client state | **Zustand** | Estado de UI simples e sem boilerplate |
| Estilo | **Tailwind CSS** | Design tokens utilitários, consistência, velocidade |
| Componentes | **shadcn/ui** (Radix primitives) | Acessíveis (ARIA), sem "lock-in", 100% customizáveis |
| Formulários | **React Hook Form + Zod** | Performático + validação declarativa (espelha o DRF) |
| Cliente HTTP | **Axios** + **openapi-typescript** | Interceptors (auth/erros) + tipos gerados |
| Agenda | **FullCalendar (React)** | Visões dia/semana/mês, drag-and-drop, recorrência |
| Tabelas | **TanStack Table** | Ordenação, filtro, paginação em dados densos |
| Gráficos | **Recharts** | Dashboards e fluxo de caixa |
| Datas | **date-fns** (locale pt-BR) | Formatação/tz (America/Sao_Paulo) leve |
| Ícones | **lucide-react** | Consistente, tree-shakeable |
| Feedback | **sonner** (toasts) | Notificações não-bloqueantes |
| Testes | **Vitest + Testing Library + MSW** | Unit/integração com API mockada |
| E2E | **Playwright** | Fluxos críticos ponta a ponta |
| Qualidade | **ESLint + Prettier** | Lint + format (paridade com o `ruff` do backend) |

> **Alternativa considerada e descartada:** Next.js. O produto é um **painel autenticado atrás de login**
> (sem necessidade de SSR/SEO), então uma **SPA pura (Vite)** é mais simples de servir e operar no modelo
> multi-tenant por subdomínio. Fica registrada como opção caso surja necessidade de SSR.

---

## 3. Integração com a API

### 3.1 Cliente tipado gerado do OpenAPI

O backend expõe **`/api/schema/`** (drf-spectacular). O frontend gera tipos automaticamente:

```jsonc
// package.json (script)
"gen:api": "openapi-typescript http://demo.localhost:8000/api/schema/ -o src/lib/api/schema.d.ts"
```

- Cada endpoint/serializer vira um **tipo TypeScript**. Mudou o backend? Rodar `pnpm gen:api` e o
  compilador aponta o que quebrou.
- Sobre esses tipos, criamos **hooks de dados** com TanStack Query (ex.: `usePacientes()`,
  `useCriarConsulta()`), um por recurso, encapsulando `queryKey`, cache e invalidação.

### 3.2 Camada de acesso (Axios + interceptors)

```
src/lib/api/
  client.ts        # instância Axios (baseURL "/api", timeout, JSON)
  auth-interceptor # injeta Authorization; no 401 tenta refresh e refaz a request
  error-interceptor# normaliza erros do DRF → { campo: [mensagens] } para os forms
  schema.d.ts      # tipos gerados do OpenAPI
  query-client.ts  # QueryClient (retry, staleTime, tratamento global de erro)
```

- **Erros de validação do DRF** (HTTP 400, formato `{ "campo": ["msg"] }`) são mapeados direto para os
  erros de campo do React Hook Form — a UX de formulário reflete a validação do servidor.
- **Erros de negócio** (ex.: 400 "Conflito de horário", transição inválida de guia/consulta) viram **toasts**
  claros e, quando fizer sentido, destacam o campo/linha.

### 3.3 Multitenancy no frontend

- **Sem header de tenant.** A clínica é o **subdomínio**; a API na mesma origem já resolve o schema.
- Em **desenvolvimento**, usamos `http://demo.localhost:8000` (proxy do Vite → backend) para bater no tenant
  `demo`. O `vite.config.ts` faz proxy de `/api`, `/health`, `/integracoes` para o backend.
- A identidade visual/nome da clínica vem de um endpoint de "perfil da clínica" (a criar no backend) ou do
  payload do usuário logado.

---

## 4. Autenticação e autorização

> **JWT já disponível no backend** (`djangorestframework-simplejwt`): a API exige autenticação por padrão
> (`IsAuthenticated`) e expõe `POST /api/auth/token/`, `POST /api/auth/token/refresh/` e
> `POST /api/auth/token/verify/`. Login por **e-mail** (USERNAME_FIELD do `Usuario`). Docs (`/api/docs/`)
> e health seguem públicos.

**Fluxo (JWT):**

```
Login (email + senha)  → POST /api/auth/token/          → { access, refresh }
  access  → guardado em memória e enviado em Authorization: Bearer
  refresh → POST /api/auth/token/refresh/ renova o access no 401 (guardar com cuidado)
Logout   → descarta tokens + limpa cache do React Query
```

- **Guarda de rotas** (`<RequireAuth>`): rotas privadas exigem sessão; sem ela → redireciona para `/login`.
- **Autorização por papel** (`Usuario.papel`: ADMIN / DENTISTA / RECEPCAO / FINANCEIRO): menus e ações são
  **condicionados ao papel** (ex.: só ADMIN/FINANCEIRO vê o módulo financeiro). O backend continua sendo a
  autoridade; o frontend apenas **esconde o que o usuário não pode fazer** (defense-in-depth).

---

## 5. Estrutura de pastas (feature-first)

```
src/
  main.tsx, App.tsx           # bootstrap, providers (Query, Router, Theme, Toaster)
  routes/                     # definição de rotas + guards + layouts
  lib/
    api/                      # client Axios, tipos OpenAPI, query-client
    utils/                    # formatadores (telefone, moeda BRL, datas pt-BR)
  components/
    ui/                       # primitivos shadcn/ui (button, dialog, table, ...)
    layout/                   # AppShell, Sidebar, Topbar, PageHeader
    common/                   # DataTable, FormDrawer, StatusBadge, EmptyState, Skeletons
  features/
    auth/                     # login, contexto de sessão, RequireAuth
    dashboard/
    dentistas/                # api hooks + páginas + componentes + validações (Zod)
    pacientes/                # (pacientes, planos, guias)
    agenda/                   # calendário, consulta, anamnese
    integracoes/              # conectar Google, status de sync
    notificacoes/             # config, templates, logs WhatsApp
    estoque/                  # insumos, movimentações, alertas
    financeiro/               # contas, faturamento, fluxo de caixa
  stores/                     # Zustand (sessão, tema, ui)
  hooks/                      # hooks genéricos (useDebounce, useMediaQuery, ...)
  styles/                     # tailwind base + tokens (CSS variables)
```

Cada *feature* segue o mesmo formato interno: `api.ts` (hooks React Query) · `schema.ts` (Zod) ·
`pages/` · `components/` · `index.ts`.

---

## 6. Configuração, ambientes e proxy

- **Variáveis** via `import.meta.env` (`VITE_API_BASE_URL`, `VITE_SENTRY_DSN` opcional). Nunca commitar
  segredos; `.env.local` fora do git.
- **Dev:** `vite.config.ts` faz proxy de `/api`, `/health`, `/integracoes`, `/notificacoes` para
  `http://localhost:8000`, e o app roda em `http://demo.localhost:5173` (casa com o tenant `demo`).
- **Build:** `vite build` gera estáticos; servidos por Nginx/WhiteNoise sob o mesmo domínio da API (evita
  CORS e mantém cookies same-site).

---

## 7. Qualidade, performance e observabilidade

- **Testes obrigatórios** (regra herdada da metodologia): todo componente/feature acompanha teste
  (Vitest + Testing Library + **MSW** mockando a API). Fluxos críticos em **Playwright**. Meta de cobertura
  configurável no CI.
- **Performance:** code-splitting por rota (lazy), `staleTime`/cache do React Query, listas virtualizadas
  quando necessário, imagens/ícones tree-shaken. Orçamento de bundle monitorado no build.
- **Acessibilidade:** lint com `eslint-plugin-jsx-a11y`; checagem com `axe` nos testes; navegação por teclado
  e foco visível em todos os fluxos.
- **Erros em produção:** Sentry (browser) **opcional**, ativado por `VITE_SENTRY_DSN` — espelha o padrão
  opcional do backend.
- **CI (GitHub Actions):** `lint → typecheck → test → build`. Sem verde, sem merge.

---

Ver também: [Design System & UI/UX](02-UI-UX-DESIGN-SYSTEM.md) · [Backlog de Sprints (Frontend)](03-BACKLOG-SPRINTS-FRONTEND.md) · [Arquitetura do Backend](../01-ARQUITETURA.md)
