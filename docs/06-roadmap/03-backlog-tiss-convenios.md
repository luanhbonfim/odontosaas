# 🧾 Backlog de Sprints — Padrão TISS & Integração com Convênios

> **Fonte de verdade** para tornar o faturamento de convênios **de verdade no padrão da ANS (TISS)**:
> gerar guias no formato oficial, exportar lotes e **receber os retornos/glosas** no sistema.
>
> ⚠️ **O que temos hoje NÃO é TISS.** Existe apenas o modelo `Guia` (`apps/pacientes/models.py`) com
> controle **interno e manual**: número, procedimento (descrição TUSS), valor e ciclo de status
> (Emitida → Autorizada → Executada → Paga/Glosada). **Não** gera XML padrão ANS, **não** troca dados
> com a operadora e **não** importa retorno/demonstrativo. Estas sprints implementam isso de fato.

---

## 🎯 Objetivos
- Gerar guias odontológicas no **padrão TISS vigente da ANS** (GTO — Guia de Tratamento Odontológico e demais tipos), validadas no XSD oficial.
- **Exportar lote** para envio à operadora (portal ou arquivo) e **importar o retorno** (autorização, demonstrativo de pagamento, **glosas**) com conciliação.
- (Fase avançada) Integração **eletrônica direta** por webservice com operadoras que suportam.
- Manter isolamento por clínica (tenant) e a política de estorno/glosa já existente ([[odonto-regras-negocio]]).

## 🧱 Decisões de arquitetura (a confirmar antes da T1)
- **Versão TISS:** fixar a versão vigente da ANS no início da T1 (o padrão é versionado; o XSD muda).
- **Tabelas de domínio:** TUSS (procedimentos), tabela de terminologia TISS, registro ANS da operadora — importar como dados de referência.
- **Cadastro da operadora:** o convênio ([[odonto-convenios]]) precisa de campos TISS (registro ANS, tabelas usadas, dados do prestador/contratado).
- **Reaproveitar** o modelo `Guia` atual como base, estendendo com os campos exigidos pelo TISS.

---

## 📇 Sprint T1 — Cadastro TISS & dados de domínio
- [ ] T1.1: Fixar versão TISS vigente + baixar/versionar os XSD e tabelas de domínio (TUSS/terminologia).
- [ ] T1.2: Estender **Convênio** com dados TISS (registro ANS, tabelas, dados do contratado/prestador).
- [ ] T1.3: Estender **Guia** com os campos obrigatórios do padrão (tipo de guia/GTO, código TUSS estruturado, dente/face/região quando aplicável, profissional executante, etc.).
- [ ] T1.4: Migrations por-schema + backfill seguro dos dados atuais.
- [ ] T1.5: Testes de modelo/validação de campos obrigatórios por tipo de guia.

## 📤 Sprint T2 — Geração & exportação de lote TISS (XML)
- [ ] T2.1: Serviço que monta o **XML no padrão TISS** a partir das guias (por tipo/GTO).
- [ ] T2.2: **Validação contra o XSD** da ANS (erros claros por guia antes de exportar).
- [ ] T2.3: Agrupamento em **lote/protocolo** + numeração e hash exigidos pelo padrão.
- [ ] T2.4: UI: selecionar guias → gerar lote → baixar XML (e/ou versão para o portal da operadora).
- [ ] T2.5: Testes de geração/validação com casos reais (consulta e tratamento odontológico).

## 📥 Sprint T3 — Retorno, demonstrativo & glosas
- [ ] T3.1: **Importar o retorno** da operadora (XML de demonstrativo/pagamento) e casar com as guias enviadas.
- [ ] T3.2: Registrar **glosas** (motivo por procedimento) e atualizar status da guia; disparar a política de estorno já existente.
- [ ] T3.3: Conciliação financeira: valor previsto x autorizado x pago; relatório de pendências/glosas.
- [ ] T3.4: UI de conciliação (lote enviado → retorno → resultado por guia).
- [ ] T3.5: Testes de importação/conciliação e de glosa → estorno.

## 🔌 Sprint T4 — Integração eletrônica (webservice) & go-live
- [ ] T4.1: Conector de **webservice TISS** para operadoras que suportam (envio/consulta de status), atrás de uma abstração (nem toda operadora tem).
- [ ] T4.2: Credenciais por convênio (por tenant), seguras; fallback para exportação por arquivo/portal.
- [ ] T4.3: Auditoria de envios/retornos + reprocessamento.
- [ ] T4.4: Red-team (dados sensíveis, isolamento por tenant) + docs + deploy.
- [ ] T4.5: Atualizar landing/recursos para "Financeiro & TISS" **de verdade** (remover ressalva) e marcar entregue.

---

## Notas
- Enquanto T1–T4 não entregam, a landing/planos **não devem prometer "TISS"** como pronto — usar
  "Financeiro & Guias de Convênio" (controle interno) e, se quiser, um selo "TISS em breve".
- Odontologia usa principalmente a **GTO (Guia de Tratamento Odontológico)** — priorizar esse tipo na T2.
- Integração eletrônica direta (T4) é opcional/por operadora; a maioria das clínicas opera via
  **exportação de lote + portal da operadora** (T2/T3), então T2/T3 já entregam valor real.
