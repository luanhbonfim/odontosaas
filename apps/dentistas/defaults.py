"""
Especialidades odontológicas padrão — semeadas em cada clínica nova.

Baseado nas especialidades reconhecidas pelo CFO (Conselho Federal de Odontologia)
+ "Clínico Geral" (uso comum nas clínicas). Semeado no provisionamento do tenant
(idempotente); a clínica pode adicionar/remover depois.
"""

ESPECIALIDADES_PADRAO = [
    "Clínico Geral",
    "Ortodontia",
    "Ortopedia Funcional dos Maxilares",
    "Endodontia",
    "Periodontia",
    "Dentística",
    "Prótese Dentária",
    "Implantodontia",
    "Cirurgia e Traumatologia Bucomaxilofaciais",
    "Odontopediatria",
    "Radiologia Odontológica e Imaginologia",
    "Estomatologia",
    "Patologia Oral e Maxilofacial",
    "Disfunção Temporomandibular e Dor Orofacial",
    "Odontogeriatria",
    "Odontologia para Pacientes com Necessidades Especiais",
    "Harmonização Orofacial",
    "Saúde Coletiva",
    "Odontologia Legal",
    "Odontologia do Trabalho",
]


def semear_especialidades_padrao():
    """Cria as especialidades padrão do tenant atual (idempotente; não duplica).

    Use dentro de um ``schema_context`` do tenant.
    """
    from apps.dentistas.models import Especialidade

    for nome in ESPECIALIDADES_PADRAO:
        Especialidade.objects.get_or_create(nome=nome)
