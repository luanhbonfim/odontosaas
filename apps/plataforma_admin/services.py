"""
Serviços de governança e lógica de negócios do Vendor Admin.
"""

import hashlib
import logging
import os
import shutil
import subprocess
from datetime import datetime, timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django_tenants.utils import schema_context
from rest_framework_simplejwt.tokens import RefreshToken

from apps.dentistas.defaults import semear_especialidades_padrao
from apps.notificacoes.defaults import semear_templates_padrao
from apps.plataforma_admin.models import RegistroAuditoriaVendor
from apps.tenants.models import Clinica, Dominio
from apps.usuarios.models import Usuario
from apps.usuarios.perfis import sincronizar_grupos

logger = logging.getLogger(__name__)


def obter_ip_cliente(request) -> str:
    """Extrai o IP real do cliente a partir dos headers da requisição."""
    if not request:
        return "127.0.0.1"
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "127.0.0.1")


def registrar_auditoria_vendor(
    request,
    acao: str,
    schema_alvo: str = "public",
    detalhes: dict | None = None,
) -> RegistroAuditoriaVendor:
    """
    Grava um registro na trilha de auditoria do Vendor Admin.
    """
    operador_email = "sistema"
    if request and getattr(request, "user", None) and request.user.is_authenticated:
        operador_email = getattr(request.user, "email", str(request.user))

    ip = obter_ip_cliente(request)
    return RegistroAuditoriaVendor.objects.create(
        operador_email=operador_email,
        ip_origem=ip,
        acao=acao,
        schema_alvo=schema_alvo,
        detalhes=detalhes or {},
    )


