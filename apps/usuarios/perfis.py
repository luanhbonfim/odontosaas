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
        "financeiro": FULL,
        "notificacoes": FULL,
    },
    "DENTISTA": {
        "agenda": FULL,
        "pacientes": FULL,
        "dentistas": READ,
        "convenios": READ,
        "procedimentos": FULL,
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

# Papéis que o Gerente/Admin pode personalizar na tela "Permissões" (por
# módulo, com CRUD granular) — Gerente/Admin ficam de fora, sempre com acesso
# total fixo (evita autobloqueio; RANK_PAPEL abaixo já garante que só cargos
# abaixo do ator são geridos/afetados).
PAPEIS_CUSTOMIZAVEIS = ("RECEPCAO", "DENTISTA")
# Módulos com tela real no tenant hoje — de fora: "auditoria" (sem tela no
# tenant) e módulos gateados fora da MATRIZ (Integrações, Meu Plano).
MODULOS_CUSTOMIZAVEIS = [
    "agenda",
    "pacientes",
    "convenios",
    "dentistas",
    "procedimentos",
    "estoque",
    "financeiro",
    "notificacoes",
    "usuarios",
]

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


def _nivel_para_booleans(nivel):
    """Traduz um nível FULL/READ/ausente da MATRIZ pras 4 flags de CRUD."""
    if nivel == FULL:
        return {"ver": True, "criar": True, "editar": True, "excluir": True}
    if nivel == READ:
        return {"ver": True, "criar": False, "editar": False, "excluir": False}
    return {"ver": False, "criar": False, "editar": False, "excluir": False}


def permissao_efetiva(papel, modulo):
    """{ver,criar,editar,excluir} pro papel+módulo.

    Gerente/Admin (e módulos fora de `MODULOS_CUSTOMIZAVEIS`) vêm sempre da
    MATRIZ fixa. Recepção/Dentista vêm de `PermissaoModuloPersonalizada`
    (semeada com o default da MATRIZ na primeira leitura) — é essa tabela que
    a tela "Permissões" edita.
    """
    if papel not in PAPEIS_CUSTOMIZAVEIS or modulo not in MODULOS_CUSTOMIZAVEIS:
        return _nivel_para_booleans(MATRIZ.get(papel, {}).get(modulo))

    from apps.usuarios.models import PermissaoModuloPersonalizada

    cfg, _ = PermissaoModuloPersonalizada.objects.get_or_create(
        papel=papel,
        modulo=modulo,
        defaults=_nivel_para_booleans(MATRIZ.get(papel, {}).get(modulo)),
    )
    return {"ver": cfg.ver, "criar": cfg.criar, "editar": cfg.editar, "excluir": cfg.excluir}


def permissoes_efetivas_do_papel(papel):
    """Grade {módulo: {ver,criar,editar,excluir}} pros módulos personalizáveis."""
    return {modulo: permissao_efetiva(papel, modulo) for modulo in MODULOS_CUSTOMIZAVEIS}


def _permissoes_bool(app_label, ver, criar, editar, excluir):
    """Permissões de model do app conforme as 4 flags de CRUD independentes."""
    from django.contrib.auth.models import Permission
    from django.db.models import Q

    mapa = {"view": ver, "add": criar, "change": editar, "delete": excluir}
    acoes = [acao for acao, ligado in mapa.items() if ligado]
    if not acoes:
        return []
    filtro = Q()
    for acao in acoes:
        filtro |= Q(codename__startswith=f"{acao}_")
    return list(Permission.objects.filter(content_type__app_label=app_label).filter(filtro))


def sincronizar_grupos():
    """Cria/atualiza os grupos padrão no schema (tenant) atual conforme a
    matriz (Gerente/Admin) e as personalizações salvas (Recepção/Dentista)."""
    from django.contrib.auth.models import Group

    for papel in MATRIZ:
        grupo, _ = Group.objects.get_or_create(name=papel)
        permissoes = []
        for modulo in MODULOS:
            cfg = permissao_efetiva(papel, modulo)
            permissoes.extend(_permissoes_bool(MODULOS[modulo], **cfg))
        grupo.permissions.set(permissoes)


class PermissaoModulo(DjangoModelPermissions):
    """Permissão global: exige permissão de model nos viewsets (view p/ GET,
    add/change/delete p/ escrita) e apenas autenticação nas views sem model
    (ex.: `/api/auth/me/`). Além disso, bloqueia endpoints de módulos que estejam
    desabilitados no plano/override da clínica."""

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
        from rest_framework.exceptions import PermissionDenied

        autenticado = bool(request.user and request.user.is_authenticated)
        if not autenticado:
            return False

        # Valida se o módulo correspondente está habilitado para o tenant
        tenant = getattr(request, "tenant", None)
        if tenant and getattr(tenant, "schema_name", "public") != "public":
            caminho = getattr(request, "path", "")
            if "/api/integracoes/" in caminho:
                if hasattr(tenant, "recurso_habilitado") and not tenant.recurso_habilitado("google_calendar"):
                    raise PermissionDenied(
                        "O módulo de integração com Google Calendar está desabilitado para esta clínica pelo plano contratado."
                    )
            elif "/api/notificacoes/" in caminho or "/api/config-notificacao/" in caminho:
                if hasattr(tenant, "recurso_habilitado") and not tenant.recurso_habilitado("whatsapp"):
                    raise PermissionDenied(
                        "O módulo de notificações e automações por WhatsApp está desabilitado para esta clínica pelo plano contratado."
                    )
            elif "/api/financeiro/" in caminho:
                if hasattr(tenant, "recurso_habilitado") and not tenant.recurso_habilitado("financeiro"):
                    raise PermissionDenied(
                        "O módulo financeiro está desabilitado para esta clínica pelo plano contratado."
                    )
            elif (
                any(
                    p in caminho
                    for p in (
                        "/api/insumos/",
                        "/api/categorias-insumo/",
                        "/api/movimentacoes-estoque/",
                        "/api/consumos-insumo/",
                        "/api/fornecedores/",
                    )
                )
                and hasattr(tenant, "recurso_habilitado")
                and not tenant.recurso_habilitado("estoque")
            ):
                raise PermissionDenied(
                    "O módulo de estoque está desabilitado para esta clínica pelo plano contratado."
                )

        tem_model = getattr(view, "queryset", None) is not None or hasattr(view, "get_queryset")
        if not tem_model:
            return autenticado
        return super().has_permission(request, view)
