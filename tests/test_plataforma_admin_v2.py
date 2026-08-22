"""
Testes automatizados da Sprint V2:
- CRUD de PlanoAssinatura via API e registro de auditoria
- Listagem, busca e detalhes de Clinica via API
- Action de Provisionamento completo de tenant com seeds
- Action de Bloqueio/Desbloqueio (alternar-status)
- Action de Reset de Senha do admin do tenant
- Action de Impersonate (geração de token de suporte com claims)
- Action de Expurgo com confirmação de schema e salvaguarda
- Testes de Isolamento de Host (requisições em subdomínio de tenant retornam 404)
"""

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.plataforma.models import PlanoAssinatura
from apps.plataforma_admin.models import RegistroAuditoriaVendor
from apps.tenants.models import Clinica, Dominio

Usuario = get_user_model()


class _OperadorVendor:
    is_authenticated = True
    is_active = True
    is_staff = True
    is_superuser = True
    email = "vendor_admin@proclinica.cloud"
    pk = 0
    id = 0


class _OperadorStaff:
    is_authenticated = True
    is_active = True
    is_staff = True
    is_superuser = False
    email = "suporte_l2@proclinica.cloud"
    pk = 0
    id = 0


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
def vendor_client(db):
    """Cliente autenticado como superusuário do vendor no host público."""
    _garantir_tenant_publico()
    operador = _OperadorVendor()
    client = APIClient()
    client.force_authenticate(user=operador)
    client.operador = operador
    client.defaults["HTTP_HOST"] = "localhost"
    return client


@pytest.fixture
def vendor_staff_client(db):
    """Cliente autenticado como staff (não superuser) do vendor no host público."""
    _garantir_tenant_publico()
    operador_staff = _OperadorStaff()
    client = APIClient()
    client.force_authenticate(user=operador_staff)
    client.operador = operador_staff
    client.defaults["HTTP_HOST"] = "localhost"
    return client


@pytest.fixture
def tenant_fixture(db):
    """Tenant de teste criado no banco com schema físico e domínio."""
    schema = "v2_tenant_test"
    dominio = "v2test.localhost"

    clinica = Clinica(
        schema_name=schema,
        nome_fantasia="Clínica Teste V2",
        razao_social="Teste V2 LTDA",
        cnpj="11222333000199",
        ativo=True,
        status_assinatura=Clinica.StatusAssinatura.ATIVA,
    )
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)

    with schema_context(schema):
        Usuario.objects.create_user(
            email="admin@v2test.com",
            password="SenhaAdminV2Test",
            papel=Usuario.Papel.ADMIN,
            is_staff=True,
        )

    yield clinica

    # Teardown
    connection.set_schema_to_public()
    if Clinica.objects.filter(schema_name=schema).exists():
        clinica.delete(force_drop=True)
    connection.set_schema_to_public()


# --------------------------------------------------------------------------
# 1. CRUD de Planos de Assinatura
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_crud_planos_vendor(vendor_client):
    # 1. Create
    payload = {
        "nome": "Plano Starter Vendor",
        "preco_mensal": "149.90",
        "preco_anual": "1490.00",
        "limite_dentistas": 3,
        "limite_usuarios": 5,
        "limite_pacientes_ativos": 500,
        "limite_armazenamento_mb": 1024,
        "modulo_financeiro_ativo": True,
        "modulo_estoque_ativo": False,
        "sync_google_ativo": True,
        "whatsapp_waha_ativo": True,
        "ativo": True,
    }
    resp_create = vendor_client.post("/api/plataforma-admin/planos/", payload, format="json")
    assert resp_create.status_code == status.HTTP_201_CREATED
    plano_id = resp_create.data["id"]

    # Verifica auditoria
    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.CRIAR_PLANO,
        detalhes__plano_id=plano_id,
    ).exists()

    # 2. List
    resp_list = vendor_client.get("/api/plataforma-admin/planos/")
    assert resp_list.status_code == status.HTTP_200_OK
    itens_planos = resp_list.data["results"] if isinstance(resp_list.data, dict) and "results" in resp_list.data else resp_list.data
    assert any(p["id"] == plano_id for p in itens_planos)

    # 3. Update
    resp_update = vendor_client.patch(
        f"/api/plataforma-admin/planos/{plano_id}/",
        {"preco_mensal": "169.90", "modulo_estoque_ativo": True},
        format="json",
    )
    assert resp_update.status_code == status.HTTP_200_OK
    assert resp_update.data["preco_mensal"] == "169.90"
    assert resp_update.data["modulo_estoque_ativo"] is True

    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.EDITAR_PLANO,
        detalhes__plano_id=plano_id,
    ).exists()

    # 4. Delete
    resp_del = vendor_client.delete(f"/api/plataforma-admin/planos/{plano_id}/")
    assert resp_del.status_code == status.HTTP_204_NO_CONTENT
    assert not PlanoAssinatura.objects.filter(id=plano_id).exists()

    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.DESATIVAR_PLANO,
        detalhes__plano_id=plano_id,
    ).exists()


