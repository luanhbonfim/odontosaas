"""
Testes automatizados da Sprint V4:
- Engine do Database Studio (Backend)
- Exploração de Schemas e Dicionário de Tabelas/Colunas
- Execução de queries Read-Only com role `odonto_studio_ro`
- Bloqueio de mutações no modo RO a nível de permissão do PostgreSQL
- Execução DML no modo RW exclusiva para SuperAdmin com justificativa obrigatória
- Bloqueio de comandos proibidos (DROP DATABASE, etc.)
- Auditoria de 100% das execuções SQL
- Isolamento de host (retorno 404 em subdomínios de tenant)
"""

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework import status
from rest_framework.test import APIClient

from apps.dentistas.models import Dentista
from apps.plataforma.models import PlanoAssinatura
from apps.plataforma_admin.models import RegistroAuditoriaVendor
from apps.tenants.models import Clinica, Dominio

Usuario = get_user_model()


class _OperadorVendorSuperAdmin:
    is_authenticated = True
    is_active = True
    is_staff = True
    is_superuser = True
    email = "vendor_super@proclinica.cloud"
    pk = 1
    id = 1


class _OperadorVendorStaff:
    is_authenticated = True
    is_active = True
    is_staff = True
    is_superuser = False
    email = "vendor_staff@proclinica.cloud"
    pk = 2
    id = 2


def _garantir_tenant_publico():
    connection.set_schema_to_public()
    publico, _ = Clinica.objects.get_or_create(
        schema_name="public",
        defaults={"nome_fantasia": "Público", "razao_social": "Plataforma OdontoSaaS", "ativo": True},
    )
    Dominio.objects.get_or_create(
        domain="localhost",
        tenant=publico,
        defaults={"is_primary": True},
    )
    return publico


@pytest.fixture
def vendor_super_client(db):
    """Cliente autenticado como superusuário do vendor no host público."""
    _garantir_tenant_publico()
    operador = _OperadorVendorSuperAdmin()
    client = APIClient()
    client.force_authenticate(user=operador)
    client.operador = operador
    client.defaults["HTTP_HOST"] = "localhost"
    return client


@pytest.fixture
def vendor_staff_client(db):
    """Cliente autenticado como staff comum do vendor no host público."""
    _garantir_tenant_publico()
    operador = _OperadorVendorStaff()
    client = APIClient()
    client.force_authenticate(user=operador)
    client.operador = operador
    client.defaults["HTTP_HOST"] = "localhost"
    return client


@pytest.fixture
def tenant_v4(db):
    """Tenant provisionado para testes do Studio."""
    connection.set_schema_to_public()
    plano = PlanoAssinatura.objects.create(
        nome="Plano V4",
        preco_mensal=299.90,
        limite_dentistas=10,
        limite_usuarios=15,
    )
    schema = "v4_tenant_test"
    dominio = "v4test.localhost"

    clinica = Clinica(
        schema_name=schema,
        nome_fantasia="Clínica Studio V4",
        razao_social="Studio V4 LTDA",
        cnpj="44555666000199",
        plano_assinatura=plano,
        ativo=True,
        status_assinatura=Clinica.StatusAssinatura.ATIVA,
    )
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)

    with schema_context(schema):
        Usuario.objects.create_user(
            email="admin@v4test.com",
            password="SenhaAdminV4Test",
            papel=Usuario.Papel.ADMIN,
            is_staff=True,
        )
        Dentista.objects.create(
            nome_completo="Dr. Studio Original",
            cro="12345",
            ativo=True,
        )

    yield clinica

    connection.set_schema_to_public()
    if Clinica.objects.filter(schema_name=schema).exists():
        clinica.delete(force_drop=True)
    connection.set_schema_to_public()


# --------------------------------------------------------------------------
# 1. Exploração de Schemas e Tabelas
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_studio_schemas_e_tables(vendor_staff_client, tenant_v4):
    # 1. Listagem de Schemas
    resp_schemas = vendor_staff_client.get("/api/plataforma-admin/studio/schemas/")
    assert resp_schemas.status_code == status.HTTP_200_OK
    schemas = [s["schema_name"] for s in resp_schemas.data["schemas"]]
    assert "public" in schemas
    assert tenant_v4.schema_name in schemas

    # 2. Dicionário de Tabelas do Tenant
    resp_tables = vendor_staff_client.get(f"/api/plataforma-admin/studio/tables/?schema={tenant_v4.schema_name}")
    assert resp_tables.status_code == status.HTTP_200_OK
    assert resp_tables.data["schema"] == tenant_v4.schema_name
    tabelas = resp_tables.data["tabelas"]
    assert len(tabelas) > 0

    tabela_dentistas = next((t for t in tabelas if t["tabela"] == "dentistas_dentista"), None)
    assert tabela_dentistas is not None
    nomes_colunas = [c["nome"] for c in tabela_dentistas["colunas"]]
    assert "nome_completo" in nomes_colunas
    assert "cro" in nomes_colunas


# --------------------------------------------------------------------------
# 2. Execução de Query Read-Only (RO)
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_studio_executar_select_read_only(vendor_staff_client, tenant_v4):
    payload = {
        "schema": tenant_v4.schema_name,
        "sql": "SELECT nome_completo, cro FROM dentistas_dentista ORDER BY nome_completo;",
        "modo": "RO",
    }
    resp = vendor_staff_client.post("/api/plataforma-admin/studio/executar/", payload, format="json")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["modo"] == "RO"
    assert resp.data["colunas"] == ["nome_completo", "cro"]
    assert len(resp.data["linhas"]) == 1
    assert resp.data["linhas"][0] == ["Dr. Studio Original", "12345"]
    assert resp.data["execution_time_ms"] >= 0

    # Valida auditoria
    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.STUDIO_QUERY,
        schema_alvo=tenant_v4.schema_name,
        detalhes__modo="RO",
        detalhes__status="SUCESSO",
    ).exists()


