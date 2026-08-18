"""
Textos padrão das mensagens de WhatsApp (confirmação, cancelamento, agradecimento).

Servem como corpo inicial dos templates (semeados por clínica) e como fallback
no código quando não há um template ativo. Variáveis suportadas no corpo:
``{{paciente}}``, ``{{data}}``, ``{{hora}}``, ``{{dentista}}`` e ``{{link}}``
(o link só faz sentido na confirmação; a pessoa posiciona onde quiser).
"""

CORPO_PADRAO_CONFIRMACAO = (
    "Olá, {{paciente}}! 🦷\n"
    "\n"
    "Passando para *confirmar* sua consulta:\n"
    "\n"
    "🗓️ Data: {{data}}\n"
    "⏰ Horário: {{hora}}\n"
    "👩‍⚕️ Profissional: {{dentista}}\n"
    "\n"
    "Responda com *SIM* ou *NÃO*.\n"
    "\n"
    "Ou clique no link a seguir:\n"
    "👉 {{link}}\n"
    "\n"
    "Até breve! 💙"
)

CORPO_PADRAO_CANCELAMENTO = (
    "Olá, {{paciente}}.\n"
    "\n"
    "Sua consulta de *{{data}}* às *{{hora}}* com {{dentista}} foi *cancelada*. ❌\n"
    "\n"
    "Se quiser remarcar, é só chamar a gente por aqui. Estamos à disposição! 💙"
)

CORPO_PADRAO_AGRADECIMENTO = (
    "Perfeito, {{paciente}}! ✅\n"
    "\n"
    "Sua consulta com {{dentista}} está *confirmada* para *{{data}}* às *{{hora}}*. 🦷\n"
    "\n"
    "Obrigado por confirmar. Até lá! 😊"
)

CORPO_PADRAO_REAGENDAMENTO = (
    "Olá, {{paciente}}! 🗓️\n"
    "\n"
    "Sua consulta com {{dentista}} foi *reagendada*.\n"
    "\n"
    "🗓️ Nova data: {{data}}\n"
    "⏰ Novo horário: {{hora}}\n"
    "\n"
    "Qualquer coisa, é só chamar a gente por aqui. Até breve! 💙"
)


def semear_templates_padrao():
    """Cria os templates padrão do tenant atual (idempotente; não sobrescreve).

    Use dentro de um ``schema_context`` do tenant. Não altera o corpo de um
    template que já exista para aquele tipo — respeita edições da clínica.
    """
    from apps.notificacoes.models import TemplateMensagem

    padroes = {
        TemplateMensagem.Tipo.CONFIRMACAO: CORPO_PADRAO_CONFIRMACAO,
        TemplateMensagem.Tipo.CANCELAMENTO: CORPO_PADRAO_CANCELAMENTO,
        TemplateMensagem.Tipo.AGRADECIMENTO: CORPO_PADRAO_AGRADECIMENTO,
        TemplateMensagem.Tipo.REAGENDAMENTO: CORPO_PADRAO_REAGENDAMENTO,
    }
    for tipo, corpo in padroes.items():
        TemplateMensagem.objects.get_or_create(
            tipo=tipo, defaults={"corpo": corpo, "ativo": True}
        )
