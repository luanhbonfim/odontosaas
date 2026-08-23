# 🗺️ Plano de Sprints — Validar Planos/Permissões & Desenvolver Novas Funcionalidades

> **Índice-mestre** que sequencia o que vamos **validar** (planos, limites e permissões) e o que
> vamos **desenvolver** (armazenamento 1 GB, IA para o dentista, limite de pacientes). Cada bloco
> aponta para o backlog detalhado quando existir.
>
> Ordem recomendada: **validar a base (V) → construir em cima (armazenamento → IA)**. Não faz sentido
> desenvolver features de plano sem antes garantir que o enforcement de limites/permissões está correto.

---

## 📌 Estado atual (baseline)
- **Planos padrão** (seed idempotente, migration `0004_seed_planos_padrao`):
  | Plano | Preço | Dentistas | Usuários | Pacientes | Armazenamento | Financeiro | Estoque | Google | WhatsApp | IA |
  |---|---|---|---|---|---|---|---|---|---|---|
  | Essencial | R$30/mês | 3 | 5 | 600 | 1 GB | ✗ | ✗ | ✓ | ✓ | ✗ |
  | Profissional | R$79/mês | 6 | 12 | 2000 | 5 GB | ✓ | ✓ | ✓ | ✓ | ✓ (em breve) |
  | Premium | R$149/mês | ∞ | ∞ | ∞ | 20 GB | ✓ | ✓ | ✓ | ✓ | ✓ (em breve) |
- **Armazenamento:** só existe o campo de cota — **sem upload nem medição** (marcado "em breve").
- **IA:** apenas anunciada na landing/planos (marcada "em breve").
- **Limites (dentistas/usuários/pacientes):** campos existem no plano — **enforcement precisa ser auditado** (é o objeto da Sprint V).

---

## ✅ Sprint V — Validar Planos, Limites & Permissões
> Garantir que o que o plano promete é **de fato aplicado** no backend (não só exibido). Nada de novo
> aqui é "feature de venda" — é a fundação de confiança dos planos.

- [ ] V.1: Auditar **enforcement do limite de dentistas** — ao cadastrar dentista além do `limite_dentistas`, bloquear com mensagem clara + sugestão de upgrade.
- [ ] V.2: Auditar **enforcement do limite de usuários** (`limite_usuarios`) na criação de usuários.
- [ ] V.3: Auditar **enforcement do limite de pacientes ativos** (`limite_pacientes_ativos`) — ver Sprint P.
- [ ] V.4: Auditar **gating de módulos** por plano: Financeiro/TISS e Estoque só acessíveis quando `modulo_*_ativo` (rota + UI escondida + API 403).
- [ ] V.5: Auditar **gating de integrações**: Google (`sync_google_ativo`) e WhatsApp (`whatsapp_waha_ativo`).
- [ ] V.6: Revalidar a **matriz de papéis** (Admin/Gerente/Dentista/Recepção) — reconfirmar `pode_gerenciar` em todo endpoint que muta `Usuario` (ver [[odonto-hierarquia-usuarios]]) e escopo do dentista.
- [ ] V.7: Comportamento de **plano vencido/trocado**: bloqueios e telas de upsell coerentes (trocar/renovar).
- [ ] V.8: Suíte de testes de enforcement por plano (Essencial vs Profissional vs Premium) — casos no limite e acima.

## 👥 Sprint P — Limite de Pacientes Ativos (enforcement + UX)
> Tornar `limite_pacientes_ativos` real e amigável.

- [ ] P.1: Definir "paciente ativo" (regra de negócio — ex.: não arquivado / com atividade) e contagem por schema.
- [ ] P.2: Enforcement ao cadastrar/reativar paciente acima da cota (bloqueio + mensagem + CTA de upgrade).
- [ ] P.3: Indicador de uso (X de Y pacientes) em **Meu Plano** e aviso ao se aproximar do limite.
- [ ] P.4: Vendor Admin: consumo real de pacientes por clínica.
- [ ] P.5: Testes (no limite, acima, arquivar libera vaga).

## ☁️ Sprint(s) A — Armazenamento em Nuvem (1 GB no Essencial)
> Detalhe completo em **[01-backlog-armazenamento-nuvem.md](01-backlog-armazenamento-nuvem.md)** (AS1–AS4).
> Resumo: infra de storage S3-compatível + modelo `Anexo` → upload nas telas (raio-X/exames/foto 3x4)
> → consumo real & **enforcement da cota** (1 GB Essencial / 5 GB Profissional / 20 GB Premium) →
> segurança/limpeza/deploy. Ao concluir, **remover "em breve"** do armazenamento.

- [ ] AS1 — Infra de storage & modelo de Anexo
- [ ] AS2 — Upload nas telas (raio-X, exames, foto 3x4)
- [ ] AS3 — Consumo real & cota por plano (remove "em breve")
- [ ] AS4 — Segurança, limpeza & deploy

## 🤖 Sprint(s) IA — Assistente com IA para o Dentista
> Detalhe completo em **[02-backlog-ia-assistente-dentista.md](02-backlog-ia-assistente-dentista.md)** (IA1–IA4).
> Resumo: infra LLM (Claude API) + LangChain com tool-calling escopado por tenant/papel → tools de
> Financeiro/Estoque/Agenda/Produção → UI de chat no app → cotas/custos/**gating por plano**
> (Profissional+; Essencial vê upsell) e go-live. Ao concluir, **remover "em breve"** da IA.

- [ ] IA1 — Infra LLM + orquestração + endpoint seguro
- [ ] IA2 — Ferramentas (tools) de consulta
- [ ] IA3 — UI do assistente no app da clínica
- [ ] IA4 — Cotas, custos, gating por plano & go-live

---

## 🎯 Sequência sugerida
1. **Sprint V** (fundação: planos/permissões confiáveis) →
2. **Sprint P** (pacientes — fecha o último limite não aplicado) →
3. **Armazenamento AS1→AS4** (1 GB e acima, remove "em breve") →
4. **IA IA1→IA4** (diferencial de venda, remove "em breve").

## 🧾 Definição de pronto (por bloco)
- Enforcement testado nos 3 planos (no limite e acima).
- UI esconde o que o plano não tem + API retorna 403 (defesa em profundidade).
- Mensagens de limite com CTA de upgrade.
- "em breve" removido apenas quando a feature está **de fato** funcionando em produção.
- Gates verdes (backend: pytest + ruff; frontend: tsc + eslint + vitest + build) + deploy verificado.
