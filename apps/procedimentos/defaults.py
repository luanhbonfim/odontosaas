"""
Procedimentos padrão — semeados em cada clínica nova.

Catálogo comum de procedimentos odontológicos com valores de exemplo; a clínica
ajusta nome/valor/ativo livremente depois. Semeado no provisionamento do tenant
(idempotente, não sobrescreve edições).
"""

PROCEDIMENTOS_PADRAO = [
    ("Consulta / Avaliação", "100.00"),
    ("Limpeza (Profilaxia)", "150.00"),
    ("Restauração", "200.00"),
    ("Extração simples", "180.00"),
    ("Extração de siso", "350.00"),
    ("Canal (Endodontia)", "600.00"),
    ("Clareamento dental", "500.00"),
    ("Aplicação de flúor", "80.00"),
    ("Raspagem periodontal", "250.00"),
    ("Radiografia periapical", "60.00"),
    ("Manutenção ortodôntica", "150.00"),
    ("Instalação de aparelho ortodôntico", "800.00"),
    ("Coroa/prótese unitária", "900.00"),
    ("Prótese total (por arco)", "1200.00"),
    ("Cirurgia de implante (por unidade)", "1800.00"),
]


def semear_procedimentos_padrao():
    """Cria os procedimentos padrão do tenant atual (idempotente; não duplica
    nem sobrescreve valor se a clínica já editou). Use dentro de um
    ``schema_context`` do tenant.
    """
    from apps.procedimentos.models import Procedimento

    for nome, valor in PROCEDIMENTOS_PADRAO:
        Procedimento.objects.get_or_create(nome=nome, defaults={"valor": valor})
