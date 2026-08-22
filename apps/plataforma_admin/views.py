import logging

from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

from apps.core.throttling import ImpersonateThrottle, VendorLoginThrottle
from apps.plataforma.models import PlanoAssinatura
from apps.plataforma_admin.models import RegistroAuditoriaVendor
from apps.plataforma_admin.permissions import IsVendorHost, IsVendorStaff, IsVendorSuperAdmin
from apps.plataforma_admin.serializers import (
    AlternarStatusTenantInputSerializer,
    ClinicaDetailVendorSerializer,
    ClinicaListVendorSerializer,
    ExpurgarTenantInputSerializer,
    ImpersonateInputSerializer,
    PlanoAssinaturaVendorSerializer,
    ProvisionarClinicaInputSerializer,
    ResetAdminSenhaInputSerializer,
)
from apps.plataforma_admin.services import (
    executar_expurgo_com_backup,
    executar_provisionamento_clinica,
    gerar_token_impersonate,
    registrar_auditoria_vendor,
    resetar_senha_admin_tenant,
)
from django_tenants.utils import schema_context
from apps.tenants.models import Clinica


class PlanoAssinaturaVendorViewSet(viewsets.ModelViewSet):
    """
    CRUD completo de planos comerciais do SaaS.
    Acesso restrito aos operadores do SaaS (schema public).
    """

    queryset = PlanoAssinatura.objects.all().order_by("preco_mensal")
    serializer_class = PlanoAssinaturaVendorSerializer
    permission_classes = [IsVendorStaff]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nome"]
    ordering_fields = ["nome", "preco_mensal", "criado_em"]

    def get_permissions(self):
        # Leitura: qualquer operador (staff). Mutação de catálogo comercial: só SuperAdmin
        # (spec §2.2 — planos/precificação são atribuição do SUPERADMIN).
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsVendorSuperAdmin()]
        return [IsVendorStaff()]

    def perform_create(self, serializer):
        plano = serializer.save()
        registrar_auditoria_vendor(
            request=self.request,
            acao=RegistroAuditoriaVendor.Acao.CRIAR_PLANO,
            detalhes={"plano_id": plano.id, "nome": plano.nome, "preco": str(plano.preco_mensal)},
        )

    def perform_update(self, serializer):
        plano = serializer.save()
        registrar_auditoria_vendor(
            request=self.request,
            acao=RegistroAuditoriaVendor.Acao.EDITAR_PLANO,
            detalhes={"plano_id": plano.id, "nome": plano.nome, "preco": str(plano.preco_mensal)},
        )

    def perform_destroy(self, instance):
        detalhes = {"plano_id": instance.id, "nome": instance.nome}
        instance.delete()
        registrar_auditoria_vendor(
            request=self.request,
            acao=RegistroAuditoriaVendor.Acao.DESATIVAR_PLANO,
            detalhes=detalhes,
        )


