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

- [x] Auditoria/log de ações sensíveis (LGPD)
- [x] Rotina de backup por schema e expurgo de tenant
- [x] Monitoramento (health endpoints, logs estruturados, Sentry opcional)
- [x] Documentação de API (drf-spectacular / OpenAPI)
- [x] Revisão de segurança e testes de carga básicos

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

### Autenticação & segurança de API (pré-requisito do frontend)
- [x] **JWT** (`djangorestframework-simplejwt`): `POST /api/auth/token/` (login por e-mail), `/refresh/` e `/verify/`.
- [x] API protegida por padrão (`DEFAULT_PERMISSION_CLASSES = IsAuthenticated` + `JWTAuthentication`); docs/health públicos.
- [x] Testes de auth (401 sem token, login válido/inválido, acesso com Bearer, refresh); auto-autenticação dos testes de API via `conftest.py`.
- [x] **Bloqueio por força bruta** no login (`LoginView`): 5 tentativas de senha erradas **por IP** de origem → bloqueia 15 min (contador no cache Redis, zera no login bem-sucedido; retorna `429` com mensagem em PT).
- [x] **Sessão de 24h**: `REFRESH_TOKEN_LIFETIME = 24h` (access de 30 min renovado pelo frontend); após 24h o refresh expira e encerra o login.
- [x] **Cache no Redis** (`CACHES` → `RedisCache`, db 2) para estado compartilhado entre workers.
- [x] Endpoint **`GET /api/auth/me/`** (usuário logado: `id`, `email`, `nome_completo`, `papel`, `papel_display` + `clinica`) — base do contexto de sessão do frontend (F1 tarefa 3).

### Perfis de acesso & permissões (DEFINIDA — pronta p/ implementar na F1 tarefa 5)
> Perfis padrão do sistema, para condicionar menus/ações (frontend, F1 tarefa 5) e proteger endpoints (backend).
>
> **Papéis finais (decisão do usuário):** `RECEPCAO`, `DENTISTA`, `DENTISTA_GERENTE`, `ADMIN`. → **remover `FINANCEIRO`** e **adicionar `DENTISTA_GERENTE`** no `usuarios.Papel` (migração de schema; migrar eventuais usuários `FINANCEIRO` → `ADMIN`).
>
> **Mecanismo (decisão):** usar o ecossistema nativo do Django — `Group` + `Permission` + Admin, enforcement no DRF via `DjangoModelPermissions`/permission classes. Como `auth` está em **TENANT_APPS**, os grupos vivem **por-tenant** → **semear os 4 grupos padrão no `provisionar_clinica`** (e criar um data migration/command para os tenants existentes). Abordagem **híbrida**: `papel` continua sendo o "perfil padrão" exibido (`/api/auth/me/`, menu do frontend) e **mapeia para o `Group`** correspondente, que carrega as permissões reais. Regra: **frontend** esconde menus por `papel` (cosmético); **backend** barra de fato por permissão. Módulo = conjunto de permissões de model (mapear cada módulo às `view/add/change/delete` dos models envolvidos, ou permissões custom por módulo).

- [x] **Matriz de permissões definida** (módulo × perfil) — legenda: **✔** total · **👁** só leitura · **✖** sem acesso:

  | Módulo | Recepção | Dentista | Dentista Gerente | Admin |
  |---|:--:|:--:|:--:|:--:|
  | Dashboard | 👁¹ | 👁¹ | ✔ | ✔ |
  | Agenda (agendamentos) | ✔ | ✔² | ✔ | ✔ |
  | Pacientes (planos, guias, anamnese) | ✔ | ✔ | ✔ | ✔ |
  | Dentistas (cadastro) | 👁 | 👁 | ✔ | ✔ |
  | Estoque / Insumos | ✔ | 👁³ | ✔ | ✔ |
  | Financeiro / Faturamento | ✖ | ✖ | ✔ | ✔ |
  | Notificações (WhatsApp) | ✔ | ✖ | ✔ | ✔ |
  | Auditoria (LGPD/logs) | ✖ | ✖ | 👁 | ✔ |
  | Usuários (equipe) | ✖ | ✖ | ✔ | ✔ |
  | Configurações / Plataforma | ✖ | ✖ | ✖ | ✔ |

  1. Dashboard acessível a todos, mas as seções/KPIs de **Financeiro** só aparecem para quem tem permissão de Financeiro.
  2. **Escopo de dados do DENTISTA (row-level, ver abaixo)**: o dentista comum vê apenas o que é **seu** (dashboard, pacientes, agenda/consultas). Gerente/Recepção/Admin têm visão geral.
  3. Dentista no Estoque: ver + **registrar consumo**; movimentar/repor estoque fica com Gerente/Admin.
  4. Dentista Gerente gerencia a **equipe** (usuários), mas **não** mexe em configurações de plataforma/plano (só Admin).

