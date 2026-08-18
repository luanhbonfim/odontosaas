"""Views de autenticação.

`LoginView` estende o obtain de token do SimpleJWT adicionando bloqueio por
tentativas de senha malsucedidas (proteção contra força bruta): após
`LOGIN_FALHAS_MAX` falhas seguidas vindas do **mesmo IP**, novas tentativas
ficam bloqueadas por `LOGIN_BLOQUEIO_SEGUNDOS`. O contador vive no cache (Redis),
compartilhado entre os workers, e zera a cada login bem-sucedido.
"""

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.exceptions import APIException, PermissionDenied, Throttled
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.usuarios.perfis import pode_gerenciar
from apps.usuarios.serializers import UsuarioMeSerializer, UsuarioSerializer

# 5 tentativas com senha errada -> bloqueia por 15 minutos.
LOGIN_FALHAS_MAX = 5
LOGIN_BLOQUEIO_SEGUNDOS = 15 * 60


class TenantAtualView(APIView):
    """Nome da clínica (tenant) do host atual — PÚBLICO (usado na tela de login,
    antes de autenticar). Resolvido pelo subdomínio via django-tenants."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(exclude=True)
    def get(self, request):
        tenant = getattr(request, "tenant", None)
        return Response({"nome_fantasia": getattr(tenant, "nome_fantasia", "") or ""})
LOGIN_BLOQUEIO_MINUTOS = LOGIN_BLOQUEIO_SEGUNDOS // 60


def _ip_cliente(request) -> str:
    encaminhado = request.META.get("HTTP_X_FORWARDED_FOR")
    if encaminhado:
        return encaminhado.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "sem-ip")


def _chave_falhas(ip: str) -> str:
    # Bloqueio por IP de origem (não por conta): trava a máquina que faz a
    # varredura, independentemente do e-mail tentado. Inclui o schema do tenant.
    return f"login-falhas:{connection.schema_name}:{ip}"


class LoginView(TokenObtainPairView):
    """Obtém o par de tokens JWT, bloqueando o IP após tentativas malsucedidas."""

    def post(self, request, *args, **kwargs):
        chave = _chave_falhas(_ip_cliente(request))

        if cache.get(chave, 0) >= LOGIN_FALHAS_MAX:
            raise Throttled(
                detail=(
                    f"Muitas tentativas de login. Aguarde {LOGIN_BLOQUEIO_MINUTOS} minutos "
                    "e tente novamente."
                ),
            )

        try:
            resposta = super().post(request, *args, **kwargs)
        except APIException:
            # Credenciais inválidas / dados ausentes: conta a tentativa deste IP.
            cache.set(chave, cache.get(chave, 0) + 1, timeout=LOGIN_BLOQUEIO_SEGUNDOS)
            raise

        # Sucesso: zera o contador de falhas do IP.
        cache.delete(chave)
        return resposta


class MeView(APIView):
    """Dados do usuário autenticado (base do contexto de sessão do frontend).

    Exige autenticação (padrão global `IsAuthenticated`). Sem token válido,
    retorna `401` — o frontend usa isso para detectar sessão inválida no boot.
    """

    @extend_schema(responses=UsuarioMeSerializer)
    def get(self, request):
        serializer = UsuarioMeSerializer(request.user, context={"request": request})
        return Response(serializer.data)


class UsuarioViewSet(viewsets.ModelViewSet):
    """CRUD dos usuários da equipe (permissões do módulo "usuarios": Gerente/Admin).

    Respeita a **hierarquia**: um Gerente só cria/edita/bloqueia cargos abaixo do
    seu (Dentista/Recepção) — não mexe em Admin nem em outro Gerente. Admin gerencia
    todos.
    """

    queryset = get_user_model().objects.all().order_by("nome_completo", "email")
    serializer_class = UsuarioSerializer
    # Usuários não são excluídos (bloqueia-se o acesso); sem DELETE/PUT.
    http_method_names = ["get", "post", "patch", "head", "options"]

    def _checar_hierarquia(self, *papeis):
        ator = self.request.user
        for papel in papeis:
            if papel is not None and not pode_gerenciar(ator, papel):
                raise PermissionDenied("Você só pode gerenciar usuários de cargos abaixo do seu.")

    def create(self, request, *args, **kwargs):
        self._checar_hierarquia(request.data.get("papel", "RECEPCAO"))
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        alvo = self.get_object()
        # Auto-edição: só o próprio nome e senha (não muda o próprio papel nem se bloqueia).
        if alvo.pk == request.user.pk:
            if request.data.get("papel") not in (None, alvo.papel):
                raise PermissionDenied("Você não pode alterar o seu próprio perfil.")
            if "ativo" in request.data and request.data.get("ativo") != alvo.is_active:
                raise PermissionDenied("Você não pode bloquear o seu próprio acesso.")
            return super().update(request, *args, **kwargs)
        # Alvo atual e (se estiver mudando) o novo papel precisam ser abaixo do ator.
        self._checar_hierarquia(alvo.papel, request.data.get("papel"))
        return super().update(request, *args, **kwargs)