class TenantVendorViewSet(viewsets.ModelViewSet):
    """
    Governança, listagem e ciclo de vida de tenants (clínicas).
    Acesso restrito aos operadores do SaaS (schema public).
    """

    queryset = (
        Clinica.objects.exclude(schema_name="public")
        .select_related("plano_assinatura")
        .prefetch_related("domains")
        .order_by("-criado_em")
    )
    permission_classes = [IsVendorStaff]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "nome_fantasia",
        "razao_social",
        "schema_name",
        "cnpj",
        "domains__domain",
    ]
    ordering_fields = ["nome_fantasia", "schema_name", "criado_em", "status_assinatura"]

    def get_serializer_class(self):
        if self.action == "list":
            return ClinicaListVendorSerializer
        return ClinicaDetailVendorSerializer

    def perform_update(self, serializer):
        instancia_antiga = self.get_object()
        valores_anteriores = {}
        valores_novos = {}
        for campo, novo_valor in serializer.validated_data.items():
            antigo_valor = getattr(instancia_antiga, campo, None)
            if antigo_valor != novo_valor:
                valores_anteriores[campo] = str(antigo_valor) if antigo_valor is not None else None
                valores_novos[campo] = str(novo_valor) if novo_valor is not None else None

        clinica = serializer.save()
        registrar_auditoria_vendor(
            request=self.request,
            acao=RegistroAuditoriaVendor.Acao.PARAMETRIZACAO,
            schema_alvo=clinica.schema_name,
            detalhes={
                "campos_alterados": list(serializer.validated_data.keys()),
                "valores_anteriores": valores_anteriores,
                "valores_novos": valores_novos,
                "status_assinatura": clinica.status_assinatura,
                "ativo": clinica.ativo,
            },
        )

    @action(detail=False, methods=["post"], url_path="provisionar")
    def provisionar(self, request):
        """Provisiona um novo tenant de forma atômica."""
        serializer = ProvisionarClinicaInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data

        try:
            clinica = executar_provisionamento_clinica(
                schema_name=dados["schema_name"],
                nome_fantasia=dados["nome_fantasia"],
                dominio=dados["dominio"],
                razao_social=dados.get("razao_social", ""),
                cnpj=dados.get("cnpj"),
                plano_id=dados.get("plano_id"),
                data_inicio_contrato=dados.get("data_inicio_contrato"),
                vigencia_fim=dados.get("vigencia_fim"),
                responsavel_nome=dados.get("responsavel_nome", ""),
                responsavel_cpf=dados.get("responsavel_cpf", ""),
                responsavel_telefone=dados.get("responsavel_telefone", ""),
                responsavel_email=dados.get("responsavel_email"),
                admin_email=dados.get("admin_email"),
                admin_senha=dados.get("admin_senha"),
                request=request,
            )
            return Response(
                ClinicaDetailVendorSerializer(clinica).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return Response(
                {"erro": "Falha no provisionamento.", "detalhes": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"], url_path="alternar_status")
    def alternar_status(self, request, pk=None):
        """Ativa, bloqueia ou altera o status de assinatura da clínica."""
        clinica = self.get_object()
        serializer = AlternarStatusTenantInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        antigo_ativo = clinica.ativo
        antigo_status = clinica.status_assinatura

        campos_alterados = {}
        valores_anteriores = {}
        valores_novos = {}
        if "ativo" in serializer.validated_data:
            clinica.ativo = serializer.validated_data["ativo"]
            campos_alterados["ativo"] = clinica.ativo
            valores_anteriores["ativo"] = antigo_ativo
            valores_novos["ativo"] = clinica.ativo
        if "status_assinatura" in serializer.validated_data:
            clinica.status_assinatura = serializer.validated_data["status_assinatura"]
            campos_alterados["status_assinatura"] = clinica.status_assinatura
            valores_anteriores["status_assinatura"] = antigo_status
            valores_novos["status_assinatura"] = clinica.status_assinatura

        clinica.save(update_fields=list(campos_alterados.keys()) + ["atualizado_em"] if hasattr(clinica, "atualizado_em") else list(campos_alterados.keys()))

        acao = (
            RegistroAuditoriaVendor.Acao.DESBLOQUEAR_CLINICA
            if clinica.ativo and clinica.status_assinatura == Clinica.StatusAssinatura.ATIVA
            else RegistroAuditoriaVendor.Acao.BLOQUEAR_CLINICA
        )

        registrar_auditoria_vendor(
            request=request,
            acao=acao,
            schema_alvo=clinica.schema_name,
            detalhes={
                "justificativa": serializer.validated_data.get("justificativa", ""),
                "campos_alterados": list(campos_alterados.keys()),
                "valores_anteriores": valores_anteriores,
                "valores_novos": valores_novos,
            },
        )

        return Response(ClinicaDetailVendorSerializer(clinica).data)

    @action(detail=True, methods=["post"], url_path="alternar-status")
    def alternar_status_hifen(self, request, pk=None):
        """Alias para alternar_status (com hífen)."""
        return self.alternar_status(request, pk)

    @action(detail=True, methods=["post"], url_path="renovar")
    def renovar(self, request, pk=None):
        """Renova a vigência da clínica conforme a periodicidade do plano e a reativa.

        Estende a partir do MAIOR entre hoje e a vigência atual (se ainda no futuro),
        somando +30 dias (mensal), +365 (anual) ou tornando permanente (sem vencimento).
        Reativa a clínica (ativo=True, status=ATIVA)."""
        import datetime as _dt

        from django.utils import timezone

        clinica = self.get_object()
        plano = clinica.plano_assinatura
        vig_anterior = clinica.vigencia_fim
        hoje = timezone.localdate()

        Periodicidade = PlanoAssinatura.Periodicidade
        if plano is not None and plano.periodicidade == Periodicidade.PERMANENTE:
            nova_vigencia = None
        else:
            dias = 365 if (plano is not None and plano.periodicidade == Periodicidade.ANUAL) else 30
            base = (
                clinica.vigencia_fim
                if (isinstance(clinica.vigencia_fim, _dt.date) and clinica.vigencia_fim > hoje)
                else hoje
            )
            nova_vigencia = base + _dt.timedelta(days=dias)

        clinica.vigencia_fim = nova_vigencia
        clinica.status_assinatura = Clinica.StatusAssinatura.ATIVA
        clinica.ativo = True
        clinica.save(update_fields=["vigencia_fim", "status_assinatura", "ativo"])

        registrar_auditoria_vendor(
            request=request,
            acao=RegistroAuditoriaVendor.Acao.PARAMETRIZACAO,
            schema_alvo=clinica.schema_name,
            detalhes={
                "acao": "renovacao_assinatura",
                "vigencia_anterior": str(vig_anterior) if vig_anterior else None,
                "vigencia_nova": str(nova_vigencia) if nova_vigencia else "permanente",
                "periodicidade": plano.periodicidade if plano else None,
            },
        )
        return Response(ClinicaDetailVendorSerializer(clinica).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reset-admin-senha")
    def reset_admin_senha(self, request, pk=None):
        """Redefine forçadamente a senha do admin da clínica."""
        clinica = self.get_object()
        serializer = ResetAdminSenhaInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            admin_email = resetar_senha_admin_tenant(
                clinica=clinica,
                nova_senha=serializer.validated_data["nova_senha"],
                admin_email=serializer.validated_data.get("admin_email"),
                request=request,
            )
            return Response(
                {"mensagem": f"Senha do administrador '{admin_email}' redefinida com sucesso."},
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            return Response(
                {"erro": "Falha ao resetar senha do administrador.", "detalhes": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"], url_path="impersonate", throttle_classes=[ImpersonateThrottle])
    def impersonate(self, request, pk=None):
        """Emite token de suporte de curta duração para impersonation."""
        clinica = self.get_object()
        serializer = ImpersonateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        operador_email = getattr(request.user, "email", str(request.user))
        read_only = serializer.validated_data.get("read_only", True)
        justificativa = serializer.validated_data.get("justificativa", "")
        reacesso = serializer.validated_data.get("reacesso", False)

        try:
            dados_sessao = gerar_token_impersonate(
                operador_email=operador_email,
                clinica=clinica,
                read_only=read_only,
                justificativa=justificativa,
                reacesso=reacesso,
                request=request,
            )
            return Response(dados_sessao, status=status.HTTP_200_OK)
        except Exception as exc:
            return Response(
                {"erro": "Falha ao iniciar impersonate.", "detalhes": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(
        detail=True,
        methods=["post"],
        url_path="expurgar",
        permission_classes=[IsVendorSuperAdmin],
    )
    def expurgar(self, request, pk=None):
        """Exclusão física definitiva (drop schema) com confirmação estrita."""
        clinica = self.get_object()
        serializer = ExpurgarTenantInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        confirmacao = serializer.validated_data["schema_name_confirmacao"].strip().lower()
        if confirmacao != clinica.schema_name:
            return Response(
                {
                    "erro": "Confirmação inválida.",
                    "mensagem": f"O schema digitado '{confirmacao}' não confere com '{clinica.schema_name}'.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        schema_apagado = clinica.schema_name
        executar_expurgo_com_backup(clinica=clinica, request=request)

        return Response(
            {"mensagem": f"Clínica e schema '{schema_apagado}' expurgados com sucesso."},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get", "patch"], url_path="google")
    def google(self, request, pk=None):
        """Consulta e parametrização do Google Calendar para o tenant."""
        from django_tenants.utils import schema_context

        from apps.integracoes.models import (
            ConfiguracaoSincronizacao,
            CredencialGoogleCalendar,
        )
        from apps.plataforma_admin.serializers import GoogleParamsSerializer

        clinica = self.get_object()

        if request.method == "PATCH" and not clinica.recurso_habilitado("google_calendar"):
            return Response(
                {"erro": "Módulo Google Calendar não aplicável ou desabilitado para o plano desta clínica."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with schema_context(clinica.schema_name):
            config, _ = ConfiguracaoSincronizacao.objects.get_or_create(id=1)

            if request.method == "PATCH":
                serializer = GoogleParamsSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                if "intervalo_minutos" in serializer.validated_data:
                    antigo = config.intervalo_minutos
                    novo = serializer.validated_data["intervalo_minutos"]
                    config.intervalo_minutos = novo
                    config.save(update_fields=["intervalo_minutos", "atualizado_em"] if hasattr(config, "atualizado_em") else ["intervalo_minutos"])

                    registrar_auditoria_vendor(
                        request=request,
                        acao=RegistroAuditoriaVendor.Acao.PARAMETRIZACAO,
                        schema_alvo=clinica.schema_name,
                        detalhes={
                            "tipo": "google",
                            "campos_alterados": ["intervalo_minutos"],
                            "valores_anteriores": {"intervalo_minutos": f"{antigo} min"},
                            "valores_novos": {"intervalo_minutos": f"{novo} min"},
                        },
                    )

            # Lista credenciais
            credenciais = CredencialGoogleCalendar.objects.select_related("dentista").all()
            from django.utils import timezone
            now = timezone.now()

            cred_list = []
            for c in credenciais:
                calendar_id_display = c.calendar_id
                if (not calendar_id_display or calendar_id_display == "primary") and c.ativo and c.refresh_token:
                    try:
                        from apps.integracoes.google_calendar import build_service
                        srv = build_service(c)
                        events_info = srv.events().list(calendarId="primary", maxResults=1).execute()
                        sum_email = events_info.get("summary")
                        if sum_email and "@" in sum_email:
                            calendar_id_display = sum_email
                            c.calendar_id = sum_email
                            c.save(update_fields=["calendar_id"])
                    except Exception:
                        calendar_id_display = c.calendar_id or "primary"

                cred_list.append(
                    {
                        "id": c.id,
                        "dentista_id": c.dentista_id,
                        "dentista_nome": c.dentista.nome_completo if c.dentista else "Clínica (Geral)",
                        "calendar_id": calendar_id_display or "primary",
                        "token_valido": bool(c.ativo and (bool(c.refresh_token) or (c.token_expiry and c.token_expiry > now))),
                        "watch_ativo": bool(c.watch_expiration and c.watch_expiration > now),
                    }
                )

            return Response(
                {
                    "intervalo_minutos": config.intervalo_minutos,
                    "ultima_sincronizacao": config.ultima_sincronizacao,
                    "credenciais": cred_list,
                }
            )

    @action(detail=True, methods=["post"], url_path="google/reconciliar")
    def google_reconciliar(self, request, pk=None):
        """Força disparo manual de reconciliação do Google Calendar no tenant."""
        from apps.integracoes.tasks import reconciliar_google

        clinica = self.get_object()
        if not clinica.recurso_habilitado("google_calendar"):
            return Response(
                {"erro": "Módulo Google Calendar não aplicável ou desabilitado para o plano desta clínica."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reconciliar_google.delay(schema_name=clinica.schema_name)

        registrar_auditoria_vendor(
            request=request,
            acao=RegistroAuditoriaVendor.Acao.CELERY_TRIGGER,
            schema_alvo=clinica.schema_name,
            detalhes={"task": "reconciliar_google"},
        )

        return Response(
            {"mensagem": f"Reconciliação disparada com sucesso para '{clinica.nome_fantasia}'."},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get", "patch"], url_path="whatsapp")
    def whatsapp(self, request, pk=None):
        """Consulta e parametrização do WhatsApp / WAHA para o tenant."""
        from django_tenants.utils import schema_context

        from apps.notificacoes.models import ConfiguracaoNotificacao
        from apps.notificacoes.waha import status_sessao
        from apps.plataforma_admin.serializers import WhatsAppParamsSerializer

        clinica = self.get_object()
        if request.method == "PATCH" and not clinica.recurso_habilitado("whatsapp"):
            return Response(
                {"erro": "Módulo WhatsApp não aplicável ou desabilitado para o plano desta clínica."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sessao_waha = clinica.schema_name

        with schema_context(clinica.schema_name):
            config, _ = ConfiguracaoNotificacao.objects.get_or_create(id=1)

            if request.method == "PATCH":
                serializer = WhatsAppParamsSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                campos = serializer.validated_data

                if campos:
                    valores_anteriores = {}
                    valores_novos = {}
                    for campo, valor in campos.items():
                        antigo_valor = getattr(config, campo, None)
                        if antigo_valor != valor:
                            valores_anteriores[campo] = f"{antigo_valor} min" if "minutos" in campo else str(antigo_valor)
                            valores_novos[campo] = f"{valor} min" if "minutos" in campo else str(valor)
                        setattr(config, campo, valor)

                    config.save()
                    registrar_auditoria_vendor(
                        request=request,
                        acao=RegistroAuditoriaVendor.Acao.PARAMETRIZACAO,
                        schema_alvo=clinica.schema_name,
                        detalhes={
                            "tipo": "whatsapp",
                            "campos_alterados": list(campos.keys()),
                            "valores_anteriores": valores_anteriores,
                            "valores_novos": valores_novos,
                        },
                    )

            # Consulta status real da sessão no WAHA
            status_atual = "UNKNOWN"
            numero_detectado = None
            try:
                dados_sessao = status_sessao(sessao_waha)
                if dados_sessao:
                    status_atual = dados_sessao.get("status", "UNKNOWN")
                    me = dados_sessao.get("me") or {}
                    numero_detectado = me.get("id") or me.get("user")
            except Exception:
                status_atual = "ERROR"

            numero_final = numero_detectado or config.numero_clinica or ""

            return Response(
                {
                    "session_name": sessao_waha,
                    "status_waha": status_atual,
                    "dias_antecedencia": config.dias_antecedencia,
                    "horario_envio": config.horario_envio.strftime("%H:%M") if config.horario_envio else "09:00",
                    "numero_clinica": numero_final,
                    "cancelar_nao_confirmadas": config.cancelar_nao_confirmadas,
                    "cancelar_horas_antes": config.cancelar_horas_antes,
                    "reforcar_confirmacao": config.reforcar_confirmacao,
                    "mensagem_reforco": config.mensagem_reforco,
                    "enviar_agradecimento": config.enviar_agradecimento,
                    "enviar_reagendamento": config.enviar_reagendamento,
                    "reagendamento_minutos": config.reagendamento_minutos,
                    "enviar_cancelamento": config.enviar_cancelamento,
                }
            )

    @action(detail=True, methods=["post"], url_path="whatsapp/reiniciar-sessao")
    def whatsapp_reiniciar_sessao(self, request, pk=None):
        """Reinicia a sessão WAHA da clínica."""
        from apps.notificacoes.waha import garantir_sessao

        clinica = self.get_object()
        if not clinica.recurso_habilitado("whatsapp"):
            return Response(
                {"erro": "Módulo WhatsApp não aplicável ou desabilitado para o plano desta clínica."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sessao_waha = clinica.schema_name

        try:
            ok = garantir_sessao(sessao_waha)
            registrar_auditoria_vendor(
                request=request,
                acao=RegistroAuditoriaVendor.Acao.PARAMETRIZACAO,
                schema_alvo=clinica.schema_name,
                detalhes={"tipo": "waha_restart", "sucesso": ok},
            )
            return Response(
                {"mensagem": "Sessão reiniciada com sucesso.", "status": "ok" if ok else "warning"},
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            return Response(
                {"erro": f"Erro ao reiniciar sessão: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"], url_path="whatsapp/restart")
    def whatsapp_restart_alias(self, request, pk=None):
        """Alias para whatsapp/reiniciar-sessao."""
        return self.whatsapp_reiniciar_sessao(request, pk)

    @action(detail=True, methods=["get", "patch"], url_path="overrides")
    def overrides(self, request, pk=None):
        """Consulta e atualiza overrides específicos de limites da clínica."""
        from apps.plataforma_admin.serializers import OverridesTenantSerializer

        clinica = self.get_object()

        if request.method == "PATCH":
            serializer = OverridesTenantSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            campos = serializer.validated_data

            if "override_limite_dentistas" in campos:
                clinica.override_limite_dentistas = campos["override_limite_dentistas"]
            if "override_limite_usuarios" in campos:
                clinica.override_limite_usuarios = campos["override_limite_usuarios"]
            if "override_recursos" in campos:
                clinica.override_recursos = campos["override_recursos"]

            if campos:
                clinica.save(update_fields=list(campos.keys()) + ["atualizado_em"] if hasattr(clinica, "atualizado_em") else list(campos.keys()))
                registrar_auditoria_vendor(
                    request=request,
                    acao=RegistroAuditoriaVendor.Acao.PARAMETRIZACAO,
                    schema_alvo=clinica.schema_name,
                    detalhes={"tipo": "overrides", "campos": campos},
                )

        return Response(
            {
                "override_limite_dentistas": clinica.override_limite_dentistas,
                "limite_dentistas_efetivo": clinica.get_limite_dentistas(),
                "override_limite_usuarios": clinica.override_limite_usuarios,
                "limite_usuarios_efetivo": clinica.get_limite_usuarios(),
                "override_recursos": clinica.override_recursos,
            }
        )

    @action(detail=True, methods=["get"], url_path="metricas")
    def metricas(self, request, pk=None):
        """Calcula e retorna métricas operacionais agregadas do tenant."""
        from django.utils import timezone
        from django_tenants.utils import schema_context

        from apps.agenda.models import Consulta
        from apps.dentistas.models import Dentista
        from apps.notificacoes.models import LogNotificacao
        from apps.pacientes.models import Paciente
        from apps.usuarios.models import Usuario

        clinica = self.get_object()
        now = timezone.now()

        with schema_context(clinica.schema_name):
            total_pacientes = Paciente.objects.filter(ativo=True).count()
            total_dentistas = Dentista.objects.filter(ativo=True).count()
            total_usuarios = Usuario.objects.filter(is_active=True).count()
            total_agendamentos = Consulta.objects.count()

            try:
                from apps.procedimentos.models import Procedimento
                total_procedimentos = Procedimento.objects.filter(ativo=True).count()
            except Exception:
                total_procedimentos = 0

            try:
                from apps.financeiro.models import LancamentoFinanceiro
                total_lancamentos = LancamentoFinanceiro.objects.count()
            except Exception:
                total_lancamentos = 0

            ultima_consulta = Consulta.objects.order_by("-inicio").first()
            ultimo_agendamento = (
                ultima_consulta.inicio.isoformat() if ultima_consulta and ultima_consulta.inicio else None
            )

            ultimo_user = Usuario.objects.exclude(last_login=None).order_by("-last_login").first()
            ultimo_login = (
                ultimo_user.last_login.isoformat() if ultimo_user and ultimo_user.last_login else None
            )

            consultas_mes = Consulta.objects.filter(
                inicio__year=now.year,
                inicio__month=now.month,
            ).count()
            mensagens_mes = LogNotificacao.objects.filter(
                criado_em__year=now.year,
                criado_em__month=now.month,
                direcao=LogNotificacao.Direcao.ENVIADA,
            ).count()

        return Response(
            {
                "schema_name": clinica.schema_name,
                "total_pacientes": total_pacientes,
                "total_pacientes_ativos": total_pacientes,
                "total_dentistas": total_dentistas,
                "total_dentistas_ativos": total_dentistas,
                "total_usuarios": total_usuarios,
                "total_usuarios_ativos": total_usuarios,
                "total_agendamentos": total_agendamentos,
                "total_procedimentos": total_procedimentos,
                "total_lancamentos": total_lancamentos,
                "storage_usado_mb": 0,
                "ultimo_agendamento": ultimo_agendamento,
                "ultimo_login": ultimo_login,
                "consultas_mes_atual": consultas_mes,
                "mensagens_whatsapp_mes_atual": mensagens_mes,
            }
        )

    @action(detail=True, methods=["get"], url_path="erros")
    def erros(self, request, pk=None):
        """Consulta logs de erro operacionais filtrados para a clínica."""
        from apps.plataforma_admin.models import RegistroErroOperacional
        from apps.plataforma_admin.serializers import (
            RegistroErroOperacionalSerializer,
        )

        clinica = self.get_object()
        erros_qs = RegistroErroOperacional.objects.filter(
            schema_tenant=clinica.schema_name
        ).order_by("-criado_em")

        nivel = request.query_params.get("nivel")
        if nivel:
            erros_qs = erros_qs.filter(nivel=nivel.upper())

        serializer = RegistroErroOperacionalSerializer(erros_qs[:100], many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="suporte")
    def suporte(self, request, pk=None):
        """Consulta o histórico de sessões de suporte (impersonate) desta clínica."""
        from apps.plataforma_admin.models import RegistroAuditoriaVendor
        from apps.plataforma_admin.serializers import RegistroAuditoriaVendorSerializer

        clinica = self.get_object()
        registros = (
            RegistroAuditoriaVendor.objects.filter(
                schema_alvo=clinica.schema_name,
                acao=RegistroAuditoriaVendor.Acao.IMPERSONATE,
            )
            .order_by("-criado_em")[:50]
        )
        serializer = RegistroAuditoriaVendorSerializer(registros, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="auditoria")
    def auditoria(self, request, pk=None):
        """Consulta os logs de auditoria (alterações cadastrais, parâmetros, status, etc.)."""
        from apps.plataforma_admin.models import RegistroAuditoriaVendor
        from apps.plataforma_admin.serializers import RegistroAuditoriaVendorSerializer

        clinica = self.get_object()
        registros = (
            RegistroAuditoriaVendor.objects.filter(schema_alvo=clinica.schema_name)
            .exclude(acao=RegistroAuditoriaVendor.Acao.IMPERSONATE)
            .order_by("-criado_em")[:100]
        )
        serializer = RegistroAuditoriaVendorSerializer(registros, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="encerrar_suporte")
    def encerrar_suporte(self, request, pk=None):
        """Encerra e invalida todas as sessões de suporte ativas para esta clínica."""
        from django.utils import timezone
        from apps.plataforma_admin.models import RegistroAuditoriaVendor
        from apps.plataforma_admin.services import registrar_auditoria_vendor

        clinica = self.get_object()
        agora = timezone.now()
        registro_id = request.data.get("registro_id")

        # Invalida no cache compartilhado qualquer JWT de impersonate ativo desta clínica
        from django.core.cache import cache
        cache.set(f"impersonate_revoked:{clinica.schema_name}", agora.timestamp(), timeout=3600 * 24)

        # Localiza registros de IMPERSONATE da clínica (ou específico)
        registros = RegistroAuditoriaVendor.objects.filter(
            schema_alvo=clinica.schema_name,
            acao=RegistroAuditoriaVendor.Acao.IMPERSONATE,
        )
        if registro_id:
            registros = registros.filter(id=registro_id)

        encerradas = 0
        for reg in registros:
            detalhes = dict(reg.detalhes or {})
            if not detalhes.get("encerrado_em"):
                detalhes["encerrado_em"] = agora.isoformat()
                detalhes["ativo"] = False
                detalhes["encerrado_por"] = getattr(request.user, "email", str(request.user))
                reg.detalhes = detalhes
                reg.save(update_fields=["detalhes"])
                encerradas += 1

        return Response(
            {
                "mensagem": f"{encerradas} sessão(ões) de suporte encerrada(s) com sucesso.",
                "sessoes_encerradas": encerradas,
            },
            status=status.HTTP_200_OK,
        )


class MasterAdminVendorViewSet(viewsets.ViewSet):
    """
    Gestão e replicação das credenciais do Administrador Master global em todos os tenants.
    """

    permission_classes = [IsVendorSuperAdmin]

    def list(self, request):
        """Retorna informações sobre a conta Master atual e cobertura de sincronização."""
        from django.conf import settings
        from django_tenants.utils import schema_context
        from apps.tenants.models import Clinica
        from apps.usuarios.models import Usuario

        master_email = getattr(settings, "MASTER_ADMIN_EMAIL", "admin@proclinica.com.br")
        clinicas = Clinica.objects.exclude(schema_name="public")
        total_tenants = clinicas.count()

        sincronizados = 0
        for clinica in clinicas:
            try:
                with schema_context(clinica.schema_name):
                    if Usuario.objects.filter(email=master_email, is_active=True).exists():
                        sincronizados += 1
            except Exception:
                pass

        return Response(
            {
                "email": master_email,
                "total_tenants": total_tenants,
                "tenants_sincronizados": sincronizados,
            },
            status=status.HTTP_200_OK,
        )

    def create(self, request):
        """Atualiza a senha (e opcionalmente o e-mail) do Admin Master em todos os schemas."""
        from django.conf import settings
        from django_tenants.utils import schema_context
        from apps.tenants.models import Clinica
        from apps.usuarios.models import Usuario
        from apps.plataforma_admin.services import registrar_auditoria_vendor

        email = (
            request.data.get("email", "").strip().lower()
            or getattr(settings, "MASTER_ADMIN_EMAIL", "admin@proclinica.com.br")
        )
        nova_senha = request.data.get("nova_senha", "")

        if not nova_senha or len(nova_senha) < 8:
            return Response(
                {"erro": "A nova senha do Master Admin deve ter no mínimo 8 caracteres."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        clinicas = Clinica.objects.exclude(schema_name="public")
        total_tenants = clinicas.count()
        atualizados = 0

        for clinica in clinicas:
            try:
                with schema_context(clinica.schema_name):
                    u, _ = Usuario.objects.get_or_create(
                        email=email,
                        defaults={
                            "nome_completo": "Administrador Master",
                            "papel": Usuario.Papel.ADMIN,
                            "is_staff": True,
                            "is_superuser": True,
                            "is_active": True,
                        },
                    )
                    u.set_password(nova_senha)
                    u.is_staff = True
                    u.is_superuser = True
                    u.is_active = True
                    u.papel = Usuario.Papel.ADMIN
                    u.save()
                    atualizados += 1
            except Exception as exc:
                logger.error("Falha ao sincronizar Master Admin no schema '%s': %s", clinica.schema_name, exc)

        registrar_auditoria_vendor(
            request=request,
            acao=RegistroAuditoriaVendor.Acao.OUTRO,
            schema_alvo="public",
            detalhes={
                "justificativa": f"Atualização e sincronização da senha do Master Admin ({email}) em {atualizados} de {total_tenants} clínicas",
                "email": email,
                "tenants_afetados": atualizados,
            },
        )

        return Response(
            {
                "mensagem": f"Senha do Master Admin sincronizada com sucesso em {atualizados} de {total_tenants} clínicas.",
                "email": email,
                "tenants_sincronizados": atualizados,
                "total_tenants": total_tenants,
            },
            status=status.HTTP_200_OK,
        )


VENDOR_LOGIN_FALHAS_MAX = 5
VENDOR_LOGIN_BLOQUEIO_SEGUNDOS = 15 * 60
VENDOR_LOGIN_BLOQUEIO_MINUTOS = VENDOR_LOGIN_BLOQUEIO_SEGUNDOS // 60


def _vendor_ip_cliente(request) -> str:
    # IP real = ÚLTIMO item do X-Forwarded-For (anexado pelo Caddy). Ler o primeiro
    # seria spoofável e permitiria burlar o lockout por força bruta do login vendor.
    encaminhado = request.META.get("HTTP_X_FORWARDED_FOR")
    if encaminhado:
        return encaminhado.split(",")[-1].strip()
    return request.META.get("REMOTE_ADDR", "sem-ip")


def _vendor_chave_falhas(ip: str) -> str:
    return f"login-falhas:vendor:{ip}"


class VendorLoginView(APIView):
    """
    Endpoint de autenticação para operadores do Vendor Admin.
    Executa exclusivamente no host público e valida credenciais de staff/superuser.
    Inclui bloqueio por tentativas excessivas (proteção contra força bruta).
    """

    permission_classes = [IsVendorHost]
    authentication_classes = []
    throttle_classes = [VendorLoginThrottle]

    def post(self, request):
        from django.core.cache import cache
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.usuarios.models import Usuario

        ip = _vendor_ip_cliente(request)
        chave = _vendor_chave_falhas(ip)

        if cache.get(chave, 0) >= VENDOR_LOGIN_FALHAS_MAX:
            return Response(
                {
                    "detail": (
                        f"Muitas tentativas de login no Vendor Admin. Aguarde "
                        f"{VENDOR_LOGIN_BLOQUEIO_MINUTOS} minutos e tente novamente."
                    )
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        email = (request.data.get("email") or "").strip()
        password = request.data.get("password") or request.data.get("senha") or ""

        if not email or not password:
            return Response(
                {"detail": "E-mail e senha são obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = None
        operador_schema = "public"
        # Operador do Vendor Admin exige is_superuser (spec §2.2). Admins de clínica são
        # is_staff=True/superuser=False — nunca são operadores (evita escalonamento).
        # O Master global é semeado em todos os schemas de tenant; varremos os tenants.
        tenants = list(Clinica.objects.exclude(schema_name="public").filter(ativo=True))
        for t in tenants:
            try:
                with schema_context(t.schema_name):
                    try:
                        u = Usuario.objects.get(email__iexact=email)
                        if u.check_password(password) and u.is_superuser and u.is_active:
                            user = u
                            operador_schema = t.schema_name
                            break
                    except Usuario.DoesNotExist:
                        continue
            except Exception as exc:
                logger.debug("Falha ao consultar operador no tenant %s: %s", t.schema_name, exc)
                continue

        if not user:
            cache.set(chave, cache.get(chave, 0) + 1, timeout=VENDOR_LOGIN_BLOQUEIO_SEGUNDOS)
            return Response(
                {"detail": "Credenciais inválidas ou usuário sem permissão de operador."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Sucesso: zera contador de falhas do IP
        cache.delete(chave)

        refresh = RefreshToken.for_user(user)
        refresh["schema_name"] = "public"
        refresh["operator_schema"] = operador_schema
        refresh["is_staff"] = user.is_staff
        refresh["is_superuser"] = user.is_superuser
        refresh["email"] = user.email
        refresh["nome"] = user.nome_completo or user.email

        access_token = refresh.access_token
        access_token["schema_name"] = "public"
        access_token["operator_schema"] = operador_schema
        access_token["is_staff"] = user.is_staff
        access_token["is_superuser"] = user.is_superuser
        access_token["email"] = user.email
        access_token["nome"] = user.nome_completo or user.email

        return Response(
            {
                "access": str(access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_200_OK,
        )