#### Escopo de dados do Dentista (row-level — A IMPLEMENTAR nas sprints correspondentes)
> Além da permissão por módulo, o papel **DENTISTA** enxerga apenas os **próprios** dados. **Imposto no backend** (querysets filtrados pelo dentista logado — `request.user.dentista`); o frontend só reflete. **Gerente/Recepção/Admin = clínica toda.**
>
> **"Seus pacientes" (decisão do usuário): responsável OU quem atende** → um paciente é do dentista se ele for o `dentista_responsavel` **ou** tiver alguma consulta com ele. Exige novo campo **`Paciente.dentista_responsavel`** (FK opcional) + UI para atribuir (F3).

- [x] **F3 (Pacientes) — FEITO:** `Paciente.dentista_responsavel` (FK) **+ `dentistas_compartilhados` (M2M)** + UI para atribuir; escopo em `apps/core/mixins.py::escopo_dentista_q` (responsável **ou** compartilhado **ou** com consulta), reusado pelo `PacienteViewSet`; demais papéis = todos.
- [x] **F4 (Agenda/Consultas) — FEITO:** `ConsultaViewSet`/`AnamneseViewSet` usam `FiltraPorPacienteMixin` + `escopo_dentista_q` (também planos/guias — N1 corrigido).
- [ ] **Dashboard:** KPIs/consultas do dentista limitados aos dele (quando ligar aos endpoints reais).
- [x] **Estoque/Insumos:** permanece **geral** (todos) — decisão do usuário (settled).
- [x] **Testes — FEITO:** dentista A não vê dados do dentista B (inclusive relações); gerente/recepção/admin veem tudo (`test_pacientes_api.py`).

- [x] Backend (F1 tarefa 5a): `usuarios.Papel` ajustado (remove FINANCEIRO, add DENTISTA_GERENTE + data migration); 4 grupos + permissões por tenant (`perfis.sincronizar_grupos`, semeado no `provisionar_clinica` + command `sincronizar_perfis` p/ tenants existentes); `papel→Group` via signal; enforcement global via `perfis.PermissaoModulo` (DjangoModelPermissions + fallback p/ views sem model). Testes: matriz por perfil (Recepção 403 no financeiro, Gerente/Admin 200; leitura vs escrita).
- [x] Frontend (F1 tarefa 5) — FEITO: menus ocultos conforme o perfil (`routes/nav.ts::itensNavPorPapel`) + ações por papel (dentistas/usuários) e campos do paciente (N2 UI).

### Qualidade
- [x] Suíte: **182 testes** · **~100%** de cobertura · `ruff` lint+format limpos · `check --deploy` sem avisos.

---

## 🧩 Pendências de regras de negócio — efeitos colaterais & estornos (revisão pós-F3)

> Revisão geral (a pedido do usuário, tendo como exemplo *guia EXECUTADA → GLOSADA não estorna o financeiro*). São **lacunas do mesmo tipo**: uma transição/edição/exclusão que **deveria** disparar ou **reverter** um efeito colateral (financeiro, estoque, Google, notificação) e hoje **não** trata. Nenhuma está em sprint. Severidade entre parênteses. **A definir prioridade/ordem com o usuário.**
>
> **Causa-raiz comum:** os signals só **criam** (idempotência unidirecional via `exists()`); não há caminho de **estorno**. Além disso, o PATCH/DELETE genérico de `ConsultaViewSet`/`GuiaViewSet` **burla** as transições que só são checadas nas actions dedicadas (`iniciar`/`finalizar`, `validate_status`).

