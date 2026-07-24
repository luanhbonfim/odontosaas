"""Campos de model customizados (criptografia de dados sensíveis em repouso)."""

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models


def _fernet():
    key = settings.FIELD_ENCRYPTION_KEY
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)


class EncryptedTextField(models.TextField):
    """
    TextField que criptografa o valor em repouso (Fernet/AES).

    O valor fica em texto puro na memória da aplicação, mas é gravado
    criptografado no banco. Não use para campos que precisem de filtro/busca.
    """

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value in (None, ""):
            return value
        return _fernet().encrypt(value.encode()).decode()

    def from_db_value(self, value, expression, connection):
        if value in (None, ""):
            return value
        try:
            return _fernet().decrypt(value.encode()).decode()
        except InvalidToken:
            # Valor legado (gravado sem criptografia) — devolve como está.
            return value
