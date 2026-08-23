# 🤖 Backlog de Sprints — Assistente com IA para o Dentista (LangChain)

> **Fonte de verdade** para o assistente inteligente que responde ao **dentista/gestor**
> sobre a própria clínica: faturamento, estoque, agenda, pacientes e KPIs — em linguagem natural.
>
> **NÃO é chatbot de paciente.** É um copiloto de gestão, por clínica, com acesso **somente
> leitura** aos dados do tenant. Disponível a partir do plano **Profissional** (Essencial não inclui).
>
> Contexto atual: divulgado na landing/planos como "em breve". Estas sprints implementam de verdade.

---

## 🎯 Objetivos
- Responder perguntas como *"Quanto faturei em agosto?"*, *"Quais insumos estão acabando?"*,
  *"Quantas consultas tenho amanhã?"*, *"Qual dentista mais atendeu no mês?"*.
- **Isolamento total por tenant** (a IA só enxerga os dados da clínica logada) e por papel
  (Gerente/Admin; dados financeiros respeitam a matriz de permissões).
- Respostas rápidas, auditáveis e com **guardrails** (sem inventar dados, sem vazar entre clínicas).

## 🧱 Decisões de arquitetura (a confirmar antes da IA1)
- **LLM:** Claude API (Anthropic). Modelo padrão recomendado: `claude-sonnet-5` (custo/latência) com
  opção de `claude-opus-5` para consultas complexas. Chave por `.env` (`ANTHROPIC_API_KEY`).
- **Orquestração:** LangChain (Python) com **tool-calling** — a IA NÃO recebe SQL livre; ela chama
  ferramentas pré-definidas e seguras (funções que já rodam no `schema_context` do tenant).
- **Escopo/segurança:** as tools recebem o schema/tenant do request autenticado (nunca do prompt);
  somente leitura; nada de deletar/alterar. Toda pergunta é auditada.
- **Custo:** rate limit por clínica + cota por plano; cache de respostas frequentes quando fizer sentido.

---

## 🧠 Sprint IA1 — Infra LLM + orquestração + endpoint seguro
- [ ] IA1.1: Dependências (LangChain + SDK Anthropic) e config por `.env` (`ANTHROPIC_API_KEY`, modelo).
- [ ] IA1.2: Endpoint `POST /api/ia/perguntar` (autenticado, por tenant, papéis Gerente/Admin) que roda o agente no `schema_context` correto.
- [ ] IA1.3: Camada de guardrails: system prompt fixo (papel, tom da clínica, "não invente, use as ferramentas"), limite de tokens, timeout.
- [ ] IA1.4: Auditoria: registrar cada pergunta/uso (sem dados sensíveis no log), por operador/tenant.
- [ ] IA1.5: Testes de isolamento (tenant A nunca acessa B) e de recusa quando não há ferramenta/dado.

## 🛠️ Sprint IA2 — Ferramentas (tools) de consulta
- [ ] IA2.1: Tool **Financeiro** — faturamento por período, a receber/a pagar, fluxo de caixa (respeita permissão financeira).
- [ ] IA2.2: Tool **Estoque** — insumos abaixo do mínimo, consumo, itens em falta.
- [ ] IA2.3: Tool **Agenda** — consultas do dia/semana, taxa de confirmação, horários livres.
- [ ] IA2.4: Tool **Pacientes/Produção** — nº de pacientes ativos, procedimentos mais feitos, produção por dentista.
- [ ] IA2.5: Cada tool roda escopada ao schema + papel; testes por ferramenta (dados corretos e barrados quando sem permissão).

## 💬 Sprint IA3 — UI do assistente no app da clínica
- [ ] IA3.1: Tela/painel de chat (acesso Gerente/Admin) com histórico da sessão e sugestões de perguntas.
- [ ] IA3.2: Streaming da resposta (token a token) + estados de carregando/erro.
- [ ] IA3.3: Entrada por atalho no topo/menu; responsivo (mobile).
- [ ] IA3.4: Testes de UI (render, envio, permissão por papel).

## 💳 Sprint IA4 — Cotas, custos, gating por plano & go-live
- [ ] IA4.1: Campo de plano `ia_ativa` (ou reaproveitar tier) — habilitar só do Profissional pra cima; Essencial vê upsell.
- [ ] IA4.2: Rate limit + cota mensal de perguntas por clínica (evitar estouro de custo); mensagem ao atingir.
- [ ] IA4.3: Red-team de segurança (injeção de prompt, tentativa de cross-tenant, exfiltração) e sanitização.
- [ ] IA4.4: Remover "em breve" da IA nos planos/landing; docs + `.env.prod.example`; deploy e verificação.

---

## Notas
- A landing já vende a IA como diferencial ("IA que responde sobre a sua clínica", **em breve**,
  a partir do Profissional). Ao concluir IA4, remover o "em breve" e o gating de landing passa a
  refletir o campo real de plano.
- Reaproveitar os serviços/queries que já existem (dashboard, financeiro, estoque, agenda) como base
  das tools — a IA é uma camada de linguagem natural sobre dados que o sistema já calcula.
