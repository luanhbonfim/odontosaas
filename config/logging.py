"""Formatação de logs estruturados (JSON) para observabilidade."""

import json
import logging


class JsonFormatter(logging.Formatter):
    """Formata cada registro de log como uma linha JSON."""

    def format(self, record):
        dados = {
            "nivel": record.levelname,
            "logger": record.name,
            "modulo": record.module,
            "mensagem": record.getMessage(),
        }
        if record.exc_info:
            dados["excecao"] = self.formatException(record.exc_info)
        return json.dumps(dados, ensure_ascii=False)
