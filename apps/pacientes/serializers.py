"""Serializers do app pacientes."""

from rest_framework import serializers

from .models import Guia, Paciente, PlanoOdontologico


class PacienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Paciente
        fields = [
            "id",
            "nome_completo",
            "cpf",
            "data_nascimento",
            "telefone_whatsapp",
            "email",
            "endereco",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]
        # O `cpf` é opcional no model (permite auto-criação sem CPF, ex.: import do
        # Google), mas na API continua obrigatório. O UniqueValidator (unique=True)
        # é herdado do model -> valida CPF único.
        extra_kwargs = {"cpf": {"required": True}}


class PlanoOdontologicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanoOdontologico
        fields = [
            "id",
            "paciente",
            "operadora",
            "numero_carteirinha",
            "validade",
            "status",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]


class GuiaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guia
        fields = [
            "id",
            "plano",
            "consulta",
            "numero_guia",
            "procedimento",
            "valor",
            "status",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    def validate(self, attrs):
        """A consulta vinculada deve ser do mesmo paciente do plano da guia."""
        consulta = attrs.get("consulta") or getattr(self.instance, "consulta", None)
        plano = attrs.get("plano") or getattr(self.instance, "plano", None)
        if consulta and plano and consulta.paciente_id != plano.paciente_id:
            raise serializers.ValidationError(
                {"consulta": "A consulta deve ser do mesmo paciente do plano da guia."}
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
