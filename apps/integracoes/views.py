"""
Fluxo OAuth2 do Google Calendar (por clínica/dentista).

- google_authorize: monta a URL de consentimento e redireciona.
- google_callback: troca o `code` por tokens e salva em CredencialGoogleCalendar.

Roda no schema do tenant da requisição; a credencial é gravada no tenant.
"""

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect
from django.views.decorators.csrf import csrf_exempt
from google_auth_oauthlib.flow import Flow

from apps.dentistas.models import Dentista
from apps.integracoes.models import CredencialGoogleCalendar

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


def google_callback(request):
    """Recebe o code do Google, troca por tokens e salva a credencial."""
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
    return JsonResponse({"status": "conectado"})


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