> **✅ CORRIGIDO E VALIDADO nesta rodada (suíte 224 passed; testes tardios — guarda quitar-cancelado e exclusão de consulta — em runs focados):** N1 (vazamento entre dentistas nas relações) · N20 (CPF obrigatório) · **estorno automático** de guia GLOSADA e consulta CANCELADA (conta a receber, se não paga) · N13 (`vencimento` nas contas auto) · N15 (`faturar` só PENDENTE) · **estoque devolvido** ao cancelar consulta · estoque negativo permitido+alertado (já era o comportamento) · N9 (reenvio de lembrete após falha) · N12 (paciente inativo não recebe lembrete) · **P1** (bloqueia guia em plano não-ATIVO) · **N5** (valor da guia ≥ 0) · **G1** (anamnese ↔ mesmo paciente da consulta) · **N2** (reatribuir só Gerente/Admin/Recepção; dentista vira responsável ao cadastrar) · **N18** (auditoria cobre Usuario/Guia/LancamentoFinanceiro/Fatura) · **Google A1/A2** (deleta evento no Google ao cancelar / re-sincroniza ao reagendar, via signal em `Consulta` + task) · **N2 UI** (form do paciente esconde os campos responsável/compartilhamento para o dentista comum — o backend já os ignorava) · **Financeiro secundário** (F2 excluir guia/consulta cancela a conta órfã · F3 sincroniza o valor editado · F6 recalcula `Fatura.valor_total` · action `estornar` + guarda quitar-cancelado · **F4 já coberto** por `validate_status` em Consulta/Guia) · **Estoque secundário** (E4/E5 editar/excluir consumo ajusta/devolve via FK `MovimentacaoEstoque.consumo` · E6 idempotência por-consumo · E7 `CheckConstraint quantidade>0` · excluir consulta devolve o estoque via cascade).
>
> **✅ DECISÕES DE PRODUTO — implementadas e validadas (rodadas 1–2):** **N3** (bloqueia agendar no passado; permite lançar REALIZADA/FALTOU) · **N4** (bloqueia guia em plano vencido) · **N8** (bloqueia sobreposição de consultas do paciente) · **excluir dentista** (bloqueia se responsável/compartilhado — exige reatribuição) · **FALTOU** → remove evento do Google · **RECUSADA** (WhatsApp) → cancela a consulta automaticamente. _Sem alteração por decisão:_ **N16/N17** (provisionar não semeia nada) · **N11** (mantém heurística de matching) · **N6** (permite múltiplos planos ativos por convênio).
>
> **⏳ RESTA:** **N7** (validar dígito verificador do CPF — decidido *validar*, mas exige atualizar ~30 fixtures de teste que usam CPF fake via API; a implementar como passo dedicado); e pontas menores (excluir consulta sincronizada não limpa o Google — só cancelamento/FALTOU; marcar a própria `Fatura` GLOSADA cancelar as contas membras).

