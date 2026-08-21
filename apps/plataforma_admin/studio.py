"""
Engine do Database Studio da plataforma (Vendor Admin).

Segurança e Isolamento:
- Modo Read-Only (RO): Executa sob o role PostgreSQL `odonto_studio_ro` com `GRANT SELECT` estrito.
- Modo Read-Write (RW): Exclusivo para SuperAdmin com justificativa obrigatória e timeout de 15s.
- Isolamento de Search Path: `SET search_path TO <schema>;` (SEM `public`).
- Trilha de Auditoria: Todas as queries gravam `RegistroAuditoriaVendor` com timing e linhas afetadas.
"""

import logging
import os
import re
import secrets
import time
from typing import Any

import psycopg
from django.conf import settings
from django.db import connection

from apps.plataforma_admin.models import RegistroAuditoriaVendor
from apps.plataforma_admin.services import registrar_auditoria_vendor

logger = logging.getLogger(__name__)

# Comandos de alto risco proibidos no Studio (inclusive em RW)
COMANDOS_PROIBIDOS_REGEX = re.compile(
    r"("
    r"\b(?:DROP\s+DATABASE|DROP\s+SCHEMA|DROP\s+TABLE|CREATE\s+DATABASE|ALTER\s+SYSTEM|"
    r"REINDEX\s+DATABASE|COPY\s+.*|CREATE\s+ROLE|"
    r"ALTER\s+ROLE|DROP\s+ROLE|ALTER\s+DATABASE|CREATE\s+EXTENSION|"
    r"ALTER\s+EXTENSION|DROP\s+EXTENSION|SET\s+SESSION\s+AUTHORIZATION|SET\s+ROLE|"
    r"SET\s+SEARCH_PATH|RESET\s+SEARCH_PATH|TRUNCATE|ALTER\s+TABLE|GRANT|REVOKE|"
    r"DO\s+LANGUAGE|CREATE\s+FUNCTION|CREATE\s+OR\s+REPLACE\s+FUNCTION|"
    r"CREATE\s+PROCEDURE|ALTER\s+PROCEDURE|DROP\s+PROCEDURE|CREATE\s+TRIGGER|DROP\s+TRIGGER|"
    r"pg_terminate_backend|pg_cancel_backend|pg_read_file|pg_read_binary_file|"
    r"pg_write_file|pg_ls_dir|pg_reload_conf|pg_rotate_logfile|ALTER\s+USER|ALTER\s+GROUP)\b|"
    r"\bDO\s*(?:\$\$|LANGUAGE)"
    r")",
    re.IGNORECASE,
)

STUDIO_RO_USER = "odonto_studio_ro"


def _remover_comentarios_sql(sql: str) -> str:
    """
    Substitui comentários SQL (`/* ... */` e `-- ...`) por espaço.

    Sem isso, a blacklist baseada em `\\s+` seria contornada por comentários
    intercalados, ex.: ``DROP/**/TABLE x`` ou ``COPY/**/(...)TO/**/PROGRAM 'cmd'``.
    A análise da blacklist e da contagem de instruções passa a rodar sobre o texto
    sem comentários (a execução mantém o SQL original, pois comentários são inertes).
    """
    sem_bloco = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    return re.sub(r"--[^\n]*", " ", sem_bloco)


def _obter_studio_ro_password() -> str:
    """
    Obtém a senha do role odonto_studio_ro a partir do settings/env.
    Em produção, a variável é obrigatória. Em desenvolvimento/testes,
    se ausente, gera dinamicamente uma senha forte por sessão.
    """
    pwd = getattr(settings, "STUDIO_RO_PASSWORD", None) or os.environ.get("STUDIO_RO_PASSWORD")
    if not pwd:
        # A senha é obrigatória em produção. O gate usa o módulo de settings de prod
        # (`config.settings.prod`) e NÃO `DEBUG`: o pytest-django força `DEBUG=False`
        # nos testes, o que faria a suíte exigir a senha. Também não depende mais de uma
        # variável `ENVIRONMENT` inexistente (que deixava o Studio rodar com senha
        # efêmera em produção sem nunca levantar erro).
        if "prod" in str(getattr(settings, "SETTINGS_MODULE", "")):
            raise RuntimeError(
                "A variável de ambiente 'STUDIO_RO_PASSWORD' é obrigatória em produção para o Database Studio."
            )
        # Gera senha efêmera forte para dev/testes se não fornecida
        if not hasattr(_obter_studio_ro_password, "_ephemeral_pwd"):
            _obter_studio_ro_password._ephemeral_pwd = secrets.token_urlsafe(32)
        pwd = _obter_studio_ro_password._ephemeral_pwd
    return pwd


