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

## 4. Onde mexer no código (referência rápida)

- Agenda do Beat: `config/settings/base.py` (`CELERY_BEAT_SCHEDULE`).
- Lembretes/recall/aviso: `apps/notificacoes/tasks.py`.
- Reconciliação Google: `apps/integracoes/tasks.py` + `apps/integracoes/google_calendar.py`.
- Config por-clínica: `apps/notificacoes/models.py`, `apps/integracoes/models.py`.
