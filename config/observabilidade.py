"""Inicialização opcional do Sentry (observabilidade de erros)."""

import logging


def configurar_sentry(dsn):
    """
    Inicializa o Sentry se um DSN for fornecido e o `sentry-sdk` estiver instalado.

    Mantém o Sentry OPCIONAL: sem DSN, não faz nada; com DSN mas sem o pacote,
    apenas avisa. Retorna True se o Sentry foi efetivamente configurado.
    """
    if not dsn:
        return False
    try:
        import sentry_sdk
    except ImportError:
        logging.getLogger("config").warning(
            "SENTRY_DSN definido, mas o pacote sentry-sdk não está instalado; Sentry desativado."
        )
        return False

    # O sentry-sdk detecta e habilita a integração com Django automaticamente.
    sentry_sdk.init(dsn=dsn, traces_sample_rate=0.0, send_default_pii=False)
    return True
