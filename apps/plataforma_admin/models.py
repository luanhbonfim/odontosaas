"""
Models de governança e auditoria da plataforma (schema `public`).
"""

from django.db import models


class RegistroAuditoriaVendor(models.Model):
    """Trilha de auditoria das ações realizadas pelos operadores/mantenedores do SaaS."""

    class Acao(models.TextChoices):
        CRIAR_PLANO = "CRIAR_PLANO", "Criação de plano"
        EDITAR_PLANO = "EDITAR_PLANO", "Edição de plano"
        DESATIVAR_PLANO = "DESATIVAR_PLANO", "Desativação de plano"
        PROVISIONAR_CLINICA = "PROVISIONAR_CLINICA", "Provisionamento de clínica"
        BLOQUEAR_CLINICA = "BLOQUEAR_CLINICA", "Bloqueio de clínica"
        DESBLOQUEAR_CLINICA = "DESBLOQUEAR_CLINICA", "Desbloqueio de clínica"
        EXPURGAR_CLINICA = "EXPURGAR_CLINICA", "Expurgo de clínica (drop schema)"
        RESET_SENHA_ADMIN = "RESET_SENHA_ADMIN", "Reset de senha do admin da clínica"
        IMPERSONATE = "IMPERSONATE", "Acesso de suporte (impersonate)"
        PARAMETRIZACAO = "PARAMETRIZACAO", "Alteração de parâmetros (Google/WhatsApp)"
        STUDIO_QUERY = "STUDIO_QUERY", "Execução de query no Database Studio"
        CELERY_TRIGGER = "CELERY_TRIGGER", "Disparo manual de tarefa Celery"
        CELERY_CONFIG = "CELERY_CONFIG", "Alteração de agendamento Celery Beat"
        OUTRO = "OUTRO", "Outra ação administrativa"

    operador_email = models.EmailField(
        max_length=255,
        help_text="E-mail do operador/superusuário que executou a ação",
    )
    ip_origem = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="Endereço IP de origem da requisição",
    )
    acao = models.CharField(
        max_length=50,
        choices=Acao.choices,
        default=Acao.OUTRO,
    )
    schema_alvo = models.CharField(
        max_length=100,
        blank=True,
        default="public",
        help_text="Schema sobre o qual a ação foi executada",
    )
    detalhes = models.JSONField(
        default=dict,
        blank=True,
        help_text="Dados contextuais da ação (payload, query SQL, linhas afetadas, etc.)",
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Registro de auditoria do vendor"
        verbose_name_plural = "Registros de auditoria do vendor"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["operador_email", "-criado_em"]),
            models.Index(fields=["schema_alvo", "-criado_em"]),
            models.Index(fields=["acao", "-criado_em"]),
        ]

    def __str__(self):
        return f"[{self.criado_em:%Y-%m-%d %H:%M:%S}] {self.operador_email} - {self.acao} ({self.schema_alvo})"


class RegistroErroOperacional(models.Model):
    """Sink de logs de erros capturados nos tenants ou na plataforma para exibição no painel."""

    class Nivel(models.TextChoices):
        WARNING = "WARNING", "Aviso"
        ERROR = "ERROR", "Erro"
        CRITICAL = "CRITICAL", "Crítico"

    schema_tenant = models.CharField(
        max_length=100,
        help_text="Schema da clínica onde o erro ocorreu",
    )
    nivel = models.CharField(
        max_length=20,
        choices=Nivel.choices,
        default=Nivel.ERROR,
    )
    endpoint = models.CharField(
        max_length=255,
        blank=True,
        help_text="URL / endpoint da requisição que falhou",
    )
    metodo = models.CharField(
        max_length=10,
        blank=True,
        help_text="Método HTTP (GET, POST, etc.)",
    )
    mensagem = models.TextField(
        help_text="Mensagem resumida do erro",
    )
    traceback = models.TextField(
        blank=True,
        help_text="Stack trace completo da exceção",
    )
    detalhes = models.JSONField(
        default=dict,
        blank=True,
        help_text="Contexto adicional (payload, user_id, headers sanitizados)",
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Registro de erro operacional"
        verbose_name_plural = "Registros de erros operacionais"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["schema_tenant", "-criado_em"]),
            models.Index(fields=["nivel", "-criado_em"]),
        ]

    def __str__(self):
        return f"[{self.criado_em:%Y-%m-%d %H:%M:%S}] {self.schema_tenant} - {self.nivel}: {self.mensagem[:60]}"
