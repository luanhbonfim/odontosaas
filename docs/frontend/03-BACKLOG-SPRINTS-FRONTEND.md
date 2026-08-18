# OdontoSaaS — Backlog de Sprints do Frontend (Checklist)

> **Fonte de verdade do desenvolvimento do frontend.** A cada comando de "iniciar desenvolvimento",
> trabalha-se EXCLUSIVAMENTE na próxima tarefa `- [ ]` (de cima para baixo). Só marcar `- [x]` **após
> validação do usuário**. Toda tarefa de UI acompanha **testes** (Vitest + Testing Library + MSW; fluxos
> críticos em Playwright).
>
> Legenda: `- [ ]` pendente · `- [x]` concluída e validada.
>
> **Responsividade (decisão):** mobile/tablet faz parte do **"pronto" de cada tela** (não é sprint separada); revisão/QA final de responsividade + acessibilidade na **F9**. Tabelas usam o padrão do `DataTable` (vira **cards empilhados** no mobile via `useEhDesktop`).
>
> Prefixo **F** = sprint de frontend. As sprints espelham os módulos já entregues no backend (Sprints 0–9).
> Stack: **React + TS + Vite + Tailwind + shadcn/ui + TanStack Query** (ver [Arquitetura do Frontend](01-ARQUITETURA-FRONTEND.md)).
>
> **Backend pronto para a F1:** JWT já implementado (`djangorestframework-simplejwt`) — `POST /api/auth/token/`,
> `/api/auth/token/refresh/` e `/api/auth/token/verify/`; API protegida por `IsAuthenticated`; login por e-mail.

---

## 🎨 Sprint F0 — Fundação do Frontend

- [x] Inicializar projeto **Vite + React + TypeScript** (strict) na pasta `frontend/`
- [x] Configurar **Tailwind CSS** + tema (CSS variables claro/escuro) e **shadcn/ui** (base de componentes)
- [x] Configurar **ESLint + Prettier + `jsx-a11y`** e scripts (`lint`, `typecheck`, `test`, `build`)
- [x] Configurar **Vitest + Testing Library + MSW** (setup de testes e mock da API) + **Playwright** (E2E base)
- [x] Gerar **cliente tipado do OpenAPI** (`openapi-typescript` → `schema.d.ts`) + script `gen:api`
- [x] Camada de API: instância **Axios** (`baseURL /api`), **interceptors** (auth/erros) e **QueryClient** (TanStack Query)
- [x] Proxy do Vite (`/api`, `/health`, `/integracoes`, `/notificacoes`) para o backend; app em `demo.localhost`
- [x] **App Shell** base: layout (Sidebar + Topbar + PageHeader), rotas com React Router, tema/`ThemeToggle`, `Toaster`
- [x] Componentes comuns base: `DataTable`, `StatusBadge`, `EmptyState`, `ConfirmDialog`, skeletons + formatadores (`Money`, `PhoneText`, `DateTime`)
- [x] Pipeline **CI (GitHub Actions)**: `lint → typecheck → test → build`

---

## 🔐 Sprint F1 — Autenticação & Sessão

- [x] Tela de **Login** (email + senha) com React Hook Form + Zod e erros inline
- [x] Integração de auth (JWT): login, **refresh no 401**, logout (limpa tokens + cache do Query)
- [x] **Contexto de sessão** (usuário logado, papel, clínica) via store + hook `useSessao()` — consome `GET /api/auth/me/`
- [x] **Guarda de rotas** `RequireAuth` + redirecionamento; rota `/login` pública
- [x] **Autorização por perfil** (Recepção / Dentista / Dentista Gerente / Admin): itens de menu e ações condicionados — **seguir a matriz de permissões** definida no [backlog do backend](../03-BACKLOG-SPRINTS.md) (seção "Perfis de acesso & permissões"). Backend (5a): grupos/permissões por tenant + `PermissaoModulo`. Frontend (5b): `itensNavPorPapel` na Sidebar + seção Financeiro do Dashboard por papel.
- [x] Menu do usuário (perfil, trocar tema, sair) e exibição do nome da clínica (tenant) na Topbar
- [x] Testes: login sucesso/erro, guarda de rota, expiração/refresh, ocultação por papel

---

## 👨‍⚕️ Sprint F2 — Dentistas

- [x] Hooks de dados `useDentistas` / `useCriarDentista` / `useAtualizarDentista` / `useRemoverDentista`
- [x] **Listagem** de dentistas (`DataTable`: nome, CRO, especialidades, status) com busca
- [x] **Criar/editar** dentista em `FormDrawer` (validação de CRO único refletindo o erro do backend)
- [x] Vínculo opcional com usuário (login do profissional) na UI — e-mail gerado (`nome.sobrenome@clínica`), badge de estado, alterar senha, bloquear/reativar acesso
- [x] Excluir/inativar com `ConfirmDialog` (excluir com confirmação; backend trata `PROTECT`→400; inativar via cadastro)
- [x] Testes: CRUD, validação de CRO duplicado, estados (loading/empty/error) — cobertos ao longo da F2 (hooks, listagem, drawer, login, ações)

