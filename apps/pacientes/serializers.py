"""Serializers do app pacientes."""

from django.utils import timezone
from rest_framework import serializers

from .models import Guia, Paciente, PlanoOdontologico


class PacienteSerializer(serializers.ModelSerializer):
    dentista_responsavel_nome = serializers.SerializerMethodField()
    dentistas_compartilhados_nomes = serializers.SerializerMethodField()
    idade = serializers.SerializerMethodField()

    class Meta:
        model = Paciente
        fields = [
            "id",
            "nome_completo",
            "cpf",
            "data_nascimento",
            "idade",
            "telefone_whatsapp",
            "email",
            "endereco",
            "dentista_responsavel",
            "dentista_responsavel_nome",
            "dentistas_compartilhados",
            "dentistas_compartilhados_nomes",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]
        # O `cpf` é opcional no model (permite auto-criação sem CPF, ex.: import do
        # Google), mas na API continua obrigatório. O UniqueValidator (unique=True)
        # é herdado do model -> valida CPF único.
        extra_kwargs = {"cpf": {"required": True}}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # N2: só Gerente/Admin/Recepção definem/reatribuem responsável e
        # compartilhados. Para o Dentista esses campos são somente-leitura (na
        # criação, o viewset auto-atribui o próprio dentista como responsável).
        request = self.context.get("request")
        if request and getattr(request.user, "papel", None) == "DENTISTA":
            self.fields["dentista_responsavel"].read_only = True
            self.fields["dentistas_compartilhados"].read_only = True

    def get_idade(self, obj) -> int | None:
        """Idade em anos completos a partir de data_nascimento (ou None)."""
        nasc = obj.data_nascimento
        if not nasc:
            return None
        hoje = timezone.localdate()
        return hoje.year - nasc.year - ((hoje.month, hoje.day) < (nasc.month, nasc.day))

    def get_dentista_responsavel_nome(self, obj) -> str | None:
        return obj.dentista_responsavel.nome_completo if obj.dentista_responsavel_id else None

    def get_dentistas_compartilhados_nomes(self, obj) -> list[str]:
        return [d.nome_completo for d in obj.dentistas_compartilhados.all()]


class PlanoOdontologicoSerializer(serializers.ModelSerializer):
    # Nome do convênio (para exibição); cai na `operadora` quando não há vínculo.
    convenio_nome = serializers.SerializerMethodField()
    # Vencido é derivado da validade (não é escolhido pelo usuário).
    vencido = serializers.SerializerMethodField()

    class Meta:
        model = PlanoOdontologico
        fields = [
            "id",
            "paciente",
            "convenio",
            "convenio_nome",
            "operadora",
            "numero_carteirinha",
            "validade",
            "status",
            "vencido",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]
        # `operadora` pode vir do convênio selecionado; por isso não é obrigatória.
        extra_kwargs = {"operadora": {"required": False}}

    def get_convenio_nome(self, obj) -> str:
        return obj.convenio.nome if obj.convenio_id else obj.operadora

    def get_vencido(self, obj) -> bool:
        from django.utils import timezone

        return bool(obj.validade and obj.validade < timezone.localdate())

    def validate(self, attrs):
        """Exige convênio (novo padrão) ou operadora (legado) — nunca ambos vazios."""
        convenio = attrs.get("convenio") or getattr(self.instance, "convenio", None)
        operadora = attrs.get("operadora") or getattr(self.instance, "operadora", "")
        if not convenio and not operadora:
            raise serializers.ValidationError({"convenio": "Selecione um convênio."})
        return attrs

    def _sincronizar_operadora(self, validated):
        # Convênio selecionado é a fonte da string `operadora` (usada no faturamento).
        convenio = validated.get("convenio")
        if convenio is not None:
            validated["operadora"] = convenio.nome
        return validated

    def create(self, validated_data):
        return super().create(self._sincronizar_operadora(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._sincronizar_operadora(validated_data))


class GuiaSerializer(serializers.ModelSerializer):
    # Procedimento principal puxado da consulta marcada (catálogo), para exibição.
    consulta_procedimento = serializers.CharField(
        source="consulta.procedimento_catalogo.nome", read_only=True, default=None
    )

    class Meta:
        model = Guia
        fields = [
            "id",
            "plano",
            "consulta",
            "consulta_procedimento",
            "numero_guia",
            "procedimento",
            "valor",
            "dentes",
            "status",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    def validate_valor(self, valor):
        """N5: o valor da guia não pode ser negativo."""
        if valor is not None and valor < 0:
            raise serializers.ValidationError("O valor não pode ser negativo.")
        return valor

    def validate(self, attrs):
        """Consulta do mesmo paciente do plano; e não emitir guia em plano não-ATIVO."""
        consulta = attrs.get("consulta") or getattr(self.instance, "consulta", None)
        plano = attrs.get("plano") or getattr(self.instance, "plano", None)
        if consulta and plano and consulta.paciente_id != plano.paciente_id:
            raise serializers.ValidationError(
                {"consulta": "A consulta deve ser do mesmo paciente do plano da guia."}
            )
        # P1: só emite guia em plano ATIVO (na criação).
        if self.instance is None and plano and plano.status != PlanoOdontologico.Status.ATIVO:
            raise serializers.ValidationError(
                {"plano": "Não é possível emitir guia em um plano que não está ativo."}
            )
        # N4: não emitir/executar guia em plano com validade vencida.
        novo_status = attrs.get("status") or getattr(self.instance, "status", None)
        emitindo = self.instance is None
        executando = novo_status == Guia.Status.EXECUTADA
        if (emitindo or executando) and plano and plano.validade and plano.validade < timezone.localdate():
            raise serializers.ValidationError(
                {"plano": "Plano vencido: renove a validade antes de emitir/executar a guia."}
            )
        return attrs

    def validate_status(self, novo_status):
        """Na atualização, só permite transições válidas do ciclo de vida."""
        if (
            self.instance
            and novo_status != self.instance.status
            and not self.instance.pode_transicionar_para(novo_status)
        ):
            raise serializers.ValidationError(
                f"Transição inválida: {self.instance.status} -> {novo_status}."
            )
        return novo_status