def executar_provisionamento_clinica(
    schema_name: str,
    nome_fantasia: str,
    dominio: str,
    razao_social: str = "",
    cnpj: str | None = None,
    plano_id: int | None = None,
    data_inicio_contrato=None,
    vigencia_fim=None,
    admin_email: str | None = None,
    admin_senha: str | None = None,
    responsavel_nome: str = "",
    responsavel_cpf: str = "",
    responsavel_telefone: str = "",
    responsavel_email: str | None = None,
    request=None,
) -> Clinica:
    """
    Provisiona um novo tenant de forma completa com compensação de falhas:
    1. Cria a Clinica (auto_create_schema=True cria o schema físico e executa migrações).
    2. Cria o Dominio associado.
    3. Semeia grupos de permissões, especialidades e templates no schema recém-criado.
    4. Cria o primeiro usuário administrador do tenant.
    5. Registra auditoria vendor.
    Em caso de falha no seeding ou criação de usuário, remove o schema físico para evitar schemas órfãos.
    """
    schema_clean = schema_name.strip().lower()
    dominio_clean = dominio.strip().lower()

    if Clinica.objects.filter(schema_name=schema_clean).exists():
        raise ValidationError(f"O schema '{schema_clean}' já está em uso.")
    if Dominio.objects.filter(domain=dominio_clean).exists():
        raise ValidationError(f"O domínio '{dominio_clean}' já está em uso.")

    if not plano_id:
        raise ValidationError("É obrigatório selecionar um plano de assinatura para provisionar a clínica.")

    from apps.plataforma.models import PlanoAssinatura
    import datetime
    from django.utils import timezone

    try:
        plano = PlanoAssinatura.objects.get(id=plano_id)
    except PlanoAssinatura.DoesNotExist:
        raise ValidationError(f"Plano de assinatura com ID {plano_id} não encontrado.")

    if vigencia_fim is None:
        base_data = data_inicio_contrato or timezone.localdate()
        if isinstance(base_data, str):
            base_data = datetime.date.fromisoformat(base_data)

        if plano.periodicidade == PlanoAssinatura.Periodicidade.MENSAL:
            vigencia_fim = base_data + datetime.timedelta(days=30)
        elif plano.periodicidade == PlanoAssinatura.Periodicidade.ANUAL:
            vigencia_fim = base_data + datetime.timedelta(days=365)
        elif plano.periodicidade == PlanoAssinatura.Periodicidade.PERMANENTE:
            vigencia_fim = None
        else:
            vigencia_fim = base_data + datetime.timedelta(days=30)

    clinica = None
    try:
        clinica = Clinica(
            schema_name=schema_clean,
            nome_fantasia=nome_fantasia,
            razao_social=razao_social,
            cnpj=cnpj,
            responsavel_nome=responsavel_nome,
            responsavel_cpf=responsavel_cpf,
            responsavel_telefone=responsavel_telefone,
            responsavel_email=responsavel_email,
            plano_assinatura_id=plano.id,
            vigencia_fim=vigencia_fim,
            status_assinatura=Clinica.StatusAssinatura.ATIVA,
            ativo=True,
        )
        clinica.save()

        Dominio.objects.create(
            domain=dominio_clean,
            tenant=clinica,
            is_primary=True,
        )

        with schema_context(schema_clean):
            sincronizar_grupos()
            semear_templates_padrao()
            semear_especialidades_padrao()

            # Sempre garante o usuário Master da plataforma
            master_email = (
                getattr(settings, "MASTER_ADMIN_EMAIL", None)
                or os.environ.get("MASTER_ADMIN_EMAIL")
                or "admin@proclinica.com.br"
            )
            # A senha do Master é semeada como is_superuser em TODOS os schemas — ou seja,
            # é a credencial de operador do Vendor Admin. Não pode ter default hardcoded em
            # produção (senão "admin@proclinica.com.br / <default>" seria SuperAdmin conhecido).
            # Lê de settings OU do ambiente (settings não faz o binding), como no Studio.
            master_pass = getattr(settings, "MASTER_ADMIN_PASSWORD", None) or os.environ.get("MASTER_ADMIN_PASSWORD")
            if not master_pass:
                # Obrigatória em produção. Usa o módulo de settings de prod (não `DEBUG`,
                # que o pytest-django força para False durante os testes).
                if "prod" in str(getattr(settings, "SETTINGS_MODULE", "")):
                    raise RuntimeError(
                        "MASTER_ADMIN_PASSWORD é obrigatória em produção para semear o operador Master."
                    )
                master_pass = "ProClinica@2026"  # apenas desenvolvimento/testes
            user_master, created_master = Usuario.objects.get_or_create(
                email=master_email,
                defaults={
                    "nome_completo": "Administrador Master",
                    "papel": Usuario.Papel.ADMIN,
                    "is_staff": True,
                    "is_superuser": True,
                    "is_active": True,
                },
            )
            if created_master or not user_master.has_usable_password():
                user_master.set_password(master_pass)
                user_master.is_staff = True
                user_master.is_superuser = True
                user_master.is_active = True
                user_master.papel = Usuario.Papel.ADMIN
                user_master.save()

            # Se fornecido e-mail de admin específico no provisionamento
            if admin_email and admin_senha and admin_email != master_email:
                Usuario.objects.create_user(
                    email=admin_email,
                    password=admin_senha,
                    nome_completo=responsavel_nome or "Administrador da Clínica",
                    papel=Usuario.Papel.ADMIN,
                    is_staff=True,
                )

        registrar_auditoria_vendor(
            request=request,
            acao=RegistroAuditoriaVendor.Acao.PROVISIONAR_CLINICA,
            schema_alvo=schema_clean,
            detalhes={
                "nome_fantasia": nome_fantasia,
                "dominio": dominio_clean,
                "plano_id": plano_id,
                "admin_email": admin_email,
            },
        )
        return clinica

    except Exception as exc:
        # Compensação: remove o schema órfão caso tenha sido criado antes do erro de sementeira
        if clinica and getattr(clinica, "pk", None):
            try:
                clinica.delete(force_drop=True)
            except Exception as drop_exc:
                logger.error("Falha ao compensar schema órfão '%s': %s", schema_clean, drop_exc)
        raise exc