---

## 👥 Sprint F2.5 — Usuários & Equipe da Clínica

> Cadastro dos usuários da equipe (Recepção / Dentista / Dentista Gerente / Admin) e atribuição de **perfil**. Backend novo: `UsuarioViewSet` (`/api/usuarios/`). O `papel` já mapeia para o grupo de permissões automaticamente (signal `papel→Group` existente). Visível/gerenciável só por **Gerente/Admin** (módulo "Usuários" da matriz). Decidido pelo usuário na F2 (lacuna: não havia onde cadastrar a equipe pela UI).

- [x] **Backend (pré-requisito):** `UsuarioViewSet` (`/api/usuarios/`) — CRUD de usuários do tenant (`nome_completo`, `email`, `papel`, `ativo`); criar define a senha; bloquear/reativar (`is_active`); serializer **nunca** expõe a senha; `papel→Group` automático; permissões pelo módulo "usuarios" (Gerente/Admin). Testes (CRUD, papel vira grupo, e-mail dup, sem senha, gating Recepção 403 / Gerente 200).
- [x] Hooks de dados (`useUsuarios` / criar / atualizar / bloquear-reativar)
- [x] **Listagem** de usuários (`DataTable`: nome, e-mail, papel, status) com busca
- [x] **Criar/editar** usuário em `FormDrawer` — nome, e-mail, **seletor de papel**, senha (na criação); erros do backend inline
- [x] **Bloquear/reativar** acesso com `ConfirmDialog`
- [x] Item de menu **"Equipe"** na Sidebar (só Gerente/Admin) + rota protegida
- [x] Testes: CRUD, troca de papel, gating por perfil, estados (loading/empty/error)
- [x] **Hierarquia:** só se gerencia cargos **abaixo** do seu (Gerente não mexe em Admin/Gerente; seletor filtra papéis); **auto-edição** limitada a nome+senha (não muda o próprio papel nem se bloqueia). Backend `pode_gerenciar` (fonte de verdade) + reflexo na UI. Hardening: takeover de Admin via `/api/dentistas/` fechado (`usuario` read-only + checagem de hierarquia nas actions de login). Cobertura backend 100% nos módulos afetados.

---

## 🧑‍🤝‍🧑 Sprint F3 — Pacientes, Planos & Guias

- [x] Listagem de **pacientes** (`DataTable`: nome, CPF, telefone, e-mail, status) com busca. _Entregue e evoluída para paginação/busca no servidor (abaixo)._
- [x] **Paginação + busca no servidor** (Pacientes primeiro; padrão reutilizável para listas grandes). **Backend:** `PaginacaoPadrao(PageNumberPagination)` em `apps/core/pagination.py` — `page_size=20`, `page_size_query_param`, `max_page_size=100`, resposta `{count,next,previous,results}`; no `PacienteViewSet`: `pagination_class`, `filter_backends=[SearchFilter,OrderingFilter]`, `search_fields=["nome_completo","cpf"]`, `ordering_fields=["nome_completo","criado_em"]`, `ordering=["nome_completo"]`. **Por-view** (não global) para não quebrar Dentistas/Usuários/Especialidades (consomem array puro). **Frontend:** `DataTable` ganha modo **paginação manual** opcional (mantém client-side quando ausente); `usePacientes({page,search})` com `placeholderData: keepPreviousData` + **debounce ~300ms** na busca (volta à página 1). Regenerar schema (surge `PaginatedPacienteList`). **Testes** — back: shape paginado, `?search=`, `?page=2`, `?ordering=`; front: troca de página chama `?page`, debounce, estados. Base para reutilizar em Agenda/Financeiro/Estoque.
- [x] **Ficha do paciente** — rota `/pacientes/:id` com abas (dados, planos, guias, consultas, anamneses), read-only. Backend: `FiltraPorPacienteMixin` (`?paciente=`) em planos/guias/consultas/anamneses; front: componente `Tabs` (Radix) + navegação a partir da listagem.
- [x] Criar/editar paciente (CPF, telefone formatado `(DDD) número`, e-mail, endereço) + validação de CPF único. **Modelo "ver = editar":** edição inline na própria ficha (aba Dados: botão Editar → formulário → salvar); "Novo paciente" abre a ficha em modo de criação (Dados em branco; abas de relações pedem para salvar antes). Sem página/drawer separado.
- [x] CRUD de **Planos odontológicos** do paciente (convênio, carteirinha, validade, status) — na aba Planos da ficha (adicionar/editar/excluir inline; exclusão protegida se houver guias). "Operadora" virou **seleção de convênio** (ver Sprint F3.6).
- [x] CRUD de **Guias** (número, procedimento, valor) + **transição de status** (EMITIDA→AUTORIZADA→EXECUTADA→PAGA/GLOSADA) com ações válidas apenas — na aba Guias da ficha (adicionar seleciona um plano do paciente; botões de transição só mostram os destinos válidos; editar/excluir).
- [x] **Escopo do dentista — FEITO** (nas rodadas de backend): `Paciente.dentista_responsavel` **+ `dentistas_compartilhados` (M2M)** + UI na aba Dados (select de responsável + chips de compartilhamento; ocultos para o dentista comum). DENTISTA vê só os **seus** pacientes (responsável **ou** compartilhado **ou** com consulta) via `escopo_dentista_q`; geral p/ Gerente/Recepção/Admin. Também fechou o vazamento N1 nas relações (planos/guias/consultas/anamneses).
- [x] Testes — FEITO: busca, CPF duplicado (400), transições de guia, **isolamento por dentista** (inclui N1). Back: `test_pacientes_api.py`; front: `aba-dados`/`aba-planos`/`aba-guias`.