# --------------------------------------------------------------------------
# 2. Listagem e Busca de Tenants
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_listagem_e_detalhes_tenants(vendor_client, tenant_fixture):
    # Lista tenants
    resp = vendor_client.get("/api/plataforma-admin/tenants/")
    assert resp.status_code == status.HTTP_200_OK
    itens = resp.data["results"] if isinstance(resp.data, dict) and "results" in resp.data else resp.data
    assert any(c["schema_name"] == tenant_fixture.schema_name for c in itens)
    # Schema public nunca deve ser listado
    assert not any(c["schema_name"] == "public" for c in itens)

    # Busca por nome fantasia
    resp_busca = vendor_client.get(f"/api/plataforma-admin/tenants/?search={tenant_fixture.nome_fantasia}")
    assert resp_busca.status_code == status.HTTP_200_OK
    itens_busca = resp_busca.data["results"] if isinstance(resp_busca.data, dict) and "results" in resp_busca.data else resp_busca.data
    assert len(itens_busca) >= 1
    assert itens_busca[0]["schema_name"] == tenant_fixture.schema_name

    # Detalhes
    resp_detalhe = vendor_client.get(f"/api/plataforma-admin/tenants/{tenant_fixture.id}/")
    assert resp_detalhe.status_code == status.HTTP_200_OK
    assert resp_detalhe.data["schema_name"] == tenant_fixture.schema_name
    assert resp_detalhe.data["cnpj"] == tenant_fixture.cnpj


# --------------------------------------------------------------------------
# 3. Action de Provisionamento Completo
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_action_provisionamento_completo(vendor_client):
    plano = PlanoAssinatura.objects.create(
        nome="Plano Provisionamento",
        preco_mensal=199.90,
        limite_dentistas=5,
        limite_usuarios=10,
    )
    schema_novo = "clinica_prov_api"
    dominio_novo = "provapi.localhost"

    payload = {
        "schema_name": schema_novo,
        "nome_fantasia": "Clínica Provisionada API",
        "dominio": dominio_novo,
        "razao_social": "Prov API Odonto LTDA",
        "cnpj": "99888777000166",
        "plano_id": plano.id,
        "data_inicio_contrato": "2026-10-01",
        "admin_email": "admin@provapi.com",
        "admin_senha": "SenhaForteProv123!",
    }

    resp = vendor_client.post("/api/plataforma-admin/tenants/provisionar/", payload, format="json")
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.data["schema_name"] == schema_novo
    assert resp.data["vigencia_fim"] == "2026-10-31"

    try:
        # 1. Verifica schema físico criado e vigência configurada
        clinica_criada = Clinica.objects.get(schema_name=schema_novo)
        import datetime
        assert clinica_criada.vigencia_fim == datetime.date(2026, 10, 31)
        with connection.cursor() as cur:
            cur.execute("SELECT 1 FROM information_schema.schemata WHERE schema_name = %s", [schema_novo])
            assert cur.fetchone() is not None

        # 2. Verifica sementes no novo schema
        with schema_context(schema_novo):
            # Admin criado
            admin_user = Usuario.objects.filter(email="admin@provapi.com").first()
            assert admin_user is not None
            assert admin_user.papel == Usuario.Papel.ADMIN
            # Grupos semeados
            from django.contrib.auth.models import Group
            assert Group.objects.count() == 4
            # Especialidades semeadas
            from apps.dentistas.models import Especialidade
            assert Especialidade.objects.count() > 0

        # 3. Verifica auditoria
        assert RegistroAuditoriaVendor.objects.filter(
            acao=RegistroAuditoriaVendor.Acao.PROVISIONAR_CLINICA,
            schema_alvo=schema_novo,
        ).exists()

        # 4. Rejeita duplicação do mesmo schema
        resp_dup = vendor_client.post("/api/plataforma-admin/tenants/provisionar/", payload, format="json")
        assert resp_dup.status_code == status.HTTP_400_BAD_REQUEST

    finally:
        if Clinica.objects.filter(schema_name=schema_novo).exists():
            Clinica.objects.get(schema_name=schema_novo).delete(force_drop=True)


