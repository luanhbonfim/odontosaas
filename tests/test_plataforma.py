"""Testes do app plataforma (PlanoAssinatura) e do vínculo com Clinica."""

import pytest

from apps.plataforma.models import PlanoAssinatura
from apps.tenants.models import Clinica


def test_plataforma_no_shared_apps(settings):
    """O app plataforma é compartilhado (schema público)."""
    assert "apps.plataforma" in settings.SHARED_APPS


def test_clinica_tem_fk_plano_assinatura():
    """Clinica possui a FK opcional para PlanoAssinatura."""
    campo = Clinica._meta.get_field("plano_assinatura")
    assert campo.null is True
    assert campo.related_model is PlanoAssinatura


@pytest.mark.django_db
def test_criar_plano_assinatura():
    """Cria um plano e valida persistência + representação textual."""
    plano = PlanoAssinatura.objects.create(
        nome="Pro",
        preco_mensal="199.90",
        limite_dentistas=10,
    )
    assert PlanoAssinatura.objects.count() == 1
    assert str(plano) == "Pro"
    assert plano.ativo is True
