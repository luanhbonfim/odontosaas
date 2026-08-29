# 🧾 Backlog de Sprints — Emissão de NFS-e (Nota Fiscal de Serviço)

> **Fonte de verdade** para a clínica emitir a nota fiscal do atendimento direto do sistema.
>
> ⚠️ **Não é NF-e.** Odontologia é **serviço**, não venda de mercadoria — o documento fiscal correto
> é a **NFS-e (Nota Fiscal de Serviço Eletrônica)**, de âmbito **municipal** (cada prefeitura tem
> regras/layout próprios), não a NF-e estadual (essa é para produtos/mercadorias). "NFE" no uso comum
> geralmente quer dizer NFS-e nesse contexto — confirmar sempre.

---

## 🎯 Objetivo
Permitir que a clínica emita a NFS-e de um atendimento (particular ou repasse de convênio) direto de
um lançamento do **Financeiro**, sem sair do sistema.

## 🧱 Decisões de arquitetura (a confirmar antes da NF1)
- **Não integrar prefeitura por prefeitura.** São 2000+ municípios com layouts/instabilidades
  diferentes — usar um **provedor agregador** (candidatos 2026: **Focus NFe**, **PlugNotas**, **eNotas**,
  **Nuvem Fiscal**, **Notaas**) que abstrai isso numa API única.
- **A "Nacional NFS-e"** (padronização da Receita Federal, adoção crescente pelos municípios) tende a
  simplificar isso nos próximos anos — vale checar cobertura do provedor escolhido na hora da NF1.
- **Cada clínica é a emitente** (o CNPJ dela, não o nosso) — mesmo problema estrutural do boleto direto:
  cada tenant precisa da própria **inscrição municipal**, regime tributário, CNAE e alíquota de ISS
  configurados. Alguns provedores oferecem emissão sem certificado digital próprio (usam certificado do
  próprio provedor via procuração eletrônica) — verificar se aplica ao município da clínica.
- Guardar **XML e PDF/DANFSE** da nota emitida (auditoria + reenvio ao paciente).

---

## 📇 Sprint NF1 — Provedor & cadastro fiscal da clínica
- [ ] NF1.1: Avaliar/contratar provedor agregador (cobertura de municípios, preço por nota, suporte a certificado do provedor).
- [ ] NF1.2: Modelo `DadosFiscaisClinica` (por tenant): inscrição municipal, regime tributário (Simples/MEI/etc.), CNAE, alíquota ISS, série/numeração.
- [ ] NF1.3: Tela de configuração fiscal na clínica (Configurações).
- [ ] NF1.4: Sandbox do provedor + emissão de teste ponta a ponta.

## 📤 Sprint NF2 — Emissão a partir do Financeiro
- [ ] NF2.1: Ação "Emitir NFS-e" num Lançamento (Contas a Receber) pago.
- [ ] NF2.2: Serviço que monta o payload (tomador = paciente, valor, descrição do serviço) e chama o provedor.
- [ ] NF2.3: Guardar XML/PDF retornado, vincular ao Lançamento; status (processando/emitida/erro).
- [ ] NF2.4: Testes (emissão com sucesso, erro de validação da prefeitura tratado com mensagem clara).

## 🔁 Sprint NF3 — Cancelamento & tratamento de erros
- [ ] NF3.1: Cancelamento de NFS-e (dentro do prazo legal do município) a partir do Lançamento.
- [ ] NF3.2: Reprocessamento de notas com erro (fila/retry) + log de auditoria.
- [ ] NF3.3: Notificação (e-mail/WhatsApp) do paciente com a nota emitida.

## 📊 Sprint NF4 — Painel & relatórios
- [ ] NF4.1: Lista de notas emitidas na clínica (filtros por período/status) no Financeiro.
- [ ] NF4.2: Relatório para contabilidade (exportação simples do período).
- [ ] NF4.3: Gating por plano (se a feature entrar como diferencial de plano pago) + docs + deploy.

---

## Notas
- Depende de o paciente ter CPF cadastrado corretamente (já existe no model `Paciente`) — validar
  antes de tentar emitir.
- Custo por nota emitida varia por provedor/plano contratado — decidir na NF1 se repassa ao custo da
  assinatura da clínica ou cobra à parte.