def gerar_token_impersonate(
    operador_email: str,
    clinica: Clinica,
    read_only: bool = True,
    justificativa: str = "",
    reacesso: bool = False,
    request=None,
) -> dict:
    """
    Gera um token JWT com expiração curta (1 hora) para acesso de suporte à clínica.
    """
    from django.utils import timezone

    agora = timezone.now()
    limite_expiracao = agora - timedelta(hours=1)

    # Bloqueia se já houver sessão ativa válida criada há menos de 1 hora (a menos que seja reacesso)
    if not reacesso:
        sessao_ativa = (
            RegistroAuditoriaVendor.objects.filter(
                schema_alvo=clinica.schema_name,
                acao=RegistroAuditoriaVendor.Acao.IMPERSONATE,
                criado_em__gte=limite_expiracao,
            )
            .order_by("-criado_em")
            .first()
        )
        if sessao_ativa and not sessao_ativa.detalhes.get("encerrado_em"):
            expira_em = sessao_ativa.criado_em + timedelta(hours=1)
            expira_str = expira_em.strftime("%H:%M:%S")
            raise ValidationError(
                f"Já existe uma sessão de suporte ativa para esta clínica até às {expira_str}. "
                f"Acesse a Aba 6 (Auditoria & Suporte) para utilizá-la ou encerrá-la."
            )

    with schema_context(clinica.schema_name):
        admin_user = (
            Usuario.objects.filter(papel=Usuario.Papel.ADMIN, is_active=True).first()
            or Usuario.objects.filter(is_superuser=True).first()
            or Usuario.objects.filter(is_active=True).first()
        )
        if not admin_user:
            raise ValidationError(
                f"Nenhum usuário ativo encontrado no schema '{clinica.schema_name}' para impersonate."
            )

        expira_em = agora + timedelta(hours=1)

        refresh = RefreshToken.for_user(admin_user)
        # Injeta claims customizados de impersonate
        refresh["is_impersonate"] = True
        refresh["impersonated_by"] = operador_email
        refresh["impersonate_read_only"] = read_only
        refresh["schema_name"] = clinica.schema_name
        refresh.set_exp(lifetime=timedelta(hours=1))

        access_token = refresh.access_token
        access_token["is_impersonate"] = True
        access_token["impersonated_by"] = operador_email
        access_token["impersonate_read_only"] = read_only
        access_token["schema_name"] = clinica.schema_name
        access_token.set_exp(lifetime=timedelta(hours=1))

        registrar_auditoria_vendor(
            request=request,
            acao=RegistroAuditoriaVendor.Acao.IMPERSONATE,
            schema_alvo=clinica.schema_name,
            detalhes={
                "operador": operador_email,
                "usuario_alvo": admin_user.email,
                "read_only": read_only,
                "justificativa": justificativa,
                "duracao_minutos": 60,
                "expira_em": expira_em.isoformat(),
            },
        )

        dominio_obj = clinica.domains.filter(is_primary=True).first() or clinica.domains.first()
        dominio_url = dominio_obj.domain if dominio_obj else clinica.schema_name

        return {
            "access": str(access_token),
            "refresh": str(refresh),
            "usuario_impersonado": admin_user.email,
            "read_only": read_only,
            "dominio": dominio_url,
            "expires_in_seconds": 3600,
        }


def resetar_senha_admin_tenant(
    clinica: Clinica,
    nova_senha: str,
    admin_email: str | None = None,
    request=None,
) -> str:
    """
    Redefine a senha do administrador da clínica.
    """
    with schema_context(clinica.schema_name):
        if admin_email:
            user = Usuario.objects.filter(email=admin_email).first()
        else:
            user = Usuario.objects.filter(papel=Usuario.Papel.ADMIN).first()

        if not user:
            raise ValidationError(
                f"Administrador não encontrado no schema '{clinica.schema_name}'."
            )

        user.set_password(nova_senha)
        user.save()

        registrar_auditoria_vendor(
            request=request,
            acao=RegistroAuditoriaVendor.Acao.RESET_SENHA_ADMIN,
            schema_alvo=clinica.schema_name,
            detalhes={"admin_email": user.email},
        )

        return user.email