# --------------------------------------------------------------------------
# 4. Action de Bloqueio e Desbloqueio (Alternar Status)
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_action_alternar_status(vendor_client, tenant_fixture):
    # 1. Bloquear clínica (ativo=False e inadimplente)
    resp_bloq = vendor_client.post(
        f"/api/plataforma-admin/tenants/{tenant_fixture.id}/alternar-status/",
        {"ativo": False, "status_assinatura": Clinica.StatusAssinatura.INADIMPLENTE},
        format="json",
    )
    assert resp_bloq.status_code == status.HTTP_200_OK
    assert resp_bloq.data["ativo"] is False
    assert resp_bloq.data["status_assinatura"] == Clinica.StatusAssinatura.INADIMPLENTE

    tenant_fixture.refresh_from_db()
    assert tenant_fixture.ativo is False
    assert tenant_fixture.status_assinatura == Clinica.StatusAssinatura.INADIMPLENTE

    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.BLOQUEAR_CLINICA,
        schema_alvo=tenant_fixture.schema_name,
    ).exists()

    # 2. Desbloquear clínica (ativo=True e assinatura ativa)
    resp_desbloq = vendor_client.post(
        f"/api/plataforma-admin/tenants/{tenant_fixture.id}/alternar-status/",
        {"ativo": True, "status_assinatura": Clinica.StatusAssinatura.ATIVA},
        format="json",
    )
    assert resp_desbloq.status_code == status.HTTP_200_OK
    assert resp_desbloq.data["ativo"] is True

    tenant_fixture.refresh_from_db()
    assert tenant_fixture.ativo is True
    assert tenant_fixture.status_assinatura == Clinica.StatusAssinatura.ATIVA

    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.DESBLOQUEAR_CLINICA,
        schema_alvo=tenant_fixture.schema_name,
    ).exists()


# --------------------------------------------------------------------------
# 5. Action de Reset de Senha do Admin
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_action_reset_admin_senha(vendor_client, tenant_fixture):
    nova_senha = "NovaSenhaForteAdmin2026!"
    resp = vendor_client.post(
        f"/api/plataforma-admin/tenants/{tenant_fixture.id}/reset-admin-senha/",
        {"nova_senha": nova_senha},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    assert "redefinida com sucesso" in resp.data["mensagem"]

    # Valida login no schema com a nova senha
    from django.contrib.auth import authenticate
    with schema_context(tenant_fixture.schema_name):
        user = authenticate(username="admin@v2test.com", password=nova_senha)
        assert user is not None

    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.RESET_SENHA_ADMIN,
        schema_alvo=tenant_fixture.schema_name,
    ).exists()


# --------------------------------------------------------------------------
# 6. Action de Impersonate
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_action_impersonate(vendor_client, tenant_fixture):
    resp = vendor_client.post(
        f"/api/plataforma-admin/tenants/{tenant_fixture.id}/impersonate/",
        {"read_only": True},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    assert "access" in resp.data
    assert "refresh" in resp.data
    assert resp.data["usuario_impersonado"] == "admin@v2test.com"
    assert resp.data["read_only"] is True

    # Decodifica o access token e valida claims customizados
    token = AccessToken(resp.data["access"])
    assert token["is_impersonate"] is True
    assert token["impersonated_by"] == vendor_client.operador.email
    assert token["impersonate_read_only"] is True

    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.IMPERSONATE,
        schema_alvo=tenant_fixture.schema_name,
    ).exists()

    # Operador encerra o suporte diretamente pelo tenant — autenticado com o próprio
    # token de impersonate (fluxo real; a rota agora exige autenticação, não é anônima).
    tenant_client = APIClient()
    tenant_client.defaults["HTTP_HOST"] = tenant_fixture.domains.first().domain
    tenant_client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    resp_encerrar = tenant_client.post("/api/auth/encerrar-suporte/", format="json")
    assert resp_encerrar.status_code == status.HTTP_200_OK
    assert resp_encerrar.data["total_encerradas"] >= 1

    # Verifica que o registro de auditoria foi marcado como encerrado
    reg = RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.IMPERSONATE,
        schema_alvo=tenant_fixture.schema_name,
    ).latest("criado_em")
    assert reg.detalhes.get("encerrado_em") is not None
    assert reg.detalhes.get("ativo") is False


