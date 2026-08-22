"""
Serializers do Painel de Admin da Plataforma (Vendor Admin).
"""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.plataforma.models import PlanoAssinatura
from apps.plataforma_admin.models import ConfiguracaoLoginVendor, RegistroAuditoriaVendor
from apps.tenants.models import Clinica, Dominio


class PlanoAssinaturaVendorSerializer(serializers.ModelSerializer):
    """Serializer para CRUD de planos comerciais no painel do vendor."""

    total_clinicas = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PlanoAssinatura
        fields = [
            "id",
            "nome",
            "periodicidade",
            "preco_mensal",
            "preco_anual",
            "limite_dentistas",
            "limite_usuarios",
            "limite_pacientes_ativos",
            "limite_armazenamento_mb",
            "modulo_financeiro_ativo",
            "modulo_estoque_ativo",
            "sync_google_ativo",
            "whatsapp_waha_ativo",
            "ativo",
            "criado_em",
            "total_clinicas",
        ]
        read_only_fields = ["id", "criado_em", "total_clinicas"]

    def get_total_clinicas(self, obj) -> int:
        return obj.clinicas.count()


class DominioVendorSerializer(serializers.ModelSerializer):
    """Serializer para domínios de uma clínica."""

    class Meta:
        model = Dominio
        fields = ["id", "domain", "is_primary"]


class ClinicaListVendorSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listagem de clínicas no painel do vendor."""

    plano_nome = serializers.CharField(source="plano_assinatura.nome", read_only=True, default="")
    dominios = DominioVendorSerializer(source="domains", many=True, read_only=True)
    limite_dentistas_efetivo = serializers.IntegerField(source="get_limite_dentistas", read_only=True)
    limite_usuarios_efetivo = serializers.IntegerField(source="get_limite_usuarios", read_only=True)
    modulos_efetivos = serializers.DictField(source="get_modulos_efetivos", read_only=True)
    status_efetivo = serializers.CharField(source="get_status_efetivo", read_only=True)
    dias_restantes_vigencia = serializers.SerializerMethodField()

    class Meta:
        model = Clinica
        fields = [
            "id",
            "schema_name",
            "nome_fantasia",
            "razao_social",
            "cnpj",
            "telefone",
            "responsavel_nome",
            "responsavel_cpf",
            "responsavel_telefone",
            "responsavel_email",
            "plano_assinatura",
            "plano_nome",
            "status_assinatura",
            "status_efetivo",
            "vigencia_fim",
            "dias_restantes_vigencia",
            "ativo",
            "criado_em",
            "dominios",
            "limite_dentistas_efetivo",
            "limite_usuarios_efetivo",
            "modulos_efetivos",
        ]

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_dias_restantes_vigencia(self, obj):
        if not obj.vigencia_fim:
            return None
        from django.utils import timezone
        return (obj.vigencia_fim - timezone.localdate()).days


class ClinicaDetailVendorSerializer(serializers.ModelSerializer):
    """Serializer completo para detalhes e edição cadastral de uma clínica."""

    plano_nome = serializers.CharField(source="plano_assinatura.nome", read_only=True, default="")
    dominios = DominioVendorSerializer(source="domains", many=True, read_only=True)
    limite_dentistas_efetivo = serializers.IntegerField(source="get_limite_dentistas", read_only=True)
    limite_usuarios_efetivo = serializers.IntegerField(source="get_limite_usuarios", read_only=True)
    modulos_efetivos = serializers.DictField(source="get_modulos_efetivos", read_only=True)
    status_efetivo = serializers.CharField(source="get_status_efetivo", read_only=True)
    dias_restantes_vigencia = serializers.SerializerMethodField()

    class Meta:
        model = Clinica
        fields = [
            "id",
            "schema_name",
            "nome_fantasia",
            "razao_social",
            "cnpj",
            "telefone",
            "responsavel_nome",
            "responsavel_cpf",
            "responsavel_telefone",
            "responsavel_email",
            "plano_assinatura",
            "plano_nome",
            "status_assinatura",
            "status_efetivo",
            "gateway_customer_id",
            "gateway_subscription_id",
            "vigencia_fim",
            "dias_restantes_vigencia",
            "override_limite_dentistas",
            "override_limite_usuarios",
            "override_recursos",
            "ativo",
            "criado_em",
            "dominios",
            "limite_dentistas_efetivo",
            "limite_usuarios_efetivo",
            "modulos_efetivos",
        ]
        read_only_fields = ["id", "schema_name", "criado_em", "status_efetivo", "dias_restantes_vigencia", "modulos_efetivos"]

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_dias_restantes_vigencia(self, obj):
        if not obj.vigencia_fim:
            return None
        from django.utils import timezone
        return (obj.vigencia_fim - timezone.localdate()).days


class ProvisionarClinicaInputSerializer(serializers.Serializer):
    """Validação do payload de provisionamento de novo tenant."""

    schema_name = serializers.SlugField(max_length=63)
    nome_fantasia = serializers.CharField(max_length=255)
    dominio = serializers.CharField(max_length=253)
    razao_social = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    cnpj = serializers.CharField(max_length=14, required=False, allow_null=True, allow_blank=True, default=None)
    plano_id = serializers.IntegerField(required=True)
    responsavel_nome = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    responsavel_cpf = serializers.CharField(max_length=14, required=False, allow_blank=True, default="")
    responsavel_telefone = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    responsavel_email = serializers.EmailField(required=False, allow_null=True, allow_blank=True, default=None)
    data_inicio_contrato = serializers.DateField(required=False, allow_null=True, default=None)
    vigencia_fim = serializers.DateField(required=False, allow_null=True, default=None)
    admin_email = serializers.EmailField(required=False, allow_null=True, default=None)
    admin_senha = serializers.CharField(min_length=8, required=False, allow_null=True, write_only=True, default=None)

    def validate_schema_name(self, value):
        schema_clean = value.strip().lower()
        if schema_clean in ("public", "information_schema", "pg_catalog"):
            raise serializers.ValidationError("Nome de schema reservado do sistema.")
        if Clinica.objects.filter(schema_name=schema_clean).exists():
            raise serializers.ValidationError("Este nome de schema já está em uso.")
        return schema_clean

    def validate_dominio(self, value):
        dominio_clean = value.strip().lower()
        if Dominio.objects.filter(domain=dominio_clean).exists():
            raise serializers.ValidationError("Este domínio já está em uso.")
        return dominio_clean


class AlternarStatusTenantInputSerializer(serializers.Serializer):
    """Payload para ativar/bloquear ou mudar status de assinatura."""

    ativo = serializers.BooleanField(required=False)
    status_assinatura = serializers.ChoiceField(
        choices=Clinica.StatusAssinatura.choices,
        required=False,
    )
    # Motivo do bloqueio/mudança de status — gravado na trilha de auditoria.
    justificativa = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if "ativo" not in attrs and "status_assinatura" not in attrs:
            raise serializers.ValidationError(
                "É necessário informar ao menos um campo ('ativo' ou 'status_assinatura')."
            )
        return attrs



class ResetAdminSenhaInputSerializer(serializers.Serializer):
    """Payload para redefinição forçada de senha do admin do tenant."""

    nova_senha = serializers.CharField(min_length=8, write_only=True)
    admin_email = serializers.EmailField(required=False, allow_null=True, default=None)


class ImpersonateInputSerializer(serializers.Serializer):
    """Payload para requisição de token de impersonate."""

    read_only = serializers.BooleanField(default=True)
    justificativa = serializers.CharField(min_length=5, required=False, allow_blank=True, default="")
    user_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    email = serializers.EmailField(required=False, allow_null=True, default=None)
    reacesso = serializers.BooleanField(required=False, default=False)


class ExpurgarTenantInputSerializer(serializers.Serializer):
    """Confirmação de expurgo com digitação do schema para segurança."""

    schema_name_confirmacao = serializers.CharField(max_length=63, required=False)
    confirmacao_schema = serializers.CharField(max_length=63, required=False)
    schema_name = serializers.CharField(max_length=63, required=False)
    justificativa = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        conf = (
            attrs.get("schema_name_confirmacao")
            or attrs.get("confirmacao_schema")
            or attrs.get("schema_name")
        )
        if not conf:
            raise serializers.ValidationError(
                {"schema_name_confirmacao": "Informe o nome do schema para confirmação do expurgo."}
            )
        attrs["schema_name_confirmacao"] = conf
        return attrs


class GoogleParamsSerializer(serializers.Serializer):
    """Parâmetros de sincronização com Google Calendar por tenant."""

    intervalo_minutos = serializers.IntegerField(min_value=5, max_value=1440, required=False)


class WhatsAppParamsSerializer(serializers.Serializer):
    """Parâmetros e automações de WhatsApp por tenant."""

    dias_antecedencia = serializers.IntegerField(min_value=1, max_value=30, required=False)
    horario_envio = serializers.TimeField(required=False)
    numero_clinica = serializers.CharField(max_length=20, required=False, allow_blank=True)
    cancelar_nao_confirmadas = serializers.BooleanField(required=False)
    cancelar_horas_antes = serializers.IntegerField(min_value=1, max_value=72, required=False)
    reforcar_confirmacao = serializers.BooleanField(required=False)
    mensagem_reforco = serializers.CharField(max_length=255, required=False, allow_blank=True)
    enviar_agradecimento = serializers.BooleanField(required=False)
    enviar_reagendamento = serializers.BooleanField(required=False)
    reagendamento_minutos = serializers.IntegerField(min_value=0, max_value=1440, required=False)
    enviar_cancelamento = serializers.BooleanField(required=False)
    simular_digitacao = serializers.BooleanField(required=False)
    segundos_digitacao = serializers.IntegerField(min_value=0, max_value=30, required=False)
    intervalo_fila_segundos = serializers.IntegerField(min_value=0, max_value=600, required=False)


class OverridesTenantSerializer(serializers.Serializer):
    """Overrides específicos de limites e recursos por clínica."""

    override_limite_dentistas = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    override_limite_usuarios = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    override_recursos = serializers.JSONField(required=False)


class RegistroErroOperacionalSerializer(serializers.ModelSerializer):
    """Serializer para consulta de logs de erros operacionais no painel do vendor."""

    modulo = serializers.SerializerMethodField()
    tipo_erro = serializers.SerializerMethodField()
    origem = serializers.SerializerMethodField()

    class Meta:
        from apps.plataforma_admin.models import RegistroErroOperacional

        model = RegistroErroOperacional
        fields = [
            "id",
            "schema_tenant",
            "nivel",
            "endpoint",
            "metodo",
            "mensagem",
            "traceback",
            "detalhes",
            "modulo",
            "tipo_erro",
            "origem",
            "criado_em",
        ]
        read_only_fields = fields

    def get_modulo(self, obj) -> str:
        if obj.detalhes and isinstance(obj.detalhes, dict) and obj.detalhes.get("modulo"):
            return str(obj.detalhes["modulo"]).capitalize()
        if obj.endpoint:
            partes = [p for p in obj.endpoint.strip("/").split("/") if p and p != "api"]
            if partes:
                return partes[0].capitalize()
        return "Geral"

    def get_tipo_erro(self, obj) -> str:
        if obj.detalhes and isinstance(obj.detalhes, dict) and obj.detalhes.get("tipo_erro"):
            return str(obj.detalhes["tipo_erro"])
        return obj.nivel or "ERROR"

    def get_origem(self, obj) -> str:
        if obj.detalhes and isinstance(obj.detalhes, dict) and obj.detalhes.get("origem"):
            return str(obj.detalhes["origem"])
        if obj.metodo and obj.endpoint:
            return f"{obj.metodo} {obj.endpoint}"
        return obj.endpoint or "Sistema"


class StudioExecuteInputSerializer(serializers.Serializer):
    """Payload para execução de queries SQL no Database Studio."""

    schema = serializers.CharField(max_length=63)
    sql = serializers.CharField()
    modo = serializers.ChoiceField(choices=["RO", "RW"], default="RO")
    justificativa = serializers.CharField(required=False, allow_blank=True, default="")
    limite_linhas = serializers.IntegerField(min_value=1, max_value=1000, default=100)


class RegistroAuditoriaVendorSerializer(serializers.ModelSerializer):
    """Serializer para exibição da trilha de auditoria do vendor."""

    acao_display = serializers.CharField(source="get_acao_display", read_only=True)

    class Meta:
        model = RegistroAuditoriaVendor
        fields = [
            "id",
            "operador_email",
            "ip_origem",
            "acao",
            "acao_display",
            "schema_alvo",
            "detalhes",
            "criado_em",
        ]


class PeriodicTaskListSerializer(serializers.Serializer):
    """Exibição detalhada de tarefas periódicas do Celery Beat."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    task = serializers.CharField()
    enabled = serializers.BooleanField()
    description = serializers.SerializerMethodField()
    last_run_at = serializers.DateTimeField(allow_null=True)
    total_run_count = serializers.IntegerField()
    tipo_agendamento = serializers.SerializerMethodField()
    agendamento_display = serializers.SerializerMethodField()
    interval_display = serializers.SerializerMethodField()
    crontab_display = serializers.SerializerMethodField()
    every = serializers.SerializerMethodField()
    period = serializers.SerializerMethodField()
    crontab_minute = serializers.SerializerMethodField()
    crontab_hour = serializers.SerializerMethodField()
    crontab_day_of_week = serializers.SerializerMethodField()

    def get_description(self, obj) -> str:
        if obj.description and obj.description.strip():
            return obj.description
        from apps.plataforma_admin.celery_manager import DESCRICOES_PADRAO
        return DESCRICOES_PADRAO.get(obj.name, DESCRICOES_PADRAO.get(obj.task, "Rotina de execução periódica em segundo plano."))

    def get_tipo_agendamento(self, obj) -> str:
        if obj.interval:
            return "INTERVALO"
        if obj.crontab:
            return "CRONTAB"
        return "CUSTOM"

    def get_agendamento_display(self, obj) -> str:
        if obj.interval:
            return f"A cada {obj.interval.every} {obj.interval.period}"
        if obj.crontab:
            return f"Cron: {obj.crontab.minute} {obj.crontab.hour} * * {obj.crontab.day_of_week}"
        return "Nenhum"

    def get_interval_display(self, obj) -> str:
        if obj.interval:
            return f"A cada {obj.interval.every} {obj.interval.period}"
        return "-"

    def get_crontab_display(self, obj) -> str:
        if obj.crontab:
            return f"{obj.crontab.minute} {obj.crontab.hour} * * {obj.crontab.day_of_week}"
        return "-"

    def get_every(self, obj) -> int | None:
        return obj.interval.every if obj.interval else None

    def get_period(self, obj) -> str | None:
        return obj.interval.period if obj.interval else None

    def get_crontab_minute(self, obj) -> str | None:
        return obj.crontab.minute if obj.crontab else None

    def get_crontab_hour(self, obj) -> str | None:
        return obj.crontab.hour if obj.crontab else None

    def get_crontab_day_of_week(self, obj) -> str | None:
        return obj.crontab.day_of_week if obj.crontab else None