---

## 🏥 Sprint F3.6 — Convênios (catálogo da clínica)

> Inserida a pedido do usuário durante a F3. A clínica cadastra uma vez os convênios/operadoras que atende; no plano do paciente passa-se a **selecionar** o convênio (deixa de digitar). **Design A (baixo risco):** `PlanoOdontologico.convenio` (FK opcional) preenche a string `operadora` no serializer — o **financeiro fica intacto** (segue faturando por `operadora`). Ver [[odonto-convenios]].

- [x] **Backend:** app `apps/convenios` (`Convenio`, nome único) + CRUD `/api/convenios/` (exclusão protegida) + módulo `convenios` na matriz (Recepção/Gerente/Admin FULL, Dentista READ). `PlanoOdontologico.convenio` (FK PROTECT, opcional) + serializer preenche `operadora`/expõe `convenio_nome`. Migração cria o catálogo a partir das operadoras existentes e religa os planos. Testes (CRUD, permissão por papel, derivação da operadora, PROTECT). Cobertura 100%.
- [x] **Frontend:** tela **Convênios** (`/convenios`, menu p/ Recepção/Gerente/Admin) com CRUD inline; na aba Planos da ficha, "Operadora" (texto) virou **select de convênio** (lista mostra `convenio_nome`). Hooks + testes (página, hooks, seleção no plano).

---

## 📅 Sprint F4 — Agenda, Consulta & Anamnese

- [x] **Calendário** (FullCalendar v6) com visões dia/semana/mês e cores por `status`. Interativo: arrastar/redimensionar (só AGENDADA), clicar no horário para agendar (estilo Google Agenda), clicar no evento para editar/visualizar; mês → abre o dia.
- [x] **Agendar consulta** (modal): busca de paciente → **dentista restrito ao responsável+compartilhados do paciente** (bloqueado sem paciente), **cobrança** (Particular/convênio; travada em Particular sem convênio; bloqueia convênio vencido), início/fim, procedimento, **valor obrigatório**. Excluir só AGENDADA.
- [x] Tratamento do **conflito de horário** (erro 400) na gravação, com mensagem clara
- [x] Ações **Iniciar** (AGENDADA→EM_ATENDIMENTO, no modal de edição) e **Finalizar** (EM_ATENDIMENTO→REALIZADA, na visualização) — actions do backend.
- [x] **Anamnese**: formulário (drawer) na aba do paciente — queixa, pressão arterial, flags (fumante/diabético/gestante) + visualização (cards). Hook `useCriarAnamnese`.
- [x] Indicador de **confirmação** (badge por `status_confirmacao`) no evento/lista. _Indicador de **sync Google** fica na **F5** (Integrações)._
- [x] **Escopo do dentista** (row-level, backend): consultas/anamneses via `FiltraPorPacienteMixin` — o DENTISTA só vê registros de pacientes no seu escopo (responsável/compartilhado/com consulta); geral p/ Gerente/Recepção/Admin.
- [x] Testes: agenda (render/interações), criar consulta, dentista restrito, cobrança, iniciar/finalizar, anamnese (criar/validação), **isolamento por dentista** (back). _Ficha da consulta (odontograma + anotações) + filtros/ordenação nas consultas do paciente entregues junto._

---

## 🔗 Sprint F5 — Integração Google Calendar (UI)

