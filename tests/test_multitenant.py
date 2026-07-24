"""Testes da configuração multi-tenant (django-tenants)."""

import pytest
from django_tenants.models import DomainMixin, TenantMixin

from apps.tenants.models import Clinica, Dominio


def test_settings_multitenant(settings):
    """A configuração do django-tenants está aplicada."""
    assert settings.DATABASES["default"]["ENGINE"] == "django_tenants.postgresql_backend"
    assert settings.TENANT_MODEL == "tenants.Clinica"
    assert settings.TENANT_DOMAIN_MODEL == "tenants.Dominio"
    assert settings.MIDDLEWARE[0] == "config.middleware.HealthCheckMiddleware"
    assert settings.MIDDLEWARE[1] == "django_tenants.middleware.main.TenantMainMiddleware"
    assert "django_tenants" in settings.SHARED_APPS
    assert "apps.tenants" in settings.SHARED_APPS


def test_models_sao_subclasses_de_tenant_e_domain():
    """Clinica é um TenantMixin e Dominio é um DomainMixin."""
    assert issubclass(Clinica, TenantMixin)
    assert issubclass(Dominio, DomainMixin)


def test_clinica_str():
    """A representação textual da Clínica usa o nome fantasia."""
    assert str(Clinica(nome_fantasia="Clínica Exemplo")) == "Clínica Exemplo"


@pytest.mark.django_db
def test_tenant_publico_provisionado():
    """A data migration provisiona o tenant `public` com o domínio localhost."""
    publico = Clinica.objects.get(schema_name="public")
    assert publico.nome_fantasia == "Público"
    assert publico.razao_social == "Plataforma OdontoSaaS"
    dominio = Dominio.objects.get(domain="localhost")
    assert dominio.tenant_id == publico.pk
    assert dominio.is_primary is True


@pytest.mark.django_db
def test_clinica_tem_campos_enriquecidos():
    """Os campos de negócio adicionais existem no model Clinica."""
    campos = {f.name for f in Clinica._meta.get_fields()}
    assert {"nome_fantasia", "razao_social", "cnpj", "telefone", "ativo"} <= campos
