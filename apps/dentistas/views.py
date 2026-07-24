"""Views (API REST) do app dentistas."""

from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Dentista
from .serializers import DentistaSerializer


class DentistaViewSet(viewsets.ModelViewSet):
    """CRUD de dentistas (opera no schema do tenant da requisição)."""

    queryset = Dentista.objects.all()
    serializer_class = DentistaSerializer

    @action(detail=True, methods=["post"], url_path="criar-login")
    def criar_login(self, request, pk=None):
        """
        Cria uma conta de acesso (Usuario, papel DENTISTA) e a vincula ao
        dentista — o "login do profissional".
        """
        dentista = self.get_object()
        if dentista.usuario_id:
            return Response(
                {"detail": "Este dentista já possui um login vinculado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = request.data.get("email")
        senha = request.data.get("senha")
        if not email or not senha:
            return Response(
                {"detail": "Informe 'email' e 'senha'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        Usuario = get_user_model()
        if Usuario.objects.filter(email=email).exists():
            return Response(
                {"email": "Já existe um usuário com este e-mail."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        usuario = Usuario.objects.create_user(
            email=email,
            password=senha,
            papel=Usuario.Papel.DENTISTA,
            nome_completo=dentista.nome_completo,
        )
        dentista.usuario = usuario
        dentista.save(update_fields=["usuario", "atualizado_em"])
        serializer = self.get_serializer(dentista)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