- [x] Tela de **Integrações** (`/integracoes`, seção **Configurações** do menu): status da conexão Google (conectado/desconectado) por clínica/dentista. **Backend novo:** APIViews `/api/integracoes/google/conexoes|sincronizar|desconectar` (Gerente/Admin veem tudo; **DENTISTA vê/gerencia só a SUA**; escopo no backend). `ConsultaSerializer.sync_google` (do `AgendaEvento`).
- [x] Botão **"Conectar Google Agenda"** por alvo (redirect p/ OAuth `/integracoes/google/authorize?dentista=`). _O callback ainda responde JSON (retorno para a SPA fica p/ ajuste futuro)._
- [x] Indicador visual de **sync** (Sincronizado/Pendente/Erro) no modal da consulta (`BadgeSyncGoogle`).
- [x] Ação de **forçar sincronização** (consultas futuras pendentes) com resumo (`enviadas`/`erros`).
- [x] Testes — back: status, sincronizar (mock do Google), desconectar, gating por papel, **escopo do dentista**. Front: página (lista/estados/ações), gating no menu.
- [ ] **Pendências (validação real):** requer conta Google + credenciais OAuth configuradas para testar a conexão ponta a ponta; melhorar o retorno do callback para a SPA.

---

## 💬 Sprint F6 — Notificações WhatsApp (UI)

- [x] Tela de **Notificações** (`/notificacoes`, abas Configuração/Templates/Histórico). **Configuração:** dias de antecedência, horário de envio, sessão WAHA, ativo.
- [x] CRUD de **Templates** (CONFIRMACAO/LEMBRETE/CANCELAMENTO) em drawer, com variáveis `{{paciente}}/{{data}}/{{hora}}/{{dentista}}` e **preview ao vivo** (amostra).
- [x] **Histórico de notificações** (`LogNotificacao`) em `DataTable` com **filtros** (direção/status): paciente, tipo, direção, status, resposta, quando. **Backend novo:** `LogNotificacaoViewSet` (read-only, filtros) em `/api/logs-notificacao/`.
- [x] Ação de **envio/reenvio manual** de confirmação — botão no modal da consulta (AGENDADA) + action `POST /logs-notificacao/enviar-confirmacao/`; `enviar_confirmacao_manual` reusa o render/envio do WAHA.
- [x] Testes — back: envio manual (mock WAHA), histórico + filtros, sem-config→400. Front: configuração (salvar), template com preview de variáveis, histórico. Modal da consulta com o botão de envio.

---

## 📦 Sprint F7 — Estoque

- [ ] CRUD de **Categorias** e **Insumos** (unidade, estoque mínimo) com `DataTable`
- [ ] Coluna/badge de **saldo** e **alerta de estoque baixo** (âmbar/vermelho)
- [ ] Registrar **movimentações** (entrada/saída) com validação de quantidade > 0
- [ ] Tela **"Alertas de reposição"** (consumindo `/api/insumos/alertas/`)
- [ ] **Consumo de insumo por consulta** (registrar itens usados; baixa automática ao realizar)
- [ ] Testes: CRUD, saldo/alerta, movimentações, consumo

---

## 💰 Sprint F8 — Financeiro

- [ ] **Contas a pagar/receber** (`DataTable` com filtros `?tipo` e `?status`)
- [ ] Criar **lançamento manual** (RECEITA/DESPESA) + **ajustes** (editar) + **quitar** (baixa) em 1 clique
- [ ] **Faturamento por operadora** (ação `/api/faturas/faturar/`) e listagem de faturas
- [ ] **Fluxo de caixa** (`/api/lancamentos/fluxo-caixa/`) com **gráfico** (a receber × a pagar) e KPIs
- [ ] Visualização das **contas geradas automaticamente** (origem guia/consulta)
- [ ] Testes: filtros, quitar, faturar, gráfico de fluxo de caixa

---

## 🚀 Sprint F9 — Dashboard, Polimento & Entrega

- [ ] **Dashboard** inicial: consultas do dia, confirmações pendentes, alertas de estoque, KPIs financeiros (ligar aos endpoints reais). **Escopo por papel:** DENTISTA vê só os **seus** dados; Financeiro só para quem tem permissão (nota 1 da matriz)
- [ ] **Busca global** (paciente/consulta) na Topbar
- [ ] Auditoria: tela **read-only** de trilha LGPD (consumindo `/api/auditoria/`) para ADMIN
- [ ] Revisão de **acessibilidade AA** (axe/teclado/foco) e **responsividade** (mobile/tablet/desktop)
- [ ] **Dark mode** revisado, `prefers-reduced-motion`, estados vazios/erro em todas as telas
- [ ] **Performance**: code-splitting por rota, orçamento de bundle, skeletons consistentes
- [ ] **E2E (Playwright)** dos fluxos críticos: login → agendar → confirmar → financeiro
- [ ] **Build/deploy** dos estáticos (mesmo domínio da API) + documentação de execução (README do `frontend/`)

---

_Última atualização de estado: **backlog inicial do frontend criado** (planejamento). Próxima: **Sprint F0 —
Fundação do Frontend**, começando por inicializar o projeto Vite + React + TypeScript em `frontend/`._