class PeriodicTaskUpdateSerializer(serializers.Serializer):
    """Atualização em runtime de PeriodicTask."""

    enabled = serializers.BooleanField(required=False)
    every = serializers.IntegerField(min_value=1, required=False)
    period = serializers.ChoiceField(
        choices=["seconds", "minutes", "hours", "days"],
        required=False,
    )
    crontab_minute = serializers.CharField(max_length=64, required=False)
    crontab_hour = serializers.CharField(max_length=64, required=False)
    crontab_day_of_week = serializers.CharField(max_length=64, required=False)





class ConfiguracaoLoginVendorSerializer(serializers.ModelSerializer):
    """Configurações de Login & Sessão do Vendor Admin (com validação de faixas)."""

    access_token_min = serializers.IntegerField(min_value=5, max_value=240)
    refresh_token_horas = serializers.IntegerField(min_value=1, max_value=720)
    login_max_tentativas = serializers.IntegerField(min_value=3, max_value=20)
    login_bloqueio_min = serializers.IntegerField(min_value=1, max_value=240)
    impersonate_validade_min = serializers.IntegerField(min_value=5, max_value=240)

    class Meta:
        model = ConfiguracaoLoginVendor
        fields = [
            "access_token_min",
            "refresh_token_horas",
            "rotacionar_refresh",
            "login_max_tentativas",
            "login_bloqueio_min",
            "impersonate_validade_min",
            "impersonate_read_only_padrao",
            "exigir_2fa_todos",
            "throttle_vendor_login",
            "throttle_impersonate",
            "throttle_studio",
            "atualizado_em",
        ]
        read_only_fields = ["atualizado_em"]

    def _validar_rate(self, valor):
        import re

        alvo = (valor or "").strip()
        # Numerador deve ser >= 1 (sem zero e sem zeros à esquerda): "0/min" desliga o
        # login do painel (429 em toda requisição) e é irreversível pela própria API.
        m = re.match(r"^([1-9]\d*)/(s|sec|second|m|min|minute|h|hour|d|day)$", alvo)
        if not m:
            raise serializers.ValidationError("Formato inválido. Use 'N/min' com N>=1 (ex.: 30/min).")
        if int(m.group(1)) > 10000:
            raise serializers.ValidationError("Taxa muito alta. Máximo de 10000 por período.")
        return alvo

    def validate_throttle_vendor_login(self, v):
        return self._validar_rate(v)

    def validate_throttle_impersonate(self, v):
        return self._validar_rate(v)

    def validate_throttle_studio(self, v):
        return self._validar_rate(v)