def executar_backup_schema_pg_dump(schema_name: str) -> dict:
    """
    Executa pg_dump isolado do schema antes do expurgo e calcula SHA-256 e tamanho.
    Se o dump falhar, levanta RuntimeError para abortar o expurgo.
    """
    backup_dir = getattr(
        settings,
        "VENDOR_EXPURGO_BACKUP_DIR",
        settings.BASE_DIR / "backups" / "expurgo",
    )
    os.makedirs(backup_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"expurgo_{schema_name}_{timestamp}.dump"
    backup_path = os.path.join(backup_dir, backup_filename)

    db_conf = settings.DATABASES["default"]
    host = db_conf.get("HOST") or "localhost"
    port = str(db_conf.get("PORT") or "5432")
    user = db_conf.get("USER") or "odonto"
    password = db_conf.get("PASSWORD") or ""
    db_name = db_conf.get("NAME") or "odonto"

    env = os.environ.copy()
    if password:
        env["PGPASSWORD"] = password

    # Verifica se pg_dump existe no PATH
    pg_dump_bin = shutil.which("pg_dump")
    if not pg_dump_bin:
        logger.error("pg_dump não encontrado no PATH para expurgo de '%s'", schema_name)
        raise RuntimeError(
            f"Binário 'pg_dump' não foi encontrado no PATH do sistema. "
            f"O expurgo do schema '{schema_name}' foi cancelado para evitar perda de dados sem backup."
        )

    cmd = [
        pg_dump_bin,
        "-h", host,
        "-p", port,
        "-U", user,
        "-d", db_name,
        "-n", schema_name,
        "--format=custom",
        "--file", str(backup_path),
    ]
    try:
        subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        logger.error("Falha na execução do pg_dump para '%s': %s", schema_name, exc.stderr)
        raise RuntimeError(
            f"Falha ao gerar backup prévio via pg_dump para o schema '{schema_name}': {exc.stderr}. "
            "Expurgo cancelado para proteger os dados."
        ) from exc

    # Calcula hash SHA-256 e tamanho do backup
    sha256 = hashlib.sha256()
    with open(backup_path, "rb") as f_in:
        for chunk in iter(lambda: f_in.read(65536), b""):
            sha256.update(chunk)

    file_hash = sha256.hexdigest()
    file_size = os.path.getsize(backup_path)

    return {
        "arquivo": backup_filename,
        "caminho_completo": str(backup_path),
        "tamanho_bytes": file_size,
        "sha256": file_hash,
    }


def executar_expurgo_com_backup(clinica: Clinica, request=None) -> dict:
    """
    Realiza o expurgo definitivo de uma clínica:
    1. Executa pg_dump obrigatório do schema e valida integridade (abortando se falhar).
    2. Registra snapshot e dados do backup na auditoria vendor.
    3. Remove fisicamente o schema e o tenant com force_drop=True.
    """
    schema_alvo = clinica.schema_name

    # 1. Backup obrigatório antes do drop
    info_backup = executar_backup_schema_pg_dump(schema_alvo)

    dados_snapshot = {
        "id": clinica.id,
        "nome_fantasia": clinica.nome_fantasia,
        "razao_social": clinica.razao_social,
        "cnpj": clinica.cnpj,
        "dominios": list(clinica.domains.values_list("domain", flat=True)),
        "plano_id": clinica.plano_assinatura_id,
        "criado_em": clinica.criado_em.isoformat() if clinica.criado_em else None,
        "backup": info_backup,
    }

    # 2. Gravação de auditoria
    registrar_auditoria_vendor(
        request=request,
        acao=RegistroAuditoriaVendor.Acao.EXPURGAR_CLINICA,
        schema_alvo=schema_alvo,
        detalhes={"snapshot_previo": dados_snapshot, "backup": info_backup},
    )

    # 3. Exclusão física do schema e do registro do tenant
    clinica.delete(force_drop=True)
    return info_backup


def registrar_erro_operacional(
    schema_tenant: str,
    mensagem: str,
    nivel: str = "ERROR",
    endpoint: str = "",
    metodo: str = "",
    traceback: str = "",
    detalhes: dict | None = None,
):
    """Registra um erro operacional ocorrido no tenant para visualização no painel do vendor."""
    from django_tenants.utils import schema_context
    from apps.plataforma_admin.models import RegistroErroOperacional

    with schema_context("public"):
        return RegistroErroOperacional.objects.create(
            schema_tenant=schema_tenant,
            nivel=nivel,
            endpoint=endpoint,
            metodo=metodo,
            mensagem=mensagem,
            traceback=traceback,
            detalhes=detalhes or {},
        )

