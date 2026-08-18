# Deploy de Produção — OdontoSaaS (VPS + Docker + Caddy)

Guia para subir o sistema num VPS (ex.: Hostinger KVM 2, Ubuntu 24.04 LTS, São
Paulo). Tudo roda em containers; o **Caddy** é o único serviço exposto e cuida
do **HTTPS automático** (Let's Encrypt). Banco, Redis, Django e WAHA ficam na
rede interna, sem porta pública.

## 0. Pré-requisitos
- 1 VPS **Ubuntu 24.04 LTS**, 2 vCPU / **4 GB RAM** (8 GB folgado), região BR.
- 1 **domínio** (ex.: `seudominio.com.br`). Não precisa comprar certificado.
- Acesso **SSH** ao servidor (de preferência por chave).

## 1. Apontar o domínio (DNS)
No painel do seu domínio, crie um registro **A** apontando para o **IP do VPS**:

| Tipo | Nome | Valor |
|---|---|---|
| A | `clinica` (ou o subdomínio da clínica) | IP do VPS |

Cada clínica nova = um subdomínio (`clinica2.seudominio.com.br`) apontando para o
mesmo IP. (Quando forem muitas, troque por um curinga `*` — ver §9.)

## 2. Preparar o servidor (uma vez)
```bash
# Como root (ou com sudo) no VPS:
apt update && apt upgrade -y

# Docker + Compose (script oficial)
curl -fsSL https://get.docker.com | sh

# Firewall: só SSH e HTTPS/HTTP
apt install -y ufw fail2ban
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```
> Se escolheu o template "Docker" na Hostinger, o Docker já vem instalado —
> pule a linha do `get.docker.com`.

## 3. Baixar o projeto e configurar segredos
```bash
mkdir -p /opt/odonto && cd /opt/odonto
git clone <URL_DO_REPO> .        # ou envie os arquivos por scp

cp deploy/.env.prod.example .env
nano .env                        # preencha TODOS os TROQUE-... (ver o arquivo)
```
Gerar segredos fortes:
```bash
# SECRET_KEY do Django
python3 -c "import secrets;print(secrets.token_urlsafe(64))"
# FIELD_ENCRYPTION_KEY (Fernet) — precisa do pacote cryptography; ou gere no container depois
docker run --rm python:3.12-slim sh -c "pip -q install cryptography && python -c 'from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())'"
# Senhas (banco / WAHA)
openssl rand -base64 32
```

## 4. Subir tudo
```bash
bash deploy/deploy.sh
```
O script builda as imagens, sobe banco/redis, **aplica as migrações** (public +
tenants), coleta os estáticos e sobe a stack. O Caddy emite o HTTPS no primeiro
acesso ao domínio (aguarde ~30s e acesse `https://clinica.seudominio.com.br`).

## 5. Criar a clínica (tenant) e o usuário admin
Já existe um comando de provisionamento:
```bash
docker compose -f docker-compose.prod.yml exec web \
  python manage.py provisionar_clinica
```
(Siga os prompts: nome da clínica, subdomínio e usuário admin. Confirme o
subdomínio igual ao DNS/`SITE_ADDRESS`.)

## 6. Parear o WhatsApp
Entre no app (`https://clinica.seudominio.com.br`) como admin → **WhatsApp →
Configuração → Conectar** e leia o QR pelo celular da clínica. A sessão fica
salva no volume do WAHA.

## 7. Backup automático (NÃO pule)
```bash
chmod +x deploy/backup-postgres.sh
crontab -e
# adicione (backup diário às 03h):
0 3 * * * /opt/odonto/deploy/backup-postgres.sh >> /var/log/odonto-backup.log 2>&1
```
> Recomendado: copie os dumps para **fora** do servidor (object storage/outro
> host) com `rclone`. Backup no mesmo disco não protege contra perda do VPS.

Restaurar um dump:
```bash
cat backups/odonto-AAAAMMDD-HHMMSS.dump | \
  docker exec -i odonto_db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists
```

## 8. Atualizar (nova versão)
```bash
cd /opt/odonto && git pull
bash deploy/deploy.sh     # rebuild + migra + coleta + sobe
```

## 9. Checklist de segurança (hardening)
- [ ] **Segredos trocados** no `.env` (SECRET_KEY, FIELD_ENCRYPTION_KEY, senhas do banco e do WAHA).
- [ ] **Firewall** ativo (só 22/80/443) + `fail2ban`.
- [ ] **SSH por chave** e senha desabilitada (`PasswordAuthentication no` em `/etc/ssh/sshd_config`).
- [ ] Banco/Redis/WAHA **sem porta pública** (garantido: não há `ports:` neles no compose de prod).
- [ ] `DJANGO_DEBUG=False` e `DJANGO_ALLOWED_HOSTS`/`CSRF_TRUSTED_ORIGINS` corretos.
- [ ] **Backups** rodando + cópia off-site.
- [ ] Atualizações do SO (`unattended-upgrades`).

## 10. Multi-tenant (várias clínicas)
- Cada clínica = um **subdomínio** + um **schema** no Postgres (isolado).
- Adicionar clínica: crie o DNS do subdomínio, inclua-o no `SITE_ADDRESS` (Caddy)
  e rode `provisionar_clinica`.
- Quando forem muitas, use **DNS curinga** (`*.seudominio.com.br`) + TLS curinga
  no Caddy (requer o plugin de DNS do seu provedor para o desafio DNS-01). Aí não
  precisa mexer no `SITE_ADDRESS` a cada cliente novo.
