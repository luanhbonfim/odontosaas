# 04 — Observações para o Painel de Admin (futuro)

> **Contexto.** Vários parâmetros de **agendamento/periodicidade** hoje estão
> fixos no código (Celery Beat) ou espalhados em configs por-clínica. Futuramente
> haverá um **painel de admin** onde tudo isso será **configurável pela interface**,
> sem depender de deploy. Este documento é o inventário do que existe e do que
> deve virar configurável.

## 1. Agendamentos periódicos (Celery Beat)

Definidos em `config/settings/base.py` → `CELERY_BEAT_SCHEDULE`
(o `DatabaseScheduler` sincroniza para `django_celery_beat.PeriodicTask`).

| Entrada (Beat) | Task | Frequência atual | Observação |
|---|---|---|---|
| `processar-avisos` | `notificacoes.tasks.processar_avisos_todos_tenants` | **60s (1 min)** | Aviso antes da consulta (confirmados). Precisa ser **pontual**: 1 min garante que sai no horário certo (ex.: "1h antes" de uma consulta 21h → sai às 20h). |
| `processar-recall` | `notificacoes.tasks.processar_recall_todos_tenants` | **6h** | Recall por procedimento (ex.: limpeza a cada 6 meses). Não precisa de horário exato. |
| `reconciliar-google` | `integracoes.tasks.reconciliar_google_todos_tenants` | **5 min** (global) | Cada clínica só reconcilia quando vence o **próprio intervalo** (ver §2). |
| `disparar-lembretes-whatsapp` | `notificacoes.tasks.disparar_lembretes_todos_tenants` | **1h** | Pedido de confirmação (usa `dias_antecedencia`/`horario_envio` da clínica). |
| `sincronizar-google-incremental` | `integracoes.tasks.sincronizar_incremental_todos_tenants` | **15 min** | Importa mudanças do Google (events.list + syncToken). |
| `renovar-watch-channels` | `integracoes.tasks.renovar_watch_channels` | (Beat) | Renova os canais de push do Google. |

**Importante (comportamento correto, não bug):** o aviso "X horas antes" fica
*elegível* quando `agora >= inicio − X horas`; com a checagem de 1 min ele sai
naquele minuto. O recall e a reconciliação têm folga proposital (não precisam de
precisão de minuto).

## 1.1. Intervalo da sincronização — VENDOR ONLY (não fica na tela da clínica)

O **intervalo de reconciliação com o Google** (`integracoes.ConfiguracaoSincronizacao.intervalo_minutos`)
**não é configurável pela clínica** — é um parâmetro **nosso (vendor)**, a ser
ajustado pelo **painel de admin** que venderá o software. Decisão de 2026-08-17.

- A **tela de Integrações da clínica NÃO tem** mais o campo de intervalo (removido).
  A clínica só vê o **informativo** (última sincronização + contagem regressiva
  ao vivo da próxima, em mm:ss).
- O endpoint **`PATCH /api/integracoes/google/sincronizacao/`** continua existindo
  (hoje aceito por gestor/admin) e é o ponto que o **painel de admin** usará para
  ajustar o intervalo por clínica. Ao construir o admin, restringir ao vendor.
- Hook frontend `useAtualizarConfigSync` (em `features/integracoes/use-integracoes.ts`)
  segue disponível para reuso no painel de admin.

## 2. Configurações já por-clínica (no banco)

- **`notificacoes.ConfiguracaoNotificacao`** (uma por tenant): `dias_antecedencia`,
  `horario_envio`, `enviar_agradecimento`, `cancelar_nao_confirmadas` +
  `cancelar_horas_antes`, `reforcar_confirmacao` + `mensagem_reforco`,
  `waha_session`.
- **`integracoes.ConfiguracaoSincronizacao`** (uma por tenant): `intervalo_minutos`
  (de quanto em quanto a clínica reconcilia com o Google), `ultima_sincronizacao`.
- **Templates** (`notificacoes.TemplateMensagem`): Confirmação/Cancelamento/
  Agradecimento (singletons, pré-configurados) + **Lembretes** (vários; cada um
  com `lembrete_tipo` RECALL/PRE_CONSULTA, `procedimento`, `intervalo_meses`,
  `horas_antes`).

## 3. O que o painel de admin deve permitir configurar (futuro)

- **Frequências do Beat** por ambiente/clínica (hoje fixas em `settings`):
  intervalo do aviso (default 1 min), do recall (default 6h), da reconciliação
  incremental e da renovação de watch.
