# 05 — Planos e Pagamentos (a implementar)

> **Status: planejado (futuro).** Anotado durante a fase de piloto (2026-08).
> Ainda **não** implementado — quando o produto for comercializado, a cobrança das
> clínicas (assinatura do SaaS) será feita por um **gateway de pagamento**.

## Decisão de arquitetura
- **Nunca armazenar dados de cartão** no nosso banco. Isso exigiria certificação
  **PCI-DSS** (inviável). Usamos um **gateway** que guarda o cartão e nos devolve
  apenas um **token / ID de cliente**.
- O gateway cuida de cartão, **Pix**, boleto, cobrança recorrente (assinatura),
  tentativas de recobrança e antifraude.

## Candidatos a gateway (BR)
- **Asaas** ou **Pagar.me** — fortes em BR (Pix + boleto + cartão + assinatura).
- **Mercado Pago** — popular, Pix nativo.
- **Stripe** — excelente DX/assinaturas; Pix mais limitado no BR.

Decisão final na hora da implementação (não trava nada agora).

## Onde encaixa no sistema
- Já existe o app **`apps.plataforma`** (schema `public`) com os **planos de
  assinatura** do SaaS — é ali que a cobrança por clínica se conecta.
- Cada **Clínica (tenant)** terá: plano escolhido, status da assinatura
  (ativa/inadimplente/cancelada) e o **customer/subscription id** do gateway.
- Regras de negócio a definir: trial, bloqueio por inadimplência, upgrade/downgrade.

## Impacto de infraestrutura (mínimo)
- Só precisa de **HTTPS** (já teremos com o Caddy) e um **endpoint de webhook**
  para o gateway avisar pagamento aprovado/falho. Não muda a escolha de VPS.
- Segredos do gateway entram no `.env` de produção (nunca no git).

## Site de vendas (domínio apex `proclinica.cloud`)
O **apex** do domínio é o lugar do **site institucional / página de vendas** do
produto "Pró Clínica" — onde as clínicas vão conhecer o sistema e **se cadastrar/
assinar** (conecta com `apps.plataforma` + o gateway de pagamento).

- **Hoje:** o apex serve uma página **"Pró Clínica — em breve"** (estática, com
  HTTPS válido) — ver `deploy/landing/index.html` e o bloco `proclinica.cloud`,
  `www.proclinica.cloud` no `deploy/Caddyfile`.
- **Futuro:** substituir a "em breve" pela **landing de vendas** (planos, preços,
  formulário de contato/assinatura) e pelo fluxo de **onboarding de novas clínicas**
  (criar tenant + cobrança). Cada clínica cliente continua entrando pelo **seu
  subdomínio** (`clinica.proclinica.cloud`).

## Fora de escopo do piloto
Na fase de teste (consultório da parceira), **não há cobrança** — o foco é validar
o produto. Pagamentos entram na preparação para comercialização.

Relacionado: `docs/04-OBSERVACOES-PAINEL-ADMIN.md` (painel de admin do vendor).
