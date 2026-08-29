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
- **A "NFS-e Nacional"** (Receita Federal/Serpro, emissor gratuito, adesão crescente pelos municípios em
  2026 — LC 214/2025) já permite autenticar só com **login gov.br** (senha; nível prata/ouro pra MEI),
  **sem certificado digital ICP-Brasil**. Confirmar se o município da clínica já aderiu.
- **Sem CNPJ/MEI também dá pra emitir hoje**: dentista autônomo (só CPF) pode se cadastrar como
  contribuinte do ISS direto na prefeitura e emitir com CPF — não precisa abrir MEI. **Atenção:** a
  partir de **2027** (LC 214/2025), quem atua com habitualidade vai precisar de **CNPJ Técnico** — essa
  via só-CPF tem prazo de validade, reavaliar antes de ir pra produção.
- **Cada clínica é a emitente** (o CPF/CNPJ dela, não o nosso) — mesmo problema estrutural do boleto
  direto: cada tenant precisa dos próprios dados fiscais (inscrição municipal/cadastro de ISS, regime
  tributário, CNAE, alíquota) configurados. Provedores agregadores também costumam oferecer emissão via
  procuração eletrônica (usam certificado deles) como alternativa ao login gov.br — comparar na NF1.
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