- **Parâmetros globais** que hoje são de código/env: `APP_BASE_URL`,
  `GOOGLE_OAUTH_FRONTEND_URL`, chaves WAHA, TIME_ZONE.
- **Ativar/desativar** cada job por clínica e ver **status/última execução**
  (a reconciliação já grava `ultima_sincronizacao`; estender aos demais).
- **Observabilidade**: painel com últimas execuções, contagens
  (criados/atualizados/removidos/cancelados) e erros por clínica.

## 5. Recursos Entregues e Itens *EXTRA (Sprints V1 a V7)

- **Sprints V1 a V5 (Backend Core):** Modelagem de planos, provisionamento de tenants, backup físico pg_dump com SHA-256 no expurgo, impersonate read-only no middleware, Database Studio (read-only e DML com auditoria), Celery Beat gerenciável via banco (`PeriodicTask`).
- **Sprint V6 (Frontend Fundação & Auth):** `VendorShell`, `vendorApi` isolado, `vendorTokenStore`, login de operador com 2FA e Dashboard com KPIs consolidados.
- **Sprint V7 (Frontend Planos & Instâncias):** Gestão de planos com `PlanoFormDrawer`, listagem de tenants com filtros, `AlternarStatusDialog`, `ExpurgarTenantDialog` e `TenantDetalhesPage` com 6 abas.
- ***EXTRA (Sprint V7 — Hardening de Provisionamento & Impersonate):**
  - **EXTRA-V7.1:** Provisionamento em 4 blocos com CPF/CNPJ mascarados e gerador inteligente de schema/subdomínio.
  - **EXTRA-V7.2:** `MultiTenantJWTAuthentication` para resolução de operadores no host público e visualização da clínica `demo`.
  - **EXTRA-V7.3:** Banner superior fixo de alerta no tenant (`🛡️ Modo Suporte Read-Only`) e proteção estrita contra escrita via middleware HTTP 403.
  - **EXTRA-V7.4:** Aba 6 dedicada à Trilha de Auditoria com justificativa limpa, horário de encerramento e botões de `[Acessar]` e `[Encerrar Suporte Ativo]`.
  - **EXTRA-V7.5:** Expurgo flexível com `schema_name_confirmacao` e reset total de estado em modais e drawers.
  - **EXTRA-V7.6:** Semeado usuário Master global `admin@proclinica.com.br` com propagação automática em novos provisionamentos e formulário simplificado com dados do assinante.
  - **EXTRA-V7.7:** Persistência garantida da justificativa em `RegistroAuditoriaVendor`, encerramento individual/em lote e bloqueio estrito de múltiplas sessões simultâneas de suporte.
  - **EXTRA-V7.8:** Remoção do botão de reset individual por clínica e criação de menu lateral exclusivo **`Acesso Master Global`** (`/admin-master`) com sincronização atômica em lote em todos os schemas.
  - **EXTRA-V7.9:** Correção de rota 404 no bloqueio/desbloqueio de clínicas (`AlternarStatusDialog`), adição e persistência de dados pessoais do responsável na Aba 1 de detalhes da clínica, visualização e salvamento do intervalo de tempo no Google Calendar (com listagem das contas Google vinculadas) e painel informativo read-only da sessão WAHA com restart.
  - **EXTRA-V7.10:** Deslogamento automático imediato de usuários de clínicas bloqueadas no frontend via interceptor Axios 403, bloqueio estrito de login para tenants inativos no `TenantStatusMiddleware` (removida isenção de `/api/auth/`), melhoria no parser de mensagens de erro (`normalizarErro`) e parametrização do tempo de reagendamento (`reagendamento_minutos`) na Aba 4 do Vendor Admin.
  - **EXTRA-V7.11:** Validação contínua do status de conexão Google baseada em `refresh_token` ativo (evitando falso-positivo de token expirado), tratamento para conexões gerais de clínica (`dentista=None`), badge de sincronização Google periódica e extração dinâmica do número de telefone pareado no WAHA (`me.id` com máscara telefônica no painel).
  - **EXTRA-V7.12:** Correção do salvamento de `vigencia_fim` (formato ISO `YYYY-MM-DD`) e dos campos `override_limite_dentistas` e `override_limite_usuarios` na Aba 2, bloqueio automático de acesso quando o plano estiver com vigência expirada (`pode_acessar_sistema` e `TenantStatusMiddleware` com motivo `expirado`) e travas ativas de limite máximo no cadastro/reativação de dentistas e usuários da equipe.
  - **EXTRA-V7.13:** Captura e exibição automática do e-mail da conta Google conectada na Aba 3 do Vendor Admin (substituindo a identificação genérica de `primary` pelo e-mail do profissional/clínica, ex: `luanhenrique.dev@gmail.com`).
  - **EXTRA-V7.14:** Desacoplamento da antiga Aba 6 em duas seções independentes: **Aba 6: Suporte & Conexões** (gestão de conexões temporárias, visualização de sessões ativas e encerramento) e **Aba 7: Trilha de Auditoria (Logs)** (tabela rica com operador, IP, ação, campo modificado, valor anterior e valor atual/novo com rastreamento detalhado de auditoria no backend).
  - **EXTRA-V7.15:** Gestão completa de vigência e ciclo contratual de planos: adição do campo `periodicidade` (`MENSAL`, `ANUAL`, `PERMANENTE`) ao model `PlanoAssinatura` e formulários; provisionamento com plano comercial obrigatório e cálculo automático de `vigencia_fim`; status efetivo (`get_status_efetivo`) refletido nos badges; novo banner elaborado de alerta comercial e KPI Card de vencimentos no dashboard vendor; auto-dismiss de 20s para mensagens de login; e nova tela **Meu Plano** (`/meu-plano`) no tenant com limites, consumo em tempo real de dentistas, usuários, pacientes e armazenamento, módulos ativos e botão de upgrade direto via WhatsApp comercial.
  - **EXTRA-V7.16:** Limpeza de botões redundantes de suporte (removido botão do header principal e botões individuais da tabela de histórico na Aba 6) e sincronização imediata de encerramento via `POST /api/auth/encerrar-suporte/` quando o operador clica em `[Encerrar Suporte]` dentro do tenant.
  - **EXTRA-V7.17:** Ajuste no botão de provisionamento do dashboard vendor (`ProvisionarTenantModal`), campo de data de término de vigência configurável no provisionamento inicial, correção de estilização escura em selects e options, conversão do campo de vigência na Aba 2 em exibição somente-leitura com status, padronização do botão da aba "Meu Plano" para "Falar com Especialista / Comercial" e novo banner de vencimento sutil e discreto no topo de todas as páginas do tenant.
  - **EXTRA-V7.18:** Desacoplamento completo dos KPIs de "Vencidas" e "A Vencer" em cards autônomos e dedicados, com layout em 6 colunas no Dashboard Vendor (`Total Clínicas`, `Ativas`, `A Vencer (15d)`, `Planos Vencidos`, `Bloqueadas`, `MRR Estimado`) e em 5 colunas na listagem de Clínicas/Tenants (`Total Instâncias`, `Ativas & Em Dia`, `A Vencer (15 dias)`, `Planos Vencidos`, `Bloqueadas / Inativas`).
  - **EXTRA-V7.19:** Correção de bloqueio 403 em `ImpersonateReadOnlyMiddleware` para a rota `/api/auth/encerrar-suporte/`, suporte a `reacesso` no endpoint de impersonate permitindo que `[Acessar Painel]` gere tokens e autentique diretamente na clínica, e refetch reativo com `refetchInterval: 3000` / `refetchOnWindowFocus: true` e invalidações de cache completas no React Query.
  - **EXTRA-V7.20:** Configuração de Data de Início do Contrato no provisionamento com cálculo dinâmico da vigência estimada com base na periodicidade do plano, e remoção do botão superior de "Meu Plano", mantendo apenas o botão de "Falar com Especialista" dentro do card "Precisa de Mais Recursos?".
  - **EXTRA-V7.21:** Remoção do IP e da coluna de Justificativa/Detalhes na tabela de auditoria (Aba 7) e supressão da criação de logs de auditoria no encerramento de sessões de suporte (vendor e tenant).
  - **EXTRA-V7.22:** Correção no cálculo de dias restantes de vigência (`timezone.localdate()`), sincronizando com o fuso de São Paulo (`America/Sao_Paulo`) para não antecipar o dia pelo horário UTC, e tratamento textual de "expira hoje", "expira amanhã" ou "expira em N dias" no banner e na tela Meu Plano.
  - **EXTRA-V7.23:** Alinhamento de chaves e cálculo das métricas de volumetria da clínica (`total_pacientes`, `total_agendamentos`, `total_dentistas`, `total_usuarios`, `total_procedimentos`, `total_lancamentos`), serialização rica de erros operacionais com campos calculados (`modulo`, `tipo_erro`, `origem`) e desativação de paginação desnecessária na listagem de erros recentes.
  - **EXTRA-V7.24:** Implementação do handler global de exceções do DRF (`apps/core/handlers.py`) para interceptar automaticamente falhas operacionais da clínica (conflitos de agenda, quotas, exceções 500, etc.) e gravar em tempo real no banco do Vendor Admin.
  - **EXTRA-V7.25:** Desabilitação dinâmica e completa de módulos no tenant (Google Calendar, WhatsApp, Financeiro, Estoque) quando inativos no plano contratado ou por override: menus da Sidebar ocultados, rotas bloqueadas com guard `RequireModulo`, botões contextuais suprimidos (ex.: envio WhatsApp no modal de agendamento), endpoints da API protegidos com 403 Forbidden e tarefas Celery suspensas em background para a clínica sem apagar as configurações salvas.
  - **EXTRA-V7.26:** Tratamento de estado "Não Aplicável" no Vendor Admin ao selecionar um tenant cujo plano não possua Google Calendar ou WhatsApp: cabeçalhos de aba exibem badge de Não Aplicável, cards exibem banner explicativo, inputs de intervalo/reagendamento ficam desabilitados e botões de ação adotam estilo bloqueado (`bg-slate-800`, `cursor-not-allowed`, `opacity-60`), impedindo alterações acidentais.
  - **EXTRA-V7.27:** Auditoria e Hardening de Segurança DevOps & SecOps: mitigação de Information Disclosure em respostas de erro 500 (`custom_exception_handler` com mensagens genéricas em produção); sanitização e redação automática de credenciais e tokens em logs operacionais (`[DADO CONFIDENCIAL REDIGIDO]`); validação estrita de integridade contra spoofing no header `X-Tenant-Id`; validação primária de assinatura criptográfica HMAC-SHA256 no middleware de impersonate; isolamento de exceções em rotinas periódicas do Celery Beat com `try/except` por tenant impedindo falhas em cascata no cluster; otimização O(1) de resolução de webhook inbound do WAHA com bloqueio para clínicas com WhatsApp desabilitado; e publicação do relatório formal em `docs/03-vendor-admin/04-relatorio-auditoria-seguranca-devops.md`.
  - **EXTRA-V7.28:** Isolamento Estrito de Host & Autenticação de Operadores: bloqueio de login de clínica no schema `public` via `POST /api/auth/token/` com `401 Unauthorized` e orientação de uso de subdomínio; criação do endpoint dedicado `POST /api/plataforma-admin/auth/login/` para operadores Vendor (`is_staff` / `is_superuser`); e resolução de `TenantAtualView` retornando `is_public: true` no host raiz e `is_public: false` com `nome_fantasia` no subdomínio do tenant.
  - **EXTRA-V7.29:** Página Institucional / Vendas no Domínio Raiz & Supressão da Rota `/login` no Host Público: no domínio principal (`localhost:5173` ou `proclinica.cloud`), a rota raiz `/` renderiza diretamente a **Página Institucional / Vendas da Plataforma** (`PaginaPublicaPlataforma`); a rota `/login` é desativada no domínio público e redirecionada para `/`; e as telas de login de consultórios são restritas aos subdomínios de clínicas.
  - **EXTRA-V7.30:** Tratativa Global de Erros 404 (Página / Endpoint Não Encontrado): componente global `NaoEncontradaPage` no frontend com layout escuro consistente, badge `404 | Não Encontrado`, botão de voltar e botão contextual para página inicial (`/` no público ou `/dashboard` no tenant); rota catch-all `<Route path="*" element={<NaoEncontradaPage />} />` em `App.tsx`; e handlers backend `handler404` (`custom_page_not_found`) e `handler500` (`custom_server_error`) em `config/urls.py` com respostas JSON estruturadas.
  - **EXTRA-V7.31:** Segunda Rodada de Auditoria e Hardening SecOps & DevOps: injeção obrigatória de claim `schema_name` no token JWT e validação estrita no `MultiTenantJWTAuthentication` bloqueando replay cross-tenant; revogação síncrona no Redis de tokens JWT de impersonate ao encerrar suporte antecipadamente; bloqueio de comandos administrativos adicionais no Database Studio (`SET search_path`, `COPY PROGRAM`) e privilégio mínimo na role `odonto_studio_ro`; sanitizador profundo `sanitizar_texto_sensivel` de URLs de banco e credenciais em logs de erro; resiliência do Celery Beat com hooks `@task_prerun`/`@task_postrun` fechando conexões antigas (`close_old_connections`) e resetando schema para `public`; normalização de header no `ImpersonateReadOnlyMiddleware`; e reatividade no frontend para eventos de janela de expiração/suspensão no `SessaoWatcher`.
  - **EXTRA-V9.01:** Consolidação da Sprint V9 (Hardening, Isolamento Multi-Tenant & Suíte E2E): criação da suíte de testes automatizados backend `tests/test_plataforma_admin_v9_hardening.py` (20 testes verdes) e frontend `frontend/src/features/vendor-admin/vendor-admin-v9-e2e.test.tsx` (7 testes verdes); validação da camuflagem 404 em subdomínios de tenants via `IsVendorHost`; bloqueio RBAC de usuários não-staff em endpoints do vendor; expansão de regex de comandos proibidos no Database Studio para cobrir `DROP TABLE`, `TRUNCATE`, `ALTER TABLE`, `GRANT`, `REVOKE` e `COPY`; salvaguarda contra `undefined` em `tenant.dominios` no frontend; e compatibilização do teste `test_auth_me.py` com o payload enriquecido de módulos dinâmicos.
  - **EXTRA-V9.02:** Terceira Rodada de Auditoria SecOps & DevOps: implementação do padrão Singleton Promise no cliente Axios frontend (`obterTokenRenovado` / `obterTokenVendorRenovado`), eliminando race conditions em renovações concorrentes de token JWT e garantindo retry atômico com injeção de Authorization header; limpeza completa do cache TanStack Query (`queryClient.clear()`) no encerramento de sessões de suporte; validação defensiva contra tokens corrompidos em `token-store.ts`; injeção do claim `operator_schema` no token emitido por `VendorLoginView` e busca direta O(1) de operadores em `MultiTenantJWTAuthentication`, otimizando a latência de requisições autenticadas no painel vendor.
  - **EXTRA-V9.03:** Correção de Redirecionamento e Conflito de Sessão no Vendor Admin: remoção da subscrição global indiscriminada de erros no QueryCache (`queryClient.getQueryCache().subscribe`) em `SessaoWatcher` (que disparava `toast.error` e forçava redirecionamento indevido para `/login` ao acessar o Vendor Admin); e inserção de guard contextual no evento `sessao-expirada` para ignorar rotas que iniciam com `/plataforma-admin`, garantindo que operadores naveguem sem interferência e que o login do vendor permaneça estritamente em `/plataforma-admin/login`.
  - **EXTRA-V9.04:** Correção de Rotas e Alinhamento de Payloads no Celery Monitor & Orquestrador: ajuste do endpoint frontend em `use-vendor-celery.ts` para `/plataforma-admin/celery/tarefas/` e `/plataforma-admin/celery/tarefas/status/` (alinhado com o router backend `CeleryTarefasViewSet`); enriquecimento da resposta de `obter_status_celery()` com as propriedades `tamanho_fila_celery`, `total_workers` e `workers_ativos`; e enriquecimento de `PeriodicTaskListSerializer` com `interval_display`, `crontab_display`, `crontab_minute`, `crontab_hour` e `crontab_day_of_week`, preenchendo todos os 4 cards de infraestrutura e a tabela de agendamentos em tempo real.
  - **EXTRA-V9.05:** Correção de Persistência de Sessão e Autorização de Operador no Vendor Admin: persistência do `access_token` em `sessionStorage`/`localStorage` em `vendorTokenStore`, garantindo que requisições paralelas após F5/recarregamento de página já enviem o cabeçalho `Authorization: Bearer` imediatamente sem disparar rajadas concorrentes de refresh; e compatibilização em `MultiTenantJWTAuthentication` para aceitar contas com `is_staff=True` ou `is_superuser=True` (em conformidade com `IsVendorStaff` e `VendorLoginView`), restabelecendo a exibição de tenants, métricas do dashboard e status do cluster Celery.
  - **EXTRA-V9.06:** Enriquecimento e Sincronização de Descrições das Tarefas Periódicas do Celery: estruturação do dicionário `DESCRICOES_PADRAO` em `celery_manager.py` com o detalhamento das 6 rotinas assíncronas do cluster (`celery.backend_cleanup`, `sincronizar-google-incremental`, `disparar-lembretes-whatsapp`, `reconciliar-google`, `processar-avisos`, `processar-recall`); atualização idempotente das tarefas no banco de dados via `garantir_tarefas_padrao_no_banco()`; e fallback dinâmico no serializer `PeriodicTaskListSerializer`, eliminando mensagens de "Sem descrição cadastrada" e provendo contexto operacional claro no Celery Monitor.