### Financeiro (estornos)
- [x] **(CRÍTICA — CORRIGIDO) Guia EXECUTADA → GLOSADA:** estorna/cancela a conta a receber (se não paga) via `estornar_conta_da_guia` no signal. _(o exemplo — rodada anterior)_
- [x] **(ALTA — CORRIGIDO) Guia excluída após gerar conta (F2):** `pre_delete` em `Guia` cancela a conta PENDENTE antes do `SET_NULL` (não fica mais órfã e contada). Teste `test_excluir_guia_cancela_conta_pendente`.
- [x] **(ALTA — CORRIGIDO) `guia.valor`/`consulta.valor` editado após gerar conta (F3):** `sincronizar_valor_conta_da_*` atualiza a conta PENDENTE no signal (conta já PAGA não é tocada). Teste `test_editar_valor_da_guia_sincroniza_conta`.
- [x] **(ALTA — CORRIGIDO) Consulta REALIZADA revertida/editada via PATCH genérico (F4):** as transições já são impostas por `validate_status` (Consulta **e** Guia); CANCELADA estorna a conta (rodada anterior) e F3 sincroniza o valor.
- [x] **(ALTA — CORRIGIDO) `Fatura.valor_total` recalculado (F6):** `recalcular_total_fatura` roda ao glosar/estornar/editar valor de um lançamento membro (soma só os não cancelados). Teste `test_glosa_apos_faturar_recalcula_total_da_fatura`. _(Resta o sentido inverso — marcar a própria `Fatura` GLOSADA cancelar as contas membras — decisão de produto.)_
- [x] **(MÉDIA — CORRIGIDO) Quitação reversível:** action `estornar` (PAGO→PENDENTE, limpa `pago_em`) + guarda contra quitar conta CANCELADA. Testes `test_quitar_e_estornar_lancamento` e `test_nao_quita_lancamento_cancelado`.
- [x] **(base — FEITO) Mecânica única de estorno** de `LancamentoFinanceiro`: helper `_cancelar_contas_pendentes` (reusado por guia/consulta e pelas exclusões) + `_sincronizar_valor` + `recalcular_total_fatura`.

### Estoque (reversões)
- [x] **(ALTA — CORRIGIDO) Consulta cancelada não revertia a baixa:** `reverter_baixa_consulta` no signal de CANCELADA devolve os insumos (rodada anterior). Teste `test_cancelar_consulta_devolve_estoque`.
- [x] **(ALTA — CORRIGIDO) Excluir consulta após baixa:** apagar a consulta faz cascade nos `ConsumoInsumo` → cada `pre_delete` remove a SAÍDA (devolve o estoque, sem órfã). Teste `test_excluir_consulta_realizada_devolve_estoque`.
- [x] **(MÉDIA-ALTA — POR DECISÃO) Estoque negativo permitido:** decisão de produto — saldo pode ficar < 0; o alerta é via `estoque_baixo` (mínimo). Ver [[odonto-regras-negocio]].
- [x] **(MÉDIA — CORRIGIDO) Editar/excluir `ConsumoInsumo` após a baixa (E4/E5):** novo FK `MovimentacaoEstoque.consumo` liga a SAÍDA ao consumo; `post_save` ajusta a quantidade e `pre_delete` remove/devolve. Testes `test_editar_consumo_ajusta_saida`, `test_excluir_consumo_devolve_estoque`.
- [x] **(MÉDIA — CORRIGIDO) Idempotência por-consumo (E6):** `post_save` em `ConsumoInsumo` cria a SAÍDA de um consumo adicionado após a consulta já estar REALIZADA. Teste `test_consumo_adicionado_apos_realizar_baixa_estoque`.
- [x] **(BAIXA — CORRIGIDO) `quantidade > 0` (E7):** `CheckConstraint` no model (`MovimentacaoEstoque` e `ConsumoInsumo`), migration `0003`. Teste `test_quantidade_positiva_imposta_pelo_banco`.

