"""Serializers do app notificacoes."""

from django.db import connection
from rest_framework import serializers

from .models import ConfiguracaoNotificacao, LogNotificacao, TemplateMensagem

# Cada template só pode estar ATIVO enquanto a sua permissão de envio estiver
# ligada, e vice-versa (trava recíproca). A Confirmação usa o interruptor-mestre
# "Notificações ativas" (`ativo`); os demais têm um flag próprio.
PERMISSAO_TEMPLATE = {
    "ativo": TemplateMensagem.Tipo.CONFIRMACAO,
    "enviar_cancelamento": TemplateMensagem.Tipo.CANCELAMENTO,
    "enviar_agradecimento": TemplateMensagem.Tipo.AGRADECIMENTO,
    "enviar_reagendamento": TemplateMensagem.Tipo.REAGENDAMENTO,
}
# Rótulo amigável de cada permissão (usado nas mensagens de erro).
PERMISSAO_ROTULO = {
    "ativo": "Notificações ativas",
    "enviar_cancelamento": "Enviar cancelamento",
    "enviar_agradecimento": "Enviar agradecimento",
    "enviar_reagendamento": "Enviar reagendamento",
}


class ConfiguracaoNotificacaoSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        # Trava: só dá para LIGAR a permissão (transição p/ True) se o template
        # correspondente estiver ATIVO (e vice-versa — ver TemplateMensagemSerializer).
        # Só age no update e apenas no campo que está sendo de fato ligado — assim a
        # criação e o PATCH de outros campos não são bloqueados por defaults.
        if self.instance is None:
            return attrs
        for campo, tipo in PERMISSAO_TEMPLATE.items():
            if campo not in attrs:
                continue
            ligando = attrs[campo] and not getattr(self.instance, campo, False)
            if ligando and not TemplateMensagem.objects.filter(tipo=tipo, ativo=True).exists():
                raise serializers.ValidationError(
                    f"O template de {tipo.label} está inativo. "
                    f"Ative-o antes de ligar '{PERMISSAO_ROTULO[campo]}'."
                )
        return attrs

    class Meta:
        model = ConfiguracaoNotificacao
        fields = [
            "id",
            "dias_antecedencia",
            "horario_envio",
            "waha_session",
            "numero_clinica",
            "palavras_confirmacao",
            "palavras_recusa",
            "enviar_agradecimento",
            "enviar_reagendamento",
            "reagendamento_minutos",
            "enviar_cancelamento",
            "cancelar_nao_confirmadas",
            "cancelar_horas_antes",
            "reforcar_confirmacao",
            "mensagem_reforco",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        # `waha_session` é gerido pelo sistema: a sessão do WhatsApp = o schema do
        # tenant (uma por clínica). Não é escolhido/editado pela clínica.
        read_only_fields = ["waha_session", "criado_em", "atualizado_em"]

    def create(self, validated_data):
        validated_data["waha_session"] = connection.schema_name
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data["waha_session"] = connection.schema_name
        return super().update(instance, validated_data)


class TemplateMensagemSerializer(serializers.ModelSerializer):
    procedimento_nome = serializers.CharField(
        source="procedimento.nome", read_only=True, default=None
    )

    class Meta:
        model = TemplateMensagem
        fields = [
            "id",
            "tipo",
            "corpo",
            "lembrete_tipo",
            "procedimento",
            "procedimento_nome",
            "intervalo_meses",
            "horas_antes",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    # Só pode haver 1 template de Confirmação/Cancelamento/Agradecimento; Lembretes
    # podem ser vários (cada um com sua regra).
    _UNICOS = {
        TemplateMensagem.Tipo.CONFIRMACAO,
        TemplateMensagem.Tipo.CANCELAMENTO,
        TemplateMensagem.Tipo.AGRADECIMENTO,
        TemplateMensagem.Tipo.REAGENDAMENTO,
    }

    def validate(self, attrs):
        tipo = attrs.get("tipo") or getattr(self.instance, "tipo", None)
        ativo = attrs.get("ativo", getattr(self.instance, "ativo", True))

        # Trava recíproca: não dá para inativar um template cuja permissão de envio
        # ainda esteja ligada na Configuração (Confirmação/Cancelamento/etc.).
        campo_permissao = next(
            (campo for campo, t in PERMISSAO_TEMPLATE.items() if t == tipo), None
        )
        if (
            campo_permissao
            and not ativo
            and ConfiguracaoNotificacao.objects.filter(**{campo_permissao: True}).exists()
        ):
            raise serializers.ValidationError(
                f"Desligue '{PERMISSAO_ROTULO[campo_permissao]}' na Configuração antes "
                "de inativar este template."
            )

        # Unicidade dos tipos não-lembrete.
        if tipo in self._UNICOS:
            existe = TemplateMensagem.objects.filter(tipo=tipo)
            if self.instance is not None:
                existe = existe.exclude(pk=self.instance.pk)
            if existe.exists():
                raise serializers.ValidationError(
                    {"tipo": f"Já existe um template de {tipo.title()}. Edite o existente."}
                )

        # Lembrete precisa do subtipo e dos campos correspondentes.
        if tipo == TemplateMensagem.Tipo.LEMBRETE:
            lt = attrs.get("lembrete_tipo") or getattr(self.instance, "lembrete_tipo", "")
            if not lt:
                raise serializers.ValidationError(
                    {"lembrete_tipo": "Escolha o tipo de lembrete (recall ou aviso)."}
                )
            proc = attrs.get("procedimento") or getattr(self.instance, "procedimento", None)
            intervalo = attrs.get("intervalo_meses") or getattr(
                self.instance, "intervalo_meses", None
            )
            horas = attrs.get("horas_antes") or getattr(self.instance, "horas_antes", None)
            if lt == TemplateMensagem.LembreteTipo.RECALL and (not proc or not intervalo):
                raise serializers.ValidationError(
                    {"procedimento": "Recall exige procedimento e intervalo (meses)."}
                )
            if lt == TemplateMensagem.LembreteTipo.PRE_CONSULTA and not horas:
                raise serializers.ValidationError(
                    {"horas_antes": "O aviso exige as horas antes da consulta."}
                )
        return attrs


class LogNotificacaoSerializer(serializers.ModelSerializer):
    """Histórico de notificações (somente leitura, para a UI)."""

    paciente_nome = serializers.CharField(source="consulta.paciente.nome_completo", read_only=True)
    consulta_inicio = serializers.DateTimeField(source="consulta.inicio", read_only=True)
    tipo = serializers.SerializerMethodField()

    class Meta:
        model = LogNotificacao
        fields = [
            "id",
            "consulta",
            "paciente_nome",
            "consulta_inicio",
            "tipo",
            "canal",
            "direcao",
            "mensagem",
            "status",
            "resposta_paciente",
            "enviado_em",
            "respondido_em",
            "criado_em",
        ]

    def get_tipo(self, obj) -> str | None:
        # Envios têm o template (Confirmação/Cancelamento/...); respostas do
        # paciente (WhatsApp ou link) não têm template -> rotulamos "RESPOSTA".
        if obj.template_id:
            return obj.template.tipo
        if obj.direcao == LogNotificacao.Direcao.RECEBIDA:
            return "RESPOSTA"
        return None