def garantir_role_studio_ro(schema_alvo: str | None = None) -> None:
    """
    Garante a existência do role `odonto_studio_ro` no PostgreSQL e
    concede privilégios exclusivos de leitura (USAGE + SELECT).
    """
    ro_password = _obter_studio_ro_password()
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", [STUDIO_RO_USER])
        if not cursor.fetchone():
            cursor.execute(
                f'CREATE ROLE "{STUDIO_RO_USER}" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %s;',
                [ro_password],
            )
        else:
            # Atualiza senha e reforça restrição de privilégios
            cursor.execute(
                f'ALTER ROLE "{STUDIO_RO_USER}" WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %s;',
                [ro_password],
            )

        # Garante privilégio de leitura no schema alvo se informado
        if schema_alvo and re.match(r"^[a-zA-Z0-9_]+$", schema_alvo):
            cursor.execute(f'GRANT USAGE ON SCHEMA "{schema_alvo}" TO "{STUDIO_RO_USER}";')
            cursor.execute(f'GRANT SELECT ON ALL TABLES IN SCHEMA "{schema_alvo}" TO "{STUDIO_RO_USER}";')
            cursor.execute(
                f'ALTER DEFAULT PRIVILEGES IN SCHEMA "{schema_alvo}" GRANT SELECT ON TABLES TO "{STUDIO_RO_USER}";'
            )


def explorar_schemas() -> list[dict[str, Any]]:
    """Lista todos os schemas do banco com contagem de tabelas."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT s.schema_name,
                   COUNT(t.table_name) AS total_tabelas
            FROM information_schema.schemata s
            LEFT JOIN information_schema.tables t
              ON s.schema_name = t.table_schema
              AND t.table_type = 'BASE TABLE'
            WHERE s.schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
              AND s.schema_name NOT LIKE 'pg_temp_%'
              AND s.schema_name NOT LIKE 'pg_toast_temp_%'
            GROUP BY s.schema_name
            ORDER BY s.schema_name;
            """
        )
        colunas = [col[0] for col in cursor.description]
        return [dict(zip(colunas, row, strict=False)) for row in cursor.fetchall()]


