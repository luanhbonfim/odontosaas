"""
Fluxo OAuth2 do Google Calendar (por clínica/dentista).

- google_authorize: monta a URL de consentimento e redireciona.
- google_callback: troca o `code` por tokens e salva em CredencialGoogleCalendar.

Roda no schema do tenant da requisição; a credencial é gravada no tenant.
"""

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import redirect
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import extend_schema
from google_auth_oauthlib.flow import Flow
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.dentistas.models import Dentista
from apps.integracoes.models import ConfiguracaoSincronizacao, CredencialGoogleCalendar
from apps.integracoes.serializers import ConexaoGoogleSerializer

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


def _client_config():
    return {
        "web": {
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GOOGLE_OAUTH_REDIRECT_URI],
        }
    }


def get_flow(state=None):
    """Cria o Flow OAuth2 (isolado para facilitar o mock nos testes)."""
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, state=state)
    flow.redirect_uri = settings.GOOGLE_OAUTH_REDIRECT_URI
    return flow


def google_authorize(request):
    """Redireciona para a tela de consentimento do Google."""
    flow = get_flow()
    auth_url, state = flow.authorization_url(
        access_type="offline", include_granted_scopes="true", prompt="consent"
    )
    request.session["google_oauth_state"] = state
    dentista_id = request.GET.get("dentista")
    if dentista_id:
        request.session["google_oauth_dentista"] = dentista_id
    return redirect(auth_url)


def _redirect_integracoes(status):
    """Volta o navegador para a tela de Integrações da SPA com um status."""
    base = getattr(settings, "GOOGLE_OAUTH_FRONTEND_URL", "") or ""
    return redirect(f"{base}/integracoes?google={status}")


def google_callback(request):
    """Recebe o code do Google, troca por tokens, salva a credencial e volta à SPA."""
    try:
        flow = get_flow(state=request.session.get("google_oauth_state"))
        flow.fetch_token(code=request.GET.get("code"))
        creds = flow.credentials

        dentista_id = request.session.get("google_oauth_dentista")
        dentista = Dentista.objects.filter(pk=dentista_id).first() if dentista_id else None

        CredencialGoogleCalendar.objects.update_or_create(
            dentista=dentista,
            defaults={
                "access_token": creds.token or "",
                "refresh_token": creds.refresh_token or "",
                "token_expiry": creds.expiry,
                "scope": " ".join(creds.scopes or []),
            },
        )
    except Exception:  # noqa: BLE001 — qualquer falha na troca de token vira "erro" na UI
        return _redirect_integracoes("erro")
    return _redirect_integracoes("conectado")


# --- API REST (para a tela de Integrações) ---------------------------------


def _eh_gestor(user):
    """Gerente/Admin (ou superuser) enxergam/gerenciam todas as integrações."""
    return getattr(user, "is_superuser", False) or getattr(user, "papel", None) in (
        "DENTISTA_GERENTE",
        "ADMIN",
    )


def _dentista_do_usuario(user):
    """Dentista vinculado ao login (ou None)."""
    return getattr(user, "dentista", None)


def _conexao(dentista_id, nome):
    """Monta o estado da conexão de um alvo (clínica: dentista_id=None)."""
    cred = (
        CredencialGoogleCalendar.objects.filter(dentista_id=dentista_id, ativo=True)
        .order_by("-atualizado_em")
        .first()
    )
    return {
        "dentista": dentista_id,
        "dentista_nome": nome,
        "conectado": bool(cred and cred.refresh_token),
        "calendar_id": cred.calendar_id if cred else "primary",
        "token_expiry": cred.token_expiry if cred else None,
        "atualizado_em": cred.atualizado_em if cred else None,
    }