### Agenda / Consulta (cancelamento, reagendamento, no-show)
- [x] **(ALTA — CORRIGIDO) Consulta CANCELADA deleta o evento no Google.** Novo `remover_evento()` (`events().delete()`, tolera 404/410 via `contextlib.suppress(HttpError)` e limpa o espelho `AgendaEvento`) + task `remover_evento_google` + signal `post_save` em `Consulta`. Testes com mock em `tests/test_google_sync.py`.
- [x] **(ALTA — CORRIGIDO) Reagendamento re-sincroniza o Google.** O mesmo signal re-chama `sincronizar_evento_google` quando uma consulta **já sincronizada** (tem `google_event_id`) muda; guarda anti-loop ignora o save do próprio fluxo de sync (`update_fields ⊆ {google_event_id, atualizado_em}`).
- [x] **(MÉDIA — POR DECISÃO) Consulta CANCELADA não notifica:** decisão do usuário — o cancelamento não avisa o paciente; o template `CANCELAMENTO` fica sem uso de propósito.
- [x] **(MÉDIA — CORRIGIDO) FALTOU (no-show):** decisão = registrar + **remover o evento do Google** (signal da agenda trata FALTOU como o cancelamento). Sem taxa, por decisão. Teste `test_signal_faltou_remove_no_google`.
- [x] **(MÉDIA — CORRIGIDO) RECUSADA:** decisão = **cancelar a consulta automaticamente** (libera o horário + limpa o Google via signal de CANCELADA). No `inbound.py`, no ramo RECUSA. Teste `test_recusa_atualiza_status_sem_sync`.
- [x] **(BAIXA — POR DESIGN) Cancelar não dispara lembrete:** o lembrete é calculado on-the-fly pela Beat query (`status=AGENDADA` + `status_confirmacao=PENDENTE`); não há job pré-enfileirado por consulta a cancelar — cancelar já a exclui da query. _(Re-lembrar ao reagendar seria outro item, ligado ao N11.)_
- [x] **(BAIXA — FEITO) Action "estornar consulta realizada":** `POST /api/consultas/{id}/estornar/` leva a consulta REALIZADA de volta a CANCELADA, revertendo a baixa de estoque **e** a conta a receber (via signals). Teste `test_estornar_consulta_realizada_reverte_estoque_e_financeiro`.

### Planos / Convênios / Pacientes / Dentistas (ciclo de vida)
- [x] **(ALTA — FEITO/P1) Guias em plano não-ATIVO:** `GuiaSerializer.validate` bloqueia emitir guia em plano SUSPENSO/CANCELADO (`test_validacoes_guia_e_anamnese`). _(Resta só cascatear para guias já EM ANDAMENTO quando o plano é suspenso — item menor.)_
- [x] **(MÉDIA — FEITO/N12) Paciente inativado não recebe lembretes:** filtro `paciente__ativo=True` na query de lembretes (`test_paciente_inativo_nao_recebe_lembrete`).
- [x] **(MÉDIA — FEITO) Convênio inativo some do select do plano:** o seletor filtra `ativo`, mantendo o convênio **já vinculado** ao editar (mesmo inativo). Frontend `aba-planos.tsx` + teste.
- [x] **(BAIXA/MÉD — CORRIGIDO) Excluir dentista responsável/compartilhado:** `DentistaViewSet.destroy` **bloqueia (400)** se houver pacientes vinculados (responsável ou compartilhado) — exige reatribuir antes. Teste `test_nao_exclui_dentista_com_pacientes_vinculados`.
- [x] **(BAIXA — FEITO/G1) `AnamneseSerializer` valida `consulta.paciente == paciente`** (`test_validacoes_guia_e_anamnese`). _(Excluir consulta órfã a anamnese: `SET_NULL`, menor.)_

