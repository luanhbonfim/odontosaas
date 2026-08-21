"""
Models do tenant (schema `public`).

`Clinica` é o tenant (cada clínica = um schema PostgreSQL isolado) e `Dominio`
mapeia o subdomínio de acesso ao tenant. Campos de negócio adicionais
(razão social, plano de assinatura, etc.) serão acrescentados nas próximas
tarefas da Sprint 1.
"""

from django.db import models
from django_tenants.models import DomainMixin, TenantMixin


class Clinica(TenantMixin):
    """Tenant do sistema — cada clínica vive em seu próprio schema."""

    class StatusAssinatura(models.TextChoices):
        TRIAL = "TRIAL", "Em período de testes"
        ATIVA = "ATIVA", "Assinatura ativa"
        INADIMPLENTE = "INADIMPLENTE", "Inadimplente / Pagamento pendente"
        CANCELADA = "CANCELADA", "Cancelada"

    nome_fantasia = models.CharField(max_length=255)
    razao_social = models.CharField(max_length=255, blank=True)
    cnpj = models.CharField(max_length=14, unique=True, blank=True, null=True)
    telefone = models.CharField(max_length=20, blank=True)
    responsavel_nome = models.CharField(max_length=255, blank=True, help_text="Nome completo do responsável assinante")
    responsavel_cpf = models.CharField(max_length=14, blank=True, help_text="CPF do responsável assinante")
    responsavel_telefone = models.CharField(max_length=20, blank=True, help_text="Telefone/WhatsApp do responsável")
    responsavel_email = models.EmailField(blank=True, null=True, help_text="E-mail de contato institucional do responsável")
    plano_assinatura = models.ForeignKey(
        "plataforma.PlanoAssinatura",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="clinicas",
    )
    status_assinatura = models.CharField(
        max_length=20,
        choices=StatusAssinatura.choices,
        default=StatusAssinatura.ATIVA,
        help_text="Estado atual da assinatura do SaaS",
    )
    gateway_customer_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="ID do cliente no gateway de pagamentos (Asaas/Stripe)",
    )
    gateway_subscription_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="ID da assinatura recorrente no gateway",
    )
    vigencia_fim = models.DateField(
        null=True,
        blank=True,
        help_text="Data final da vigência / vencimento da fatura atual",
    )
    override_limite_dentistas = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Override manual do limite de dentistas (ignora plano se definido)",
    )
    override_limite_usuarios = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Override manual do limite de usuários (ignora plano se definido)",
    )
    override_recursos = models.JSONField(
        default=dict,
        blank=True,
        help_text="Overrides de flags de módulos/recursos específicos para esta clínica",
    )
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    # Cria/derruba o schema automaticamente ao salvar/excluir a clínica.
    auto_create_schema = True

    class Meta:
        verbose_name = "Clínica"
        verbose_name_plural = "Clínicas"

    def __str__(self):
        return self.nome_fantasia

    def get_limite_dentistas(self):
        """Retorna o limite efetivo de dentistas (override tem precedência)."""
        if self.override_limite_dentistas is not None:
            return self.override_limite_dentistas
        if self.plano_assinatura:
            return self.plano_assinatura.limite_dentistas
        return None

    def get_limite_usuarios(self):
        """Retorna o limite efetivo de usuários (override tem precedência)."""
        if self.override_limite_usuarios is not None:
            return self.override_limite_usuarios
        if self.plano_assinatura:
            return self.plano_assinatura.limite_usuarios
        return None

    def recurso_habilitado(self, nome_recurso: str) -> bool:
        """
        Verifica se um módulo/recurso está habilitado para a clínica.
        Ordem de precedência:
        1. override_recursos (definido especificamente no tenant pelo Vendor Admin)
        2. PlanoAssinatura (flags padrão do plano comercial contratado)
        3. True por padrão (fallback se não houver plano)
        """
        # 1. Verifica override específico da clínica
        if self.override_recursos and isinstance(self.override_recursos, dict):
            # Normaliza chaves
            alias = {
                "google_calendar": ["google_calendar", "sync_google", "google", "modulo_google_calendar"],
                "sync_google": ["google_calendar", "sync_google", "google", "modulo_google_calendar"],
                "whatsapp": ["whatsapp", "whatsapp_waha", "waha", "modulo_whatsapp"],
                "whatsapp_waha": ["whatsapp", "whatsapp_waha", "waha", "modulo_whatsapp"],
                "financeiro": ["financeiro", "modulo_financeiro_ativo", "modulo_financeiro"],
                "estoque": ["estoque", "modulo_estoque_ativo", "modulo_estoque"],
            }.get(nome_recurso, [nome_recurso])

            for chave in alias:
                if chave in self.override_recursos and self.override_recursos[chave] is not None:
                    return bool(self.override_recursos[chave])

        # 2. Verifica plano de assinatura
        plano = self.plano_assinatura
        if not plano:
            return True

        if nome_recurso in ("google_calendar", "sync_google", "google"):
            return bool(getattr(plano, "sync_google_ativo", True))
        if nome_recurso in ("whatsapp", "whatsapp_waha", "waha"):
            return bool(getattr(plano, "whatsapp_waha_ativo", True))
        if nome_recurso in ("financeiro", "modulo_financeiro"):
            return bool(getattr(plano, "modulo_financeiro_ativo", True))
        if nome_recurso in ("estoque", "modulo_estoque"):
            return bool(getattr(plano, "modulo_estoque_ativo", True))

        return True

    def get_modulos_efetivos(self) -> dict:
        """Retorna o mapa consolidado de módulos ativos para esta clínica."""
        return {
            "google_calendar": self.recurso_habilitado("google_calendar"),
            "sync_google": self.recurso_habilitado("google_calendar"),
            "whatsapp": self.recurso_habilitado("whatsapp"),
            "whatsapp_waha": self.recurso_habilitado("whatsapp"),
            "financeiro": self.recurso_habilitado("financeiro"),
            "estoque": self.recurso_habilitado("estoque"),
        }

    def get_status_efetivo(self):
        """Retorna o status operacional/comercial efetivo da clínica."""
        import datetime
        from django.utils import timezone
        if not self.ativo:
            return "BLOQUEADA"
        if isinstance(self.vigencia_fim, datetime.date) and self.vigencia_fim < timezone.localdate():
            return "VENCIDA"
        if self.status_assinatura == self.StatusAssinatura.INADIMPLENTE:
            return "INADIMPLENTE"
        if self.status_assinatura == self.StatusAssinatura.CANCELADA:
            return "CANCELADA"
        if self.status_assinatura == self.StatusAssinatura.TRIAL:
            return "TRIAL"
        return "ATIVA"

    def pode_acessar_sistema(self):
        """Indica se a clínica tem permissão operacional de acesso ao sistema."""
        import datetime
        from django.utils import timezone
        if not self.ativo:
            return False
        if self.status_assinatura in (
            self.StatusAssinatura.INADIMPLENTE,
            self.StatusAssinatura.CANCELADA,
        ):
            return False
        if isinstance(self.vigencia_fim, datetime.date) and self.vigencia_fim < timezone.localdate():
            return False
        return True


class Dominio(DomainMixin):
    """Domínio (subdomínio) que resolve para uma clínica."""

    class Meta:
        verbose_name = "Domínio"
        verbose_name_plural = "Domínios"