class ConexoesGoogleView(APIView):
    """Status das conexões Google (clínica + cada dentista)."""

    @extend_schema(responses=ConexaoGoogleSerializer(many=True))
    def get(self, request):
        if _eh_gestor(request.user):
            linhas = [_conexao(None, "Clínica (geral)")]
            for dentista in Dentista.objects.filter(ativo=True).order_by("nome_completo"):
                linhas.append(_conexao(dentista.id, dentista.nome_completo))
        else:
            # Dentista: só a SUA integração.
            dentista = _dentista_do_usuario(request.user)
            if dentista is None:
                raise PermissionDenied("Sem integração disponível para este usuário.")
            linhas = [_conexao(dentista.id, dentista.nome_completo)]
        return Response(ConexaoGoogleSerializer(linhas, many=True).data)


class SincronizarGoogleView(APIView):
    """Força a reconciliação com o Google agora (por ID): cria/atualiza/remove.

    Gestor: reconcilia toda a clínica (inclui a regra de não-confirmada). Dentista:
    reconcilia só a SUA agenda (sem cancelar consultas de nível clínica).
    """

    @extend_schema(exclude=True)
    def post(self, request):
        from apps.integracoes.google_calendar import reconciliar_google

        if _eh_gestor(request.user):
            resumo = reconciliar_google()
        else:
            dentista = _dentista_do_usuario(request.user)
            if dentista is None:
                raise PermissionDenied("Sem integração disponível para este usuário.")
            credenciais = CredencialGoogleCalendar.objects.filter(
                dentista=dentista, ativo=True
            )
            resumo = reconciliar_google(
                credenciais=credenciais, aplicar_cancelamento=False
            )
        return Response(resumo)


class SincronizacaoConfigView(APIView):
    """Config + informativo da sincronização periódica (última/próxima, intervalo)."""

    def _payload(self, cfg):
        return {
            "intervalo_minutos": cfg.intervalo_minutos,
            "ultima_sincronizacao": cfg.ultima_sincronizacao,
            "proxima_sincronizacao": cfg.proxima_sincronizacao,
        }

    @extend_schema(exclude=True)
    def get(self, request):
        cfg = ConfiguracaoSincronizacao.objects.first() or ConfiguracaoSincronizacao()
        return Response(self._payload(cfg))

    @extend_schema(exclude=True)
    def patch(self, request):
        if not _eh_gestor(request.user):
            raise PermissionDenied("Apenas gestor/admin ajusta a sincronização.")
        cfg, _ = ConfiguracaoSincronizacao.objects.get_or_create()
        if "intervalo_minutos" in request.data:
            valor = int(request.data["intervalo_minutos"])
            if valor <= 0:
                return Response({"detail": "intervalo_minutos deve ser positivo."}, status=400)
            cfg.intervalo_minutos = valor
        cfg.save()
        return Response(self._payload(cfg))


class DesconectarGoogleView(APIView):
    """Remove a credencial de um alvo (body: `dentista` = id ou null p/ a clínica)."""

    @extend_schema(exclude=True)
    def post(self, request):
        dentista_id = request.data.get("dentista")
        # Dentista só desconecta a SUA integração; gestor desconecta qualquer uma.
        if not _eh_gestor(request.user):
            dentista = _dentista_do_usuario(request.user)
            if dentista is None or dentista_id != dentista.id:
                raise PermissionDenied("Você só desconecta a sua própria integração.")
        removidas, _ = CredencialGoogleCalendar.objects.filter(dentista_id=dentista_id).delete()
        return Response({"status": "desconectado", "removidas": removidas})


@csrf_exempt
def google_webhook(request):
    """
    Recebe as push notifications do Google Calendar (roda no schema do tenant,
    resolvido pelo domínio da requisição) e dispara a sincronização incremental.
    """
    estado = request.headers.get("X-Goog-Resource-State", "")
    channel_id = request.headers.get("X-Goog-Channel-ID", "")

    # "sync" é a notificação inicial de handshake; mudanças reais vêm como "exists".
    if estado and estado != "sync":
        from apps.integracoes.google_calendar import sincronizar_incremental

        credencial = CredencialGoogleCalendar.objects.filter(
            watch_channel_id=channel_id, ativo=True
        ).first()
        if credencial is not None:
            sincronizar_incremental(credencial)

    return HttpResponse(status=200)