### Descobertas adicionais (auditoria de completude) + segurança/validação
- [x] **(CRÍTICA — CORRIGIDO) N1: vazamento entre dentistas nas relações.** `/api/planos/`, `/api/guias/`, `/api/consultas/`, `/api/anamneses/` aplicavam só `?paciente=` (sem escopo do dentista) → um DENTISTA listava/lia/editava dados de qualquer paciente (inclusive anamnese). **Fix:** `FiltraPorPacienteMixin` agora aplica o escopo do dentista (helper `escopo_dentista_q`, reusado pelo `PacienteViewSet`); fail-closed. Teste `test_dentista_nao_ve_relacoes_de_paciente_fora_do_escopo`.
- [x] **(MÉDIA — CORRIGIDO) N20: CPF deixou de ser obrigatório na API** (regressão: `extra_kwargs` do CPF caiu para dentro de um método ao adicionar o compartilhamento). **Fix:** voltou pro `Meta`; teste "sem CPF → 400".
- [x] **(ALTA — FEITO) N2:** reatribuir `dentista_responsavel`/`dentistas_compartilhados` só Gerente/Admin/Recepção (Dentista comum = read-only; auto-vira responsável ao cadastrar).
- [x] **(ALTA — FEITO) N9:** lembrete reenviado após falha — filtro por `status=ENVIADA` (`test_erro_no_envio_e_reenviado_na_proxima`).
- [x] **(ALTA — FEITO) N18:** auditoria cobre Usuario/Guia/LancamentoFinanceiro/Fatura (`test_audita_usuario_e_guia`). _(Diff before/after = N19, ainda pendente/baixa.)_
- [x] **(MÉDIA — FEITO) N13:** contas auto-geradas recebem `vencimento = data de geração`.
- [x] **(MÉDIA — FEITO) N15:** `faturar_operadora` agrupa só `status=PENDENTE`.
- [x] **(MÉDIA — CORRIGIDO) N4:** guia bloqueada em plano com `validade` vencida (`GuiaSerializer`, na emissão e ao executar). Teste `test_n4_bloqueia_guia_em_plano_vencido`.
- [x] **(MÉDIA — CORRIGIDO) N3:** bloqueia agendar no passado (AGENDADA/EM_ATENDIMENTO); permite lançar atendimento já ocorrido (REALIZADA/FALTOU). Teste `test_n3_nao_agenda_no_passado_mas_permite_lancar_realizada`.
- [x] **(MÉDIA — POR DECISÃO) N11:** **manter** a heurística de matching (`endswith`/substring) — tolera variação de DDD/formato. Sem alteração.
- [x] **(MÉDIA — POR DECISÃO) N16/N17:** `provisionar_clinica` **não semeia nada** (cadastro manual). Sem alteração. _(Re-sync de perfis de tenants existentes segue como tarefa técnica se novos módulos exigirem.)_
- [x] **(BAIXA — FEITO) N5:** valor da guia não pode ser negativo (`GuiaSerializer.validate_valor`; guia só gera conta com valor > 0).
- [ ] **(BAIXA) N7 [decidido: VALIDAR — pendente]:** validar dígito verificador do CPF. Decidido *validar*; implementar como passo dedicado (exige trocar ~30 fixtures de teste que hoje usam CPF fake via API).
- [x] **(BAIXA) N8 (CORRIGIDO):** bloqueia sobreposição de consultas do paciente (`test_n8_bloqueia_sobreposicao_do_paciente`). **N6 (POR DECISÃO):** permite múltiplos planos ativos por convênio (sem alteração). **N19:** trilha sem before/after — pendente (baixa).

_(Revisão feita por 4 auditorias paralelas — financeiro, estoque, agenda/notificações/ciclo de vida e completude/segurança. **N1 e N20 já corrigidos e testados**; os demais **não verificados 1-a-1** — validar/priorizar antes de implementar. `[CLEAR-FIX]` = correção óbvia; `[PRODUCT-DECISION]` = precisa de política sua.)_

---

_Última atualização de estado: **Sprint 9 concluída (100%) — PROJETO COMPLETO (Sprints 0–9)**. Hardening & entrega: auditoria/LGPD (signals em Paciente/Anamnese + `/api/auditoria/`); backup por schema e expurgo de tenant (`backup_tenant`/`expurgar_tenant`); monitoramento (`/health/` liveness + `/health/ready/` readiness, logs JSON, Sentry opcional); documentação de API OpenAPI (`/api/schema/`, `/api/docs/`, `/api/redoc/`); revisão de segurança (`check --deploy` sem avisos) e teste de carga (locust). **Pós-projeto:** revisão de regras de negócio & efeitos colaterais (Google A1/A2, financeiro/estoque secundários, escopo do dentista N1, decisões de produto N3/N4/N8/FALTOU/RECUSA/excluir-dentista) — ver blocos "✅ CORRIGIDO E VALIDADO" e "DECISÕES DE PRODUTO" acima. **Suíte atual: pytest 231 passed** + ruff limpo (frontend também verde). Pendências abertas: **N7** (dígito verificador do CPF, adiado — no chip) e **Dashboard por-dentista** (aguarda o dashboard ligar aos endpoints reais). Demais itens da revisão — inclusive convênio inativo no select, action estornar-consulta e o lembrete (coberto por design) — concluídos._
