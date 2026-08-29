# 🔍 Backlog de Sprints — Consulta de Crédito (SPC/Serasa)

> **Fonte de verdade** para permitir consultar a situação de crédito de um paciente (score,
> negativação, pendências) antes de fechar um plano de pagamento parcelado/maior — reduz
> inadimplência em tratamentos de ticket alto.

---

## 🎯 Objetivo
Botão "Consultar crédito" na ficha do paciente, retornando um resumo (score + pendências/negativação)
para apoiar a decisão de aceitar parcelamento, pedir entrada maior, ou negar crédito direto.

## 🧱 Decisões de arquitetura (a confirmar antes da CR1)
- **Provedor**: contrato direto com **SPC Brasil** ou **Serasa Experian** (planos empresariais, cobrança
  por consulta avulsa ~R$5–15 ou pacote mensal ~R$50–500 conforme volume) **ou** um agregador tipo
  **API Brasil** (onboarding mais rápido, teste grátis de 7 dias, mas é intermediário — checar
  confiabilidade/SLA antes de bater o martelo).
- **LGPD — consentimento obrigatório**: dado de crédito é dado sensível regulado. A clínica só pode
  consultar com **consentimento explícito do paciente** (capturar antes da consulta, guardar
  data/hora/meio do consentimento). Sem isso, não implementar.
- **Custo por consulta**: decidir se repassa ao paciente, embute no plano da clínica, ou é add-on
  cobrado à parte por consulta.
- **Quem pode consultar**: provavelmente Admin/Gerente/Recepção (mesma régua do Financeiro) — dentista
  não precisa desse dado.

---

## 📇 Sprint CR1 — Provedor, contrato & consentimento (LGPD)
- [ ] CR1.1: Decidir provedor (direto SPC/Serasa vs. agregador) e fechar contrato/sandbox.
- [ ] CR1.2: Modelo de **termo de consentimento** do paciente (texto, versão, aceite com data/hora) —
      sem consentimento ativo e vigente, a ação de consultar fica bloqueada.
- [ ] CR1.3: Definir e documentar o custo por consulta e quem paga.

## 🔎 Sprint CR2 — Consulta na ficha do paciente
- [ ] CR2.1: Ação "Consultar crédito" (exige o consentimento da CR1.2 já registrado).
- [ ] CR2.2: Chamada ao provedor + exibição do resultado (score, negativação, protestos) na ficha.
- [ ] CR2.3: Tratamento de erro/indisponibilidade do provedor com mensagem clara (não trava a tela).

## 📜 Sprint CR3 — Auditoria & controle de uso
- [ ] CR3.1: Log de toda consulta feita (quem consultou, quando, paciente, resultado resumido) — auditoria.
- [ ] CR3.2: Limite de consultas por plano/mês (evita custo descontrolado) + aviso ao se aproximar do limite.
- [ ] CR3.3: Vendor Admin: visão de consumo de consultas por clínica (custo repassado).

## ✅ Sprint CR4 — Testes & go-live
- [ ] CR4.1: Testes (com/sem consentimento, provedor fora do ar, limite atingido).
- [ ] CR4.2: Revisão de segurança (dado sensível — quem acessa, retenção, mascaramento em log).
- [ ] CR4.3: Docs + deploy + gating por plano (se for feature paga à parte).

---

## Notas
- Isso é dado de **crédito do paciente**, não do paciente enquanto ficha clínica — manter separado do
  prontuário (não misturar com Anamnese/Ficha clínica).
- Reavaliar a real demanda antes de priorizar — validar com poucas clínicas piloto se o caso de uso
  (parcelamento de tratamento caro) é frequente o bastante para justificar o custo por consulta.