# --------------------------------------------------------------------------
# 7. Action de Expurgo com Salvaguarda
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_action_expurgo_com_salvaguarda(vendor_client, vendor_staff_client):
    # Cria uma clínica temporária para ser expurgada
    schema_exp = "clinica_a_expurgar"
    dom_exp = "expurgar.localhost"
    clinica_exp = Clinica(schema_name=schema_exp, nome_fantasia="A Expurgar")
    clinica_exp.save()
    Dominio.objects.create(domain=dom_exp, tenant=clinica_exp, is_primary=True)

    # 1. Staff comum não tem permissão para expurgar (exige SuperAdmin)
    resp_staff = vendor_staff_client.post(
        f"/api/plataforma-admin/tenants/{clinica_exp.id}/expurgar/",
        {"schema_name_confirmacao": schema_exp},
        format="json",
    )
    assert resp_staff.status_code == status.HTTP_403_FORBIDDEN

    # 2. SuperAdmin com confirmação incorreta -> Rejeitado
    resp_err = vendor_client.post(
        f"/api/plataforma-admin/tenants/{clinica_exp.id}/expurgar/",
        {"schema_name_confirmacao": "nome_errado"},
        format="json",
    )
    assert resp_err.status_code == status.HTTP_400_BAD_REQUEST

    # 3. SuperAdmin com confirmação correta -> Expurgado
    resp_ok = vendor_client.post(
        f"/api/plataforma-admin/tenants/{clinica_exp.id}/expurgar/",
        {"schema_name_confirmacao": schema_exp},
        format="json",
    )
    assert resp_ok.status_code == status.HTTP_200_OK

    # Schema físico e registro de banco removidos
    assert not Clinica.objects.filter(schema_name=schema_exp).exists()
    with connection.cursor() as cur:
        cur.execute("SELECT 1 FROM information_schema.schemata WHERE schema_name = %s", [schema_exp])
        assert cur.fetchone() is None

    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.EXPURGAR_CLINICA,
        schema_alvo=schema_exp,
    ).exists()


# --------------------------------------------------------------------------
# 8. TESTE CRÍTICO DE ISOLAMENTO DE HOST (Recomendação DevOps)
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_isolamento_host_endpoints_vendor_retornam_404_em_subdominio_tenant(tenant_fixture):
    """
    Garante que qualquer requisição aos endpoints /api/plataforma-admin/* feita
    a partir de um subdomínio de tenant resulta em HTTP 404 Not Found estrito.
    """
    client = APIClient()
    # Simula requisição vinda do subdomínio da clínica de teste
    client.defaults["HTTP_HOST"] = tenant_fixture.domains.first().domain

    # Mesmo com usuário autenticado da clínica
    with schema_context(tenant_fixture.schema_name):
        admin_tenant = Usuario.objects.get(email="admin@v2test.com")
    client.force_authenticate(user=admin_tenant)

    # 1. Planos
    resp_planos = client.get("/api/plataforma-admin/planos/")
    assert resp_planos.status_code == status.HTTP_404_NOT_FOUND

    # 2. Tenants
    resp_tenants = client.get("/api/plataforma-admin/tenants/")
    assert resp_tenants.status_code == status.HTTP_404_NOT_FOUND

    # 3. Provisionamento
    resp_prov = client.post("/api/plataforma-admin/tenants/provisionar/", {}, format="json")
    assert resp_prov.status_code == status.HTTP_404_NOT_FOUND


# --------------------------------------------------------------------------
# 9. Testes Específicos de Bloqueadores DevOps (Expurgo c/ Backup, Read-Only e Payload)
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_expurgo_gera_backup_real_com_hash(vendor_client):
    """Garante que o expurgo gera arquivo de backup físico com SHA-256 e registra na auditoria."""
    schema_dump = "clinica_com_dump"
    dom_dump = "dump.localhost"
    clinica_dump = Clinica(schema_name=schema_dump, nome_fantasia="Clínica Backup Dump")
    clinica_dump.save()
    Dominio.objects.create(domain=dom_dump, tenant=clinica_dump, is_primary=True)

    resp = vendor_client.post(
        f"/api/plataforma-admin/tenants/{clinica_dump.id}/expurgar/",
        {"schema_name_confirmacao": schema_dump},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK

    # Verifica se os detalhes da auditoria contêm informações do backup
    audit = RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.EXPURGAR_CLINICA,
        schema_alvo=schema_dump,
    ).first()
    assert audit is not None
    assert "backup" in audit.detalhes
    backup_info = audit.detalhes["backup"]
    assert "arquivo" in backup_info
    assert "sha256" in backup_info
    assert len(backup_info["sha256"]) == 64
    assert backup_info["tamanho_bytes"] >= 0


