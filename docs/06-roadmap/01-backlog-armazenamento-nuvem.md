# ☁️ Backlog de Sprints — Armazenamento em Nuvem & Anexos

> **Fonte de verdade** para implementar o armazenamento de arquivos (raio-X, exames,
> documentos, foto 3x4 do paciente) com **cota real por plano** e isolamento por clínica.
>
> Contexto atual: hoje só existe o campo `PlanoAssinatura.limite_armazenamento_mb` (cota) —
> **não há upload nem medição de consumo**. A landing e o "Meu Plano" exibem "em breve".
> Estas sprints tornam o recurso real e removem o "em breve".

---

## 🎯 Objetivos
- Permitir anexar arquivos a pacientes/guias/consultas (raio-X, exames, documentos) e foto 3x4.
- Medir o consumo real por clínica e **fazer valer a cota** do plano (`limite_armazenamento_mb`).
- Garantir **isolamento por tenant** (um arquivo de uma clínica nunca é acessível por outra) e privacidade LGPD.

## 🧱 Decisões de arquitetura (a confirmar antes da AS1)
- **Provedor:** S3-compatível (AWS S3 / Cloudflare R2 / MinIO self-hosted na VPS). Recomendação: R2 ou MinIO (custo/controle).
- **Isolamento:** prefixo de chave por schema (`<schema>/pacientes/<id>/...`) + bucket único; URLs **assinadas** com expiração curta (nunca links públicos).
- **Metadados:** modelo `Anexo` no app do tenant (por schema) — nome, tipo MIME, tamanho, chave no storage, dono (paciente/guia/consulta), criado_por, criado_em.
- **Consumo:** somatório de `tamanho` dos anexos do schema (agregado + cache), não confiar só no storage.

---

## 📦 Sprint AS1 — Infra de storage & modelo de Anexo
- [ ] AS1.1: Definir provedor + credenciais por `.env` (`STORAGE_*`), abstração `storage_backend` (django-storages ou client boto3 fino).
- [ ] AS1.2: Modelo `Anexo` (app tenant) + migration por-schema: `tipo`, `mime`, `tamanho_bytes`, `chave`, FKs opcionais (paciente/guia/consulta), `criado_por`, `criado_em`.
- [ ] AS1.3: Serviço de upload/download com **chave namespaced por schema** e geração de **URL assinada** (expiração curta).
- [ ] AS1.4: Validação de tipo (imagens/PDF) e tamanho máximo por arquivo; antivírus/sanitização básica do nome.
- [ ] AS1.5: Testes de isolamento (schema A não lê chave de B) e de assinatura/expiração.

## 🖼️ Sprint AS2 — Upload nas telas (raio-X, exames, foto 3x4)
- [ ] AS2.1: Componente de upload reutilizável (drag/drop + progresso) no form-kit.
- [ ] AS2.2: Anexos na **Guia** e na **Consulta** (raio-X/exames), com listagem/preview e exclusão.
- [ ] AS2.3: **Foto 3x4** do paciente (ficha) — upload, recorte simples e exibição.
- [ ] AS2.4: Exclusão remove o objeto no storage (sem órfãos); trilha de auditoria.
- [ ] AS2.5: Testes de upload/preview/exclusão e responsividade mobile.

## 📊 Sprint AS3 — Consumo real & cota por plano
- [ ] AS3.1: Cálculo do consumo por schema (`armazenamento_usado_mb`) — agregação + cache invalidado em upload/exclusão.
- [ ] AS3.2: **Enforcement** da cota: bloquear upload que excederia `limite_armazenamento_mb` (mensagem clara + sugestão de upgrade).
- [ ] AS3.3: **Meu Plano** com consumo REAL (barra/percentual) — remover o selo "em breve".
- [ ] AS3.4: Vendor Admin: `storage_usado_mb` real por clínica (hoje fixo em 0).
- [ ] AS3.5: Landing: remover "em breve" do armazenamento nos planos.

## 🔒 Sprint AS4 — Segurança, limpeza & deploy
- [ ] AS4.1: Revisão de segurança (URLs assinadas, escopo por tenant, sem enumeração de chaves; red-team).
- [ ] AS4.2: Rotina de limpeza (arquivos órfãos, expurgo ao remover paciente/clínica respeitando retenção/LGPD).
- [ ] AS4.3: Backup/retenção dos objetos alinhado à política de backup do banco.
- [ ] AS4.4: Docs + variáveis no `deploy/.env.prod.example`; deploy e verificação em produção.

---

_Depende da "fase de nuvem" (ver [[odonto-uploads-proximas-sprints]]). Ao concluir AS3, retirar todos os "em breve" de armazenamento (landing + Meu Plano)._
