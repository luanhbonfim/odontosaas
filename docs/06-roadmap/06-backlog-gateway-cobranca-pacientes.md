# 💳 Backlog de Sprints — Gateway de Pagamento (cobrança de pacientes)

> **Fonte de verdade** para a clínica cobrar o **paciente dela** (boleto/Pix/cartão) direto pelo
> Financeiro, em vez de só controle manual de "pago/pendente".
>
> ⚠️ **Não confundir** com `docs/02-backlog-tenants/03-planos-pagamentos.md`, que é sobre **nós
> cobrarmos a clínica** pela assinatura do SaaS — são dois gateways/integrações com propósitos
> diferentes (podem até ser o mesmo provedor, mas são contas/fluxos distintos).

---

## 🎯 Objetivo
Emitir cobrança (boleto e, se possível, Pix/cartão) a partir de um lançamento do Financeiro (Contas a
Receber) e dar baixa **automática** quando o paciente pagar.

## 🧱 Decisões de arquitetura (pesquisado em 2026-08, confirmar antes da GP1)
- **Boleto direto via banco (CNAB) foi descartado como via principal.** Exigiria um **convênio de
  cobrança** por clínica — produto bancário de conta **PJ**, com análise comercial do banco. Boa parte
  do público (dentistas autônomos, sem CNPJ) ficaria de fora, e o sistema teria que suportar múltiplos
  layouts CNAB (um por banco) + processamento de retorno em lote (sem webhook em tempo real).
- **Gateway (recomendado: Asaas)** resolve os dois problemas de uma vez:
  - Aceita conta **pessoa física (CPF)**, sem precisar de CNPJ — cobertura pro dentista autônomo.
  - Sem mensalidade/adesão; cobra só quando o boleto é **pago** (~R$0,99 nos 3 primeiros meses, depois
    ~R$1,99 por boleto pago, tabela pública sujeita a mudança — reconfirmar na GP1).
  - Tem **subconta white-label**, feita para SaaS que cobra em nome de vários clientes: cada clínica
    ganha subconta própria (separação financeira real — o dinheiro cai pra ela), mantendo **uma única
    integração** do nosso lado, com **webhook em tempo real** (sem lidar com arquivo de retorno bancário).
  - Alternativa avaliada: **Pagar.me** — mais caro pra esse volume (~R$3,49 + R$0,99 por boleto pago no
    plano padrão), parece mais voltado a negócios maiores.
- **Nunca guardar dado de cartão** no nosso banco — mesma regra já vale para o gateway da assinatura
  do SaaS (ver `03-planos-pagamentos.md`).

---

## 📇 Sprint GP1 — Decisão final & onboarding da clínica
- [ ] GP1.1: Confirmar gateway (Asaas ou reavaliar alternativas) e criar a conta master/white-label.
- [ ] GP1.2: Fluxo de onboarding: clínica cria subconta (CPF ou CNPJ) direto do app, KYC (documento + selfie).
- [ ] GP1.3: Guardar `subconta_id`/credenciais do gateway por tenant (`apps.tenants` ou `apps.plataforma`).

## 💸 Sprint GP2 — Emitir cobrança a partir do Financeiro
- [ ] GP2.1: Ação "Cobrar" num Lançamento (Contas a Receber) — escolher forma (boleto/Pix/cartão).
- [ ] GP2.2: Chamar a API do gateway (na subconta da clínica) e guardar o id da cobrança/link/linha digitável.
- [ ] GP2.3: Enviar o boleto/link ao paciente (e-mail/WhatsApp, reaproveitando `apps.notificacoes`).

## 🔔 Sprint GP3 — Webhook & conciliação
- [ ] GP3.1: Endpoint de webhook do gateway (pagamento confirmado/vencido/estornado).
- [ ] GP3.2: Baixa automática do Lançamento ao confirmar pagamento + notificação de confirmação.
- [ ] GP3.3: Tratamento de cobrança vencida/cancelada (reenviar, cancelar, gerar nova).

## 📊 Sprint GP4 — Painel, testes & go-live
- [ ] GP4.1: Painel de cobranças emitidas (status, reenviar, cancelar) no Financeiro.
- [ ] GP4.2: Testes (emissão, webhook de pagamento, falha do gateway) + segurança (segredos no `.env`, nunca no git).
- [ ] GP4.3: Gating por plano (se entrar como diferencial pago) + docs + deploy.

---

## Notas
- Reaproveita a decisão de infraestrutura já tomada para a assinatura do SaaS (HTTPS + endpoint de
  webhook, sem mudar a escolha de VPS) — ver `03-planos-pagamentos.md`.
- Preços/condições do gateway mudam com o tempo — **reconfirmar tabela vigente na GP1**, não confiar
  cegamente no valor anotado aqui.