@pytest.mark.django_db(transaction=True)
def test_impersonate_read_only_bloqueia_mutacoes(vendor_client, tenant_fixture):
    """Garante que o middleware bloqueia POST/PUT/PATCH/DELETE quando impersonate_read_only=True."""
    # Gera token de impersonate read-only
    resp_imp = vendor_client.post(
        f"/api/plataforma-admin/tenants/{tenant_fixture.id}/impersonate/",
        {"read_only": True},
        format="json",
    )
    assert resp_imp.status_code == status.HTTP_200_OK
    token_access = resp_imp.data["access"]

    # Cria cliente simulando a SPA no subdomínio do tenant
    client_spa = APIClient()
    client_spa.defaults["HTTP_HOST"] = tenant_fixture.domains.first().domain
    client_spa.credentials(HTTP_AUTHORIZATION=f"Bearer {token_access}")

    # GET é permitido
    resp_get = client_spa.get("/api/pacientes/")
    # Pode ser 200 (se existir) ou 200 list vazia
    assert resp_get.status_code != status.HTTP_403_FORBIDDEN

    # POST deve ser BLOQUEADO pelo ImpersonateReadOnlyMiddleware com 403 para mutações comuns
    resp_post = client_spa.post("/api/pacientes/", {"nome": "Paciente Inválido"}, format="json")
    assert resp_post.status_code == status.HTTP_403_FORBIDDEN
    data = resp_post.json()
    assert "modo somente-leitura" in data["erro"].lower()

    # POST /api/auth/encerrar-suporte/ DEVE ser PERMITIDO mesmo em modo read-only
    resp_encerrar = client_spa.post("/api/auth/encerrar-suporte/", {}, format="json")
    assert resp_encerrar.status_code == status.HTTP_200_OK
    assert resp_encerrar.data["total_encerradas"] >= 1