def explorar_tabelas(schema_name: str) -> list[dict[str, Any]]:
    """Retorna o dicionário de dados detalhado (tabelas, colunas, tipos e PKs) do schema."""
    if not re.match(r"^[a-zA-Z0-9_]+$", schema_name):
        raise ValueError("Nome de schema inválido.")

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT t.table_name,
                   c.column_name,
                   c.data_type,
                   c.is_nullable,
                   c.column_default,
                   CASE WHEN pk.column_name IS NOT NULL THEN TRUE ELSE FALSE END AS is_primary_key
            FROM information_schema.tables t
            JOIN information_schema.columns c
              ON t.table_schema = c.table_schema AND t.table_name = c.table_name
            LEFT JOIN (
                SELECT kcu.table_schema, kcu.table_name, kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
            ) pk
              ON c.table_schema = pk.table_schema
              AND c.table_name = pk.table_name
              AND c.column_name = pk.column_name
            WHERE t.table_schema = %s
              AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_name, c.ordinal_position;
            """,
            [schema_name],
        )
        linhas = cursor.fetchall()

    tabelas_dict: dict[str, dict[str, Any]] = {}
    for table_name, col_name, data_type, is_null, col_default, is_pk in linhas:
        if table_name not in tabelas_dict:
            tabelas_dict[table_name] = {
                "tabela": table_name,
                "colunas": [],
            }
        tabelas_dict[table_name]["colunas"].append(
            {
                "nome": col_name,
                "tipo": data_type,
                "nullable": is_null == "YES",
                "default": col_default,
                "is_pk": is_pk,
            }
        )

    return list(tabelas_dict.values())


def executar_sql_studio(
    schema_name: str,
    sql: str,
    modo: str = "RO",
    operador_email: str = "operador",
    justificativa: str = "",
    request=None,
    limite_linhas: int = 100,
) -> dict[str, Any]:
    """
    Executa query SQL no Database Studio com isolamento estrito de schema e auditoria.
    """
    schema_clean = schema_name.strip().lower()
    sql_clean = sql.strip()

    if not re.match(r"^[a-zA-Z0-9_]+$", schema_clean):
        raise ValueError("Nome de schema inválido.")

    if not sql_clean:
        raise ValueError("Query SQL não pode ser vazia.")

    # 1. Análise de segurança sobre o SQL SEM comentários (evita bypass por `/**/`).
    sql_analise = _remover_comentarios_sql(sql_clean)

    # 1a. Rejeita múltiplas instruções (stacked statements). Um `;` final é tolerado;
    #     qualquer `;` interno indica mais de uma instrução — proibido no console.
    #     Antes de contar, neutraliza literais entre aspas simples ('...') para que um
    #     `;` DENTRO de uma string (ex.: SELECT 'a;b') não seja lido como separador.
    #     A blacklist (1b) continua rodando sobre o SQL completo, sem essa neutralização.
    sem_strings = re.sub(r"'(?:''|[^'])*'", "''", sql_analise)
    corpo = sem_strings.strip().rstrip(";").strip()
    if ";" in corpo:
        raise PermissionError(
            "Múltiplas instruções SQL não são permitidas no Studio (execute uma por vez)."
        )

    # 1b. Checagem de comandos proibidos (inclusive em RW), já sem comentários.
    if COMANDOS_PROIBIDOS_REGEX.search(sql_analise):
        raise PermissionError("O comando informado está na lista de operações proibidas da plataforma.")

    limite_efetivo = min(max(1, limite_linhas), 1000)

    db_conf = settings.DATABASES["default"]
    host = db_conf.get("HOST") or "localhost"
    port = int(db_conf.get("PORT") or 5432)
    db_name = db_conf.get("NAME") or "odonto"

    t0 = time.perf_counter()
    linhas_afetadas = 0
    total_retornado = 0
    colunas_resultado: list[str] = []
    linhas_resultado: list[list[Any]] = []
    truncado = False

    try:
        if modo == "RO":
            # Modo Read-Only: conecta com o role odonto_studio_ro
            garantir_role_studio_ro(schema_clean)

            # Conexão psycopg direta com o usuário read-only
            conn = psycopg.connect(
                host=host,
                port=port,
                dbname=db_name,
                user=STUDIO_RO_USER,
                password=_obter_studio_ro_password(),
                autocommit=True,
            )
            try:
                with conn.cursor() as cur:
                    cur.execute("SET statement_timeout TO 10000;")  # 10s
                    cur.execute(f'SET search_path TO "{schema_clean}";')  # SEM public

                    cur.execute(sql_clean)

                    if cur.description:
                        colunas_resultado = [desc[0] for desc in cur.description]
                        # Busca limite + 1 para detectar truncamento
                        registros = cur.fetchmany(limite_efetivo + 1)
                        if len(registros) > limite_efetivo:
                            truncado = True
                            registros = registros[:limite_efetivo]

                        # Serializa valores não-JSON em string (datetimes, UUIDs, Decimals)
                        linhas_resultado = [
                            [
                                str(val)
                                if val is not None and not isinstance(val, int | float | bool | str | list | dict)
                                else val
                                for val in row
                            ]
                            for row in registros
                        ]
                        total_retornado = len(linhas_resultado)
                    else:
                        linhas_afetadas = cur.rowcount
            finally:
                conn.close()

        elif modo == "RW":
            # Modo DML/Write: exige justificativa
            if not justificativa or len(justificativa.strip()) < 10:
                raise ValueError("Justificativa com no mínimo 10 caracteres é obrigatória para operações de escrita.")

            admin_user = db_conf.get("USER") or "odonto"
            admin_pass = db_conf.get("PASSWORD") or ""

            conn = psycopg.connect(
                host=host,
                port=port,
                dbname=db_name,
                user=admin_user,
                password=admin_pass,
                autocommit=False,  # Transação explícita
            )
            try:
                with conn.cursor() as cur:
                    cur.execute("SET statement_timeout TO 15000;")  # 15s
                    cur.execute(f'SET search_path TO "{schema_clean}";')  # SEM public

                    cur.execute(sql_clean)

                    if cur.description:
                        colunas_resultado = [desc[0] for desc in cur.description]
                        registros = cur.fetchmany(limite_efetivo + 1)
                        if len(registros) > limite_efetivo:
                            truncado = True
                            registros = registros[:limite_efetivo]

                        linhas_resultado = [
                            [
                                str(val)
                                if val is not None and not isinstance(val, int | float | bool | str | list | dict)
                                else val
                                for val in row
                            ]
                            for row in registros
                        ]
                        total_retornado = len(linhas_resultado)
                    else:
                        linhas_afetadas = cur.rowcount

                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()
        else:
            raise ValueError(f"Modo de execução inválido: '{modo}'. Use 'RO' ou 'RW'.")

    except Exception as exc:
        t1 = time.perf_counter()
        duracao_ms = round((t1 - t0) * 1000, 2)

        # Auditoria mesmo em caso de erro
        registrar_auditoria_vendor(
            request=request,
            acao=RegistroAuditoriaVendor.Acao.STUDIO_QUERY,
            schema_alvo=schema_clean,
            detalhes={
                "sql": sql_clean,
                "modo": modo,
                "status": "ERRO",
                "erro": str(exc),
                "duracao_ms": duracao_ms,
                "justificativa": justificativa,
            },
        )
        raise exc

    t1 = time.perf_counter()
    duracao_ms = round((t1 - t0) * 1000, 2)

    # Auditoria de sucesso
    registrar_auditoria_vendor(
        request=request,
        acao=RegistroAuditoriaVendor.Acao.STUDIO_QUERY,
        schema_alvo=schema_clean,
        detalhes={
            "sql": sql_clean,
            "modo": modo,
            "status": "SUCESSO",
            "linhas_afetadas": linhas_afetadas,
            "total_retornado": total_retornado,
            "duracao_ms": duracao_ms,
            "justificativa": justificativa,
        },
    )

    return {
        "schema": schema_clean,
        "modo": modo,
        "colunas": colunas_resultado,
        "linhas": linhas_resultado,
        "total_retornado": total_retornado,
        "linhas_afetadas": linhas_afetadas,
        "truncado": truncado,
        "execution_time_ms": duracao_ms,
    }
