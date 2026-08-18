"""
Roteamento de URLs raiz do OdontoSaaS.

A API REST é montada por um único DefaultRouter (evita registrar o conversor
de formato mais de uma vez). O endpoint /health/ é tratado pelo
`HealthCheckMiddleware` (antes da resolução de tenant).
"""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
)

from apps.agenda.views import AnamneseViewSet, ConsultaViewSet
from apps.auditoria.views import RegistroAuditoriaViewSet
from apps.convenios.views import ConvenioViewSet
from apps.dentistas.views import DentistaViewSet, EspecialidadeViewSet
from apps.estoque.views import (
    CategoriaInsumoViewSet,
    ConsumoInsumoViewSet,
    InsumoViewSet,
    MovimentacaoEstoqueViewSet,
)
from apps.financeiro.views import FaturaViewSet, LancamentoFinanceiroViewSet
from apps.integracoes.views import (
    ConexoesGoogleView,
    DesconectarGoogleView,
    SincronizacaoConfigView,
    SincronizarGoogleView,
    google_authorize,
    google_callback,
    google_webhook,
)
from apps.notificacoes.views import (
    ConfiguracaoNotificacaoViewSet,
    ConfirmacaoPublicaView,
    LogNotificacaoViewSet,
    TemplateMensagemViewSet,
    waha_webhook,
)
from apps.pacientes.views import (
    GuiaViewSet,
    PacienteViewSet,
    PlanoOdontologicoViewSet,
)
from apps.procedimentos.views import ProcedimentoViewSet
from apps.usuarios.views import LoginView, MeView, UsuarioViewSet

router = DefaultRouter()
router.register("dentistas", DentistaViewSet, basename="dentista")
router.register("especialidades", EspecialidadeViewSet, basename="especialidade")
router.register("convenios", ConvenioViewSet, basename="convenio")
router.register("procedimentos", ProcedimentoViewSet, basename="procedimento")
router.register("pacientes", PacienteViewSet, basename="paciente")
router.register("planos", PlanoOdontologicoViewSet, basename="plano")
router.register("guias", GuiaViewSet, basename="guia")
router.register("consultas", ConsultaViewSet, basename="consulta")
router.register("anamneses", AnamneseViewSet, basename="anamnese")
router.register("config-notificacao", ConfiguracaoNotificacaoViewSet, basename="config-notificacao")
router.register("templates-mensagem", TemplateMensagemViewSet, basename="template-mensagem")
router.register("logs-notificacao", LogNotificacaoViewSet, basename="log-notificacao")
router.register("categorias-insumo", CategoriaInsumoViewSet, basename="categoria-insumo")
router.register("insumos", InsumoViewSet, basename="insumo")
router.register(
    "movimentacoes-estoque", MovimentacaoEstoqueViewSet, basename="movimentacao-estoque"
)
router.register("consumos-insumo", ConsumoInsumoViewSet, basename="consumo-insumo")
router.register("lancamentos", LancamentoFinanceiroViewSet, basename="lancamento")
router.register("faturas", FaturaViewSet, basename="fatura")
router.register("auditoria", RegistroAuditoriaViewSet, basename="auditoria")
router.register("usuarios", UsuarioViewSet, basename="usuario")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    # Autenticação JWT (login por e-mail → access/refresh)
    path("api/auth/token/", LoginView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    # Usuário logado (nome, papel, clínica) — base do contexto de sessão do frontend
    path("api/auth/me/", MeView.as_view(), name="auth_me"),
    # Confirmação pública por link (WhatsApp) — sem autenticação
    path(
        "api/confirmacao/<uuid:token>/",
        ConfirmacaoPublicaView.as_view(),
        name="confirmacao_publica",
    ),
    # Documentação de API (OpenAPI / Swagger UI / ReDoc)
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # API REST de integrações (tela de Integrações — Gerente/Admin)
    path("api/integracoes/google/conexoes/", ConexoesGoogleView.as_view(), name="google_conexoes"),
    path(
        "api/integracoes/google/sincronizar/",
        SincronizarGoogleView.as_view(),
        name="google_sincronizar",
    ),
    path(
        "api/integracoes/google/desconectar/",
        DesconectarGoogleView.as_view(),
        name="google_desconectar",
    ),
    path(
        "api/integracoes/google/sincronizacao/",
        SincronizacaoConfigView.as_view(),
        name="google_sincronizacao_config",
    ),
    # OAuth2 Google Calendar (fluxo de navegador; sem barra final p/ casar com o redirect_uri)
    path("integracoes/google/authorize", google_authorize, name="google_authorize"),
    path("integracoes/google/callback", google_callback, name="google_callback"),
    path("integracoes/google/webhook", google_webhook, name="google_webhook"),
    path("notificacoes/whatsapp/webhook", waha_webhook, name="waha_webhook"),
]
