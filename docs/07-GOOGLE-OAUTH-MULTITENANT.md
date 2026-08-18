# 07 — Google OAuth multi-tenant (a desenvolver)

> **Status: planejado.** Hoje (piloto) a conexão com o Google Agenda usa registro
> **manual por clínica** (um `redirect_uri` por subdomínio + whitelist de usuário de
> teste). Isso **não escala**. Este doc descreve o fluxo definitivo, zero-toque por
> clínica.

## Objetivo
A clínica entra no app, clica **Conectar Google**, aprova na conta Google **dela**
e pronto — **sem** nós registrarmos nada por clínica e **sem** acessar a conta de
ninguém. (No OAuth, o `client_id`/`secret` é de UM app nosso; a clínica só autoriza.)

## Os dois blocos

### A. Código — callback fixo no apex + `state` (nós desenvolvemos)
O Google exige `redirect_uri` **exato** e registrado; com subdomínio por clínica,
registrar um por clínica é inviável. Solução padrão SaaS:

- **Um** `redirect_uri` registrado, no apex:
  `https://proclinica.cloud/integracoes/google/callback`.
- `google_authorize`: monta a URL de consentimento com esse redirect fixo e coloca
  no parâmetro **`state`** (assinado) qual **tenant** (schema/domínio) e qual
  **dentista/clínica** está conectando (+ nonce CSRF).
- `google_callback` (roda no schema **public**, no apex): valida o `state`, troca o
  `code` pelo token, entra no **schema do tenant** e salva a `CredencialGoogleCalendar`
  lá, e redireciona o navegador de volta para `https://<tenant>.proclinica.cloud/integracoes`.

Ajustes necessários:
- **Caddy (apex):** hoje o bloco `proclinica.cloud` só serve a landing. Precisa fazer
  **proxy de `/integracoes/*`** (pelo menos o callback) para `web:8000`.
- **django-tenants:** garantir que o apex resolva para o schema `public` (tenant
  público) para o callback rodar; depois trocar de schema pelo `state`.
- **`state` assinado** (ex.: `TimestampSigner`/JWT curto) para evitar CSRF/adulteração.
- Manter compatível o fluxo atual de dev (127.0.0.1) via env.

### B. Processo — verificar/publicar o app no Google (nós, uma vez)
O escopo do Calendar é **sensível** → enquanto o app estiver em **Teste**, só e-mails
na whitelist conectam. Publicar/verificar remove isso:
- Precisa de **política de privacidade** pública + **homepage** (o apex serve) +
  **verificação do domínio** `proclinica.cloud` no Google.
- Aprovação é do Google (dias/semanas). Uma vez feito, **qualquer** clínica conecta.

## Enquanto não fica pronto (piloto)
Por clínica, no nosso Google Cloud: adicionar o `redirect_uri` do subdomínio +
adicionar a conta Google da clínica como **usuário de teste**. Ver o passo a passo
em [[odonto-google-oauth-pendente]] (memória).

Relacionado: `docs/05-PLANOS-PAGAMENTOS.md` (comercialização), `docs/06-AMBIENTES-E-FLUXO.md`.
