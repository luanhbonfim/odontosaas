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

    nome_fantasia = models.CharField(max_length=255)
    razao_social = models.CharField(max_length=255, blank=True)
    cnpj = models.CharField(max_length=14, unique=True, blank=True, null=True)
    telefone = models.CharField(max_length=20, blank=True)
    plano_assinatura = models.ForeignKey(
        "plataforma.PlanoAssinatura",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="clinicas",
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


class Dominio(DomainMixin):
    """Domínio (subdomínio) que resolve para uma clínica."""

    class Meta:
        verbose_name = "Domínio"
        verbose_name_plural = "Domínios"