@pytest.mark.django_db(transaction=True)
def test_alternar_status_payload_vazio_rejeitado(vendor_client, tenant_fixture):
    """Garante que payload sem 'ativo' e sem 'status_assinatura' é rejeitado com 400."""
    resp = vendor_client.post(
        f"/api/plataforma-admin/tenants/{tenant_fixture.id}/alternar-status/",
        {},
        format="json",
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db(transaction=True)
@pytest.mark.no_auto_auth
def test_bloqueio_login_tenant_no_host_publico(tenant_fixture):
    """Garante que POST /api/auth/token/ no host público é bloqueado com 401."""
    from django.core.cache import cache
    cache.clear()
    _garantir_tenant_publico()
    client = APIClient()
    resp = client.post(
        "/api/auth/token/",
        {"email": "admin@v2test.com", "password": "SenhaAdminV2Test"},
        format="json",
        HTTP_HOST="localhost",
    )
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert "exclusivo do seu consultório" in str(resp.json())


@pytest.mark.django_db(transaction=True)
@pytest.mark.no_auto_auth
def test_vendor_login_view_sucesso_no_host_publico(tenant_fixture):
    """POST /api/plataforma-admin/auth/login/ autentica APENAS operadores da plataforma
    (is_superuser). O admin da clínica (is_staff, sem superuser) NÃO é operador e deve
    ser rejeitado — caso contrário, o admin de uma clínica assumiria o painel do vendor
    (escalonamento cross-tenant)."""
    from django.core.cache import cache

    cache.clear()
    _garantir_tenant_publico()

    # Cria um operador legítimo (superuser) no schema da clínica de teste.
    with schema_context(tenant_fixture.schema_name):
        Usuario.objects.create_user(
            email="operador@proclinica.cloud",
            password="SenhaOperadorV2Test",
            nome_completo="Operador Master",
            papel=Usuario.Papel.ADMIN,
            is_staff=True,
            is_superuser=True,
        )

    client = APIClient()

    # Operador (superuser) -> 200 com tokens
    resp_ok = client.post(
        "/api/plataforma-admin/auth/login/",
        {"email": "operador@proclinica.cloud", "password": "SenhaOperadorV2Test"},
        format="json",
        HTTP_HOST="localhost",
    )
    assert resp_ok.status_code == status.HTTP_200_OK, resp_ok.content
    dados = resp_ok.json()
    assert "access" in dados
    assert "refresh" in dados

    # Admin da clínica (is_staff, sem superuser) -> 401 (não é operador do vendor)
    cache.clear()
    resp_bloqueado = client.post(
        "/api/plataforma-admin/auth/login/",
        {"email": "admin@v2test.com", "password": "SenhaAdminV2Test"},
        format="json",
        HTTP_HOST="localhost",
    )
    assert resp_bloqueado.status_code == status.HTTP_401_UNAUTHORIZED, resp_bloqueado.content





@pytest.mark.django_db(transaction=True)
def test_action_renovar_reativa_e_estende_vigencia(vendor_client, tenant_fixture):
    """A action /renovar/ estende a vigência (pela periodicidade do plano) e reativa a clínica vencida."""
    import datetime

    from django.utils import timezone

    # Deixa a clínica vencida/bloqueada.
    tenant_fixture.vigencia_fim = timezone.localdate() - datetime.timedelta(days=5)
    tenant_fixture.status_assinatura = Clinica.StatusAssinatura.INADIMPLENTE
    tenant_fixture.ativo = False
    tenant_fixture.save()

    resp = vendor_client.post(
        f"/api/plataforma-admin/tenants/{tenant_fixture.id}/renovar/", {}, format="json"
    )
    assert resp.status_code == status.HTTP_200_OK, resp.content

    tenant_fixture.refresh_from_db()
    assert tenant_fixture.ativo is True
    assert tenant_fixture.status_assinatura == Clinica.StatusAssinatura.ATIVA
    assert tenant_fixture.vigencia_fim is not None
    assert tenant_fixture.vigencia_fim > timezone.localdate()

    assert RegistroAuditoriaVendor.objects.filter(
        schema_alvo=tenant_fixture.schema_name,
        acao=RegistroAuditoriaVendor.Acao.PARAMETRIZACAO,
        detalhes__acao="renovacao_assinatura",
    ).exists()


@pytest.mark.django_db(transaction=True)
def test_trocar_plano_modo_manter_nao_altera_vigencia(vendor_client, tenant_fixture):
    """modo 'manter': troca o plano, mas o vencimento fica inalterado."""
    import datetime

    from django.utils import timezone

    venc = timezone.localdate() + datetime.timedelta(days=10)
    tenant_fixture.vigencia_fim = venc
    tenant_fixture.save()
    novo = PlanoAssinatura.objects.create(nome="Novo Mensal", preco_mensal=99.0, periodicidade="MENSAL")

    resp = vendor_client.post(
        f"/api/plataforma-admin/tenants/{tenant_fixture.id}/trocar-plano/",
        {"plano_id": novo.id, "vigencia_modo": "manter"},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK, resp.content
    tenant_fixture.refresh_from_db()
    assert tenant_fixture.plano_assinatura_id == novo.id
    assert tenant_fixture.vigencia_fim == venc  # inalterado


@pytest.mark.django_db(transaction=True)
def test_trocar_plano_modo_agora_recalcula_vigencia(vendor_client, tenant_fixture):
    """modo 'agora': vencimento recalculado a partir de hoje pela periodicidade do novo plano."""
    import datetime

    from django.utils import timezone

    tenant_fixture.vigencia_fim = timezone.localdate() - datetime.timedelta(days=5)
    tenant_fixture.ativo = False
    tenant_fixture.save()
    anual = PlanoAssinatura.objects.create(nome="Novo Anual", preco_mensal=990.0, periodicidade="ANUAL")

    resp = vendor_client.post(
        f"/api/plataforma-admin/tenants/{tenant_fixture.id}/trocar-plano/",
        {"plano_id": anual.id, "vigencia_modo": "agora"},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK, resp.content
    tenant_fixture.refresh_from_db()
    hoje = timezone.localdate()
    assert tenant_fixture.plano_assinatura_id == anual.id
    assert tenant_fixture.ativo is True
    assert tenant_fixture.status_assinatura == Clinica.StatusAssinatura.ATIVA
    # ~365 dias à frente (janela por causa de execução/fuso).
    assert tenant_fixture.vigencia_fim >= hoje + datetime.timedelta(days=360)


@pytest.mark.django_db(transaction=True)
def test_trocar_plano_plano_inexistente_400(vendor_client, tenant_fixture):
    resp = vendor_client.post(
        f"/api/plataforma-admin/tenants/{tenant_fixture.id}/trocar-plano/",
        {"plano_id": 999999, "vigencia_modo": "manter"},
        format="json",
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
