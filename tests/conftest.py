"""
Configuração compartilhada de testes.

A API passou a exigir autenticação (JWT + IsAuthenticated por padrão). Para não
reescrever os 17 arquivos de teste de API, autenticamos automaticamente todo
`APIClient` com um usuário forjado (basta satisfazer `IsAuthenticated`).

- O usuário forjado tem `pk=0` de propósito: o middleware de auditoria só registra
  usuários persistidos (pk verdadeiro), então ele NÃO cria FK inválida.
- Testes que exercitam o fluxo JWT real usam o marcador `@pytest.mark.no_auto_auth`
  para desligar a auto-autenticação e trabalhar com um cliente cru.
"""

from unittest.mock import MagicMock

import pytest
from rest_framework.test import APIClient


class _UsuarioForjado:
    """Usuário mínimo que satisfaz autenticação + permissões sem tocar no banco.

    Como `is_superuser=True` (e `has_perm(s)` retornam True), passa por
    `PermissaoModulo`/`DjangoModelPermissions` sem precisar de grupos — assim os
    testes de API existentes seguem sem reescrita. Testes de autorização por
    perfil usam `@pytest.mark.no_auto_auth` com usuários reais e grupos.
    """

    is_authenticated = True
    is_active = True
    is_staff = True
    is_superuser = True
    pk = 0
    id = 0

    def has_perm(self, perm, obj=None):
        return True

    def has_perms(self, perms, obj=None):
        return True

    def has_module_perms(self, app_label):
        return True


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "no_auto_auth: desativa a auto-autenticação do APIClient no teste"
    )


@pytest.fixture(autouse=True)
def _apiclient_autenticado(request, monkeypatch):
    if request.node.get_closest_marker("no_auto_auth"):
        return

    init_original = APIClient.__init__

    def init_autenticado(self, *args, **kwargs):
        init_original(self, *args, **kwargs)
        self.force_authenticate(user=_UsuarioForjado())

    monkeypatch.setattr(APIClient, "__init__", init_autenticado)


@pytest.fixture(autouse=True)
def cancelamento_task_mock(monkeypatch):
    """Impede que o signal de cancelamento enfileire envios REAIS de WhatsApp nos
    testes (o signal importa a task de forma tardia; devolvemos um mock).

    Testes que querem verificar o disparo recebem este fixture e checam `.delay`.
    """
    mock = MagicMock()
    monkeypatch.setattr("apps.notificacoes.tasks.enviar_cancelamento_task", mock)
    return mock
