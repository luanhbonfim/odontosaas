"""
Roteamento de URLs raiz do OdontoSaaS.

A API REST é montada por um único DefaultRouter (evita registrar o conversor
de formato mais de uma vez). O endpoint /health/ é tratado pelo
`HealthCheckMiddleware` (antes da resolução de tenant).
"""

from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.agenda.views import AnamneseViewSet, ConsultaViewSet
from apps.dentistas.views import DentistaViewSet
from apps.estoque.views import (
    CategoriaInsumoViewSet,
    ConsumoInsumoViewSet,
    InsumoViewSet,
    MovimentacaoEstoqueViewSet,
)
from apps.integracoes.views import google_authorize, google_callback, google_webhook
from apps.notificacoes.views import (
    ConfiguracaoNotificacaoViewSet,
    TemplateMensagemViewSet,
    waha_webhook,
)
from apps.pacientes.views import (
    GuiaViewSet,
    PacienteViewSet,
    PlanoOdontologicoViewSet,
)

router = DefaultRouter()
router.register("dentistas", DentistaViewSet, basename="dentista")
router.register("pacientes", PacienteViewSet, basename="paciente")
router.register("planos", PlanoOdontologicoViewSet, basename="plano")
router.register("guias", GuiaViewSet, basename="guia")
router.register("consultas", ConsultaViewSet, basename="consulta")
router.register("anamneses", AnamneseViewSet, basename="anamnese")
router.register("config-notificacao", ConfiguracaoNotificacaoViewSet, basename="config-notificacao")
router.register("templates-mensagem", TemplateMensagemViewSet, basename="template-mensagem")
router.register("categorias-insumo", CategoriaInsumoViewSet, basename="categoria-insumo")
router.register("insumos", InsumoViewSet, basename="insumo")
router.register(
    "movimentacoes-estoque", MovimentacaoEstoqueViewSet, basename="movimentacao-estoque"
)
router.register("consumos-insumo", ConsumoInsumoViewSet, basename="consumo-insumo")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    # OAuth2 Google Calendar (fluxo de navegador; sem barra final p/ casar com o redirect_uri)
    path("integracoes/google/authorize", google_authorize, name="google_authorize"),
    path("integracoes/google/callback", google_callback, name="google_callback"),
    path("integracoes/google/webhook", google_webhook, name="google_webhook"),
    path("notificacoes/whatsapp/webhook", waha_webhook, name="waha_webhook"),
]
