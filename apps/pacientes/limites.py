"""Limite de pacientes ativos do plano (Sprint P).

**Paciente ativo** = `Paciente.ativo=True` (o status "Ativo/Inativo" que a clínica controla;
inativar libera a vaga, reativar a ocupa). A contagem é por schema (tenant). O limite
só barra **novos** cadastros ativos e **reativações**: clínica que já está acima da cota
(ex.: trocou para um plano menor) mantém os pacientes que tem, sem desativação forçada.
"""

from rest_framework import status
from rest_framework.exceptions import APIException

from .models import Paciente

# A partir deste percentual da cota a UI avisa que o limite está próximo.
PERCENTUAL_AVISO = 90


class LimitePacientesAtingido(APIException):
    """400 com `codigo` estável para a UI oferecer o CTA de upgrade.

    O corpo é um dict e o DRF stringifica valores (`limite`/`atual` viriam como "2"); por isso
    `get_full_details`/`detail` são sobrescritos para devolver o payload exatamente como está."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "limite_pacientes"

    def __init__(self, payload: dict):
        super().__init__()
        self.detail = payload


def cota_pacientes(tenant) -> dict:
    """Uso atual x limite efetivo de pacientes ativos da clínica (schema corrente)."""
    limite = tenant.get_limite_pacientes() if hasattr(tenant, "get_limite_pacientes") else None
    atual = Paciente.objects.filter(ativo=True).count()
    ilimitado = limite is None
    percentual = round(atual / limite * 100, 1) if limite else 0
    return {
        "atual": atual,
        "limite": limite,
        "ilimitado": ilimitado,
        "percentual": percentual,
        "atingiu_limite": bool(limite is not None and atual >= limite),
        "proximo_do_limite": bool(limite and percentual >= PERCENTUAL_AVISO),
    }


def garantir_vaga_paciente(tenant, *, reativacao: bool = False) -> None:
    """Levanta `LimitePacientesAtingido` se não houver vaga para mais um paciente ativo."""
    cota = cota_pacientes(tenant)
    if not cota["atingiu_limite"]:
        return
    limite = cota["limite"]
    acao = "reativar o paciente" if reativacao else "cadastrar novos pacientes"
    raise LimitePacientesAtingido(
        {
            "detail": (
                f"Não é possível {acao}: o limite de {limite} pacientes ativos do plano da "
                "clínica foi atingido. Inative pacientes que não frequentam mais ou faça "
                "upgrade do plano."
            ),
            "codigo": "limite_pacientes",
            "limite": limite,
            "atual": cota["atual"],
        }
    )


def tenant_atual():
    """Clínica do schema corrente. Em tarefas Celery (`schema_context`) `connection.tenant`
    é um objeto falso só com `schema_name`; nesse caso busca a `Clinica` real."""
    from django.db import connection

    tenant = getattr(connection, "tenant", None)
    if hasattr(tenant, "get_limite_pacientes"):
        return tenant
    from apps.tenants.models import Clinica

    return Clinica.objects.filter(schema_name=connection.schema_name).first()
