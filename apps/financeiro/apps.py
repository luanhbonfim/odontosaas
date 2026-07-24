from django.apps import AppConfig


class FinanceiroConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.financeiro"
    label = "financeiro"
    verbose_name = "Financeiro"

    def ready(self):
        from . import signals  # noqa: F401  (registra os signals)
