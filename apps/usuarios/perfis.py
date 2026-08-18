"""Perfis de acesso: matriz de permissões, semeadura de grupos e a permission
class do DRF.

A autorização real vive nos **grupos do Django** (por-tenant): cada papel
(`RECEPCAO`/`DENTISTA`/`DENTISTA_GERENTE`/`ADMIN`) corresponde a um `Group` com
as permissões de model dos módulos que pode acessar. O `papel` do usuário mapeia
para o grupo (ver `signals.py`). Fonte da matriz: docs/03-BACKLOG-SPRINTS.md.
"""

from rest_framework.permissions import DjangoModelPermissions

# Níveis de acesso a um módulo.
FULL = "full"  # ver + criar + editar + excluir
READ = "read"  # só leitura

# Módulo -> app_label cujos models compõem o módulo.
MODULOS = {
    "agenda": "agenda",
    "pacientes": "pacientes",
    "dentistas": "dentistas",
    "convenios": "convenios",
    "procedimentos": "procedimentos",
    "estoque": "estoque",
    "financeiro": "financeiro",
    "notificacoes": "notificacoes",
    "auditoria": "auditoria",
    "usuarios": "usuarios",
}

# Papel -> {módulo: nível}. Módulo ausente = sem acesso.
MATRIZ = {
    "RECEPCAO": {
        "agenda": FULL,
        "pacientes": FULL,
        "dentistas": READ,
        "convenios": FULL,
        "procedimentos": FULL,
        "estoque": FULL,
        "notificacoes": FULL,
    },
    "DENTISTA": {
        "agenda": FULL,
        "pacientes": FULL,
        "dentistas": READ,
        "convenios": READ,
        "procedimentos": READ,
        "estoque": READ,
    },
    "DENTISTA_GERENTE": {
        "agenda": FULL,
        "pacientes": FULL,
        "dentistas": FULL,
        "convenios": FULL,
        "procedimentos": FULL,
        "estoque": FULL,
        "financeiro": FULL,
        "notificacoes": FULL,
        "auditoria": READ,
        "usuarios": FULL,
    },
    "ADMIN": {modulo: FULL for modulo in MODULOS},
}

# Hierarquia dos papéis: um usuário só gerencia (cria/edita/bloqueia/reseta senha)
# cargos **estritamente abaixo** do seu. Admin (e superuser) gerenciam todos.
RANK_PAPEL = {"RECEPCAO": 0, "DENTISTA": 1, "DENTISTA_GERENTE": 2, "ADMIN": 3}


def pode_gerenciar(ator, alvo_papel) -> bool:
    """`ator` (Usuario) pode gerenciar alguém de papel `alvo_papel`?

    Admin/superuser: sempre. Demais: só papéis de rank estritamente menor que o
    seu (nunca a si mesmo nem pares/superiores). Valor de papel inesperado
    (não-string, desconhecido) é tratado como rank máximo → **fail-closed**.
    """
    if getattr(ator, "is_superuser", False) or getattr(ator, "papel", None) == "ADMIN":
        return True
    rank_ator = RANK_PAPEL.get(getattr(ator, "papel", ""), 99)
    rank_alvo = RANK_PAPEL.get(alvo_papel, 99) if isinstance(alvo_papel, str) else 99
    return rank_alvo < rank_ator


_ACOES_FULL = ("view", "add", "change", "delete")


def _permissoes(app_label, nivel):
    """Retorna as permissões de model do app conforme o nível (full/read)."""
    from django.contrib.auth.models import Permission
    from django.db.models import Q

    acoes = _ACOES_FULL if nivel == FULL else ("view",)
    filtro = Q()
    for acao in acoes:
        filtro |= Q(codename__startswith=f"{acao}_")
    return list(Permission.objects.filter(content_type__app_label=app_label).filter(filtro))


def sincronizar_grupos():
    """Cria/atualiza os grupos padrão no schema (tenant) atual conforme a matriz."""
    from django.contrib.auth.models import Group

    for papel, modulos in MATRIZ.items():
        grupo, _ = Group.objects.get_or_create(name=papel)
        permissoes = []
        for modulo, nivel in modulos.items():
            permissoes.extend(_permissoes(MODULOS[modulo], nivel))
        grupo.permissions.set(permissoes)


class PermissaoModulo(DjangoModelPermissions):
    """Permissão global: exige permissão de model nos viewsets (view p/ GET,
    add/change/delete p/ escrita) e apenas autenticação nas views sem model
    (ex.: `/api/auth/me/`)."""

    perms_map = {
        "GET": ["%(app_label)s.view_%(model_name)s"],
        "OPTIONS": [],
        "HEAD": [],
        "POST": ["%(app_label)s.add_%(model_name)s"],
        "PUT": ["%(app_label)s.change_%(model_name)s"],
        "PATCH": ["%(app_label)s.change_%(model_name)s"],
        "DELETE": ["%(app_label)s.delete_%(model_name)s"],
    }

    def has_permission(self, request, view):
        autenticado = bool(request.user and request.user.is_authenticated)
        tem_model = getattr(view, "queryset", None) is not None or hasattr(view, "get_queryset")
        if not tem_model:
            return autenticado
        return super().has_permission(request, view)