# --------------------------------------------------------------------------
# 3. Bloqueio de Mutações no Modo RO a Nível de PostgreSQL
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_studio_read_only_bloqueia_mutacoes_no_banco(vendor_staff_client, tenant_v4):
    payload = {
        "schema": tenant_v4.schema_name,
        "sql": "INSERT INTO dentistas_dentista (criado_em, atualizado_em, ativo, nome_completo, cro) VALUES (now(), now(), true, 'Dr. Invasor', '99999');",
        "modo": "RO",
    }
    resp = vendor_staff_client.post("/api/plataforma-admin/studio/executar/", payload, format="json")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "permission denied" in str(resp.data).lower() or "insufficient privilege" in str(resp.data).lower()

    # Confirma que nada foi gravado
    with schema_context(tenant_v4.schema_name):
        assert not Dentista.objects.filter(cro="99999").exists()

    # Auditoria registrou a tentativa como ERRO
    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.STUDIO_QUERY,
        schema_alvo=tenant_v4.schema_name,
        detalhes__modo="RO",
        detalhes__status="ERRO",
    ).exists()


# --------------------------------------------------------------------------
# 4. Execução DML no Modo RW com SuperAdmin e Justificativa
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_studio_executar_dml_modo_rw_com_superuser_e_justificativa(vendor_super_client, tenant_v4):
    payload = {
        "schema": tenant_v4.schema_name,
        "sql": "UPDATE dentistas_dentista SET nome_completo = 'Dr. Alterado RW' WHERE cro = '12345';",
        "modo": "RW",
        "justificativa": "Correção emergencial de cadastro de dentista solicitado via ticket #1234",
    }
    resp = vendor_super_client.post("/api/plataforma-admin/studio/executar/", payload, format="json")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["modo"] == "RW"
    assert resp.data["linhas_afetadas"] == 1

    # Confirma alteração no banco
    with schema_context(tenant_v4.schema_name):
        dentista = Dentista.objects.get(cro="12345")
        assert dentista.nome_completo == "Dr. Alterado RW"

    # Auditoria gravou com justificativa
    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.STUDIO_QUERY,
        schema_alvo=tenant_v4.schema_name,
        detalhes__modo="RW",
        detalhes__justificativa="Correção emergencial de cadastro de dentista solicitado via ticket #1234",
    ).exists()


# --------------------------------------------------------------------------
# 5. Modo RW Bloqueado para Staff Comum
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_studio_modo_rw_bloqueado_para_staff_comum(vendor_staff_client, tenant_v4):
    payload = {
        "schema": tenant_v4.schema_name,
        "sql": "UPDATE dentistas_dentista SET nome_completo = 'Hacker' WHERE cro = '12345';",
        "modo": "RW",
        "justificativa": "Tentativa de escrita não autorizada",
    }
    resp = vendor_staff_client.post("/api/plataforma-admin/studio/executar/", payload, format="json")
    assert resp.status_code == status.HTTP_403_FORBIDDEN


# --------------------------------------------------------------------------
# 6. Modo RW Exige Justificativa Válida (>= 10 caracteres)
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_studio_modo_rw_exige_justificativa(vendor_super_client, tenant_v4):
    payload = {
        "schema": tenant_v4.schema_name,
        "sql": "UPDATE dentistas_dentista SET nome_completo = 'Dr. Teste' WHERE cro = '12345';",
        "modo": "RW",
        "justificativa": "curto",
    }
    resp = vendor_super_client.post("/api/plataforma-admin/studio/executar/", payload, format="json")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


# --------------------------------------------------------------------------
# 7. Bloqueio de Comandos Proibidos (Blacklist)
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_studio_bloqueia_comandos_proibidos(vendor_super_client, tenant_v4):
    payload = {
        "schema": tenant_v4.schema_name,
        "sql": "DROP DATABASE odonto;",
        "modo": "RW",
        "justificativa": "Tentativa de drop do database",
    }
    resp = vendor_super_client.post("/api/plataforma-admin/studio/executar/", payload, format="json")
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert "proibidas" in str(resp.data).lower()


# --------------------------------------------------------------------------
# 8. Isolamento de Host (404 em Subdomínio de Tenant)
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_studio_isolamento_host_404_em_tenant(tenant_v4):
    client = APIClient()
    client.defaults["HTTP_HOST"] = tenant_v4.domains.first().domain

    with schema_context(tenant_v4.schema_name):
        admin_user = Usuario.objects.get(email="admin@v4test.com")
    client.force_authenticate(user=admin_user)

    assert client.get("/api/plataforma-admin/studio/schemas/").status_code == status.HTTP_404_NOT_FOUND
    assert client.get(f"/api/plataforma-admin/studio/tables/?schema={tenant_v4.schema_name}").status_code == status.HTTP_404_NOT_FOUND
    assert client.post("/api/plataforma-admin/studio/executar/", {"schema": tenant_v4.schema_name, "sql": "SELECT 1;", "modo": "RO"}).status_code == status.HTTP_404_NOT_FOUND
