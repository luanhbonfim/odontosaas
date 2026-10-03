"""Busca global (Topbar): pacientes e consultas num único round-trip — sem models próprios.

O escopo do DENTISTA é o mesmo das listas (`escopo_dentista_q`: responsável,
compartilhado ou com consulta); sem cadastro de dentista vinculado → nada (fail-closed).
Cada bloco vem `None` quando o usuário não tem permissão de ver o módulo.
"""

from django.db.models import Q

from apps.agenda.models import Consulta
from apps.core.mixins import escopo_dentista_q
from apps.pacientes.models import Paciente

MIN_CARACTERES = 2
LIMITE = 6
MIN_DIGITOS_CPF = 3


def _digitos(texto: str) -> str:
    return "".join(ch for ch in texto if ch.isdigit())


def _escopar(qs, user, prefixo=""):
    if getattr(user, "papel", None) != "DENTISTA":
        return qs
    dentista = getattr(user, "dentista", None)
    if dentista is None:
        return qs.none()
    return qs.filter(escopo_dentista_q(dentista, prefixo)).distinct()


def _buscar_pacientes(user, termo: str) -> list[dict]:
    filtro = Q(nome_completo__icontains=termo)
    digitos = _digitos(termo)
    if len(digitos) >= MIN_DIGITOS_CPF:
        filtro |= Q(cpf__icontains=digitos)
    qs = _escopar(Paciente.objects.filter(filtro), user).order_by("nome_completo")[:LIMITE]
    return [
        {
            "id": p.id,
            "nome_completo": p.nome_completo,
            "cpf": p.cpf or "",
            "ativo": p.ativo,
            "telefone_whatsapp": p.telefone_whatsapp,
        }
        for p in qs
    ]


def _buscar_consultas(user, termo: str) -> list[dict]:
    filtro = (
        Q(paciente__nome_completo__icontains=termo)
        | Q(procedimento__icontains=termo)
        | Q(procedimento_catalogo__nome__icontains=termo)
    )
    qs = (
        _escopar(Consulta.objects.filter(filtro), user, "paciente__")
        .select_related("paciente", "dentista", "procedimento_catalogo")
        .order_by("-inicio")[:LIMITE]
    )
    return [
        {
            "id": c.id,
            "inicio": c.inicio,
            "status": c.status,
            "paciente_id": c.paciente_id,
            "paciente_nome": c.paciente.nome_completo,
            "dentista_nome": c.dentista.nome_completo,
            "procedimento": c.procedimento_catalogo.nome
            if c.procedimento_catalogo_id
            else c.procedimento,
        }
        for c in qs
    ]


def buscar(user, termo: str) -> dict:
    termo = (termo or "").strip()
    pode_pacientes = user.has_perm("pacientes.view_paciente")
    pode_consultas = user.has_perm("agenda.view_consulta")
    curto = len(termo) < MIN_CARACTERES
    return {
        "pacientes": None
        if not pode_pacientes
        else ([] if curto else _buscar_pacientes(user, termo)),
        "consultas": None
        if not pode_consultas
        else ([] if curto else _buscar_consultas(user, termo)),
    }
