"""
Models de gestão de pacientes (schema de cada tenant).

`Paciente` é o paciente da clínica. O `cpf` é único dentro do tenant e o
`telefone_whatsapp` é usado pelas notificações (WAHA) das próximas sprints.
"""

from django.db import models

from apps.core.models import ModeloBase


class Paciente(ModeloBase):
    """Paciente atendido pela clínica."""

    nome_completo = models.CharField(max_length=255)
    # Nulo é permitido para pacientes criados automaticamente (ex.: importados do
    # Google Agenda, que não trazem CPF). NULLs não conflitam com unique no Postgres.
    cpf = models.CharField("CPF", max_length=11, unique=True, null=True, blank=True)
    data_nascimento = models.DateField(null=True, blank=True)
    telefone_whatsapp = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    endereco = models.CharField(max_length=255, blank=True)
    # Dentista responsável (escopo row-level): o DENTISTA vê só os pacientes onde é
    # o responsável, está compartilhado, OU tem consulta. Gerente/Recepção/Admin veem
    # todos. O responsável faz as tratativas; os compartilhados apenas atendem.
    dentista_responsavel = models.ForeignKey(
        "dentistas.Dentista",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="pacientes_responsavel",
    )
    # Dentistas com quem o paciente é compartilhado (ex.: responsável de férias/agenda
    # cheia). Enxergam e atendem, mas não são os responsáveis.
    dentistas_compartilhados = models.ManyToManyField(
        "dentistas.Dentista",
        blank=True,
        related_name="pacientes_compartilhados",
    )

    class Meta:
        verbose_name = "Paciente"
        verbose_name_plural = "Pacientes"
        ordering = ["nome_completo"]

    def __str__(self):
        return self.nome_completo

    @property
    def telefone_formatado(self):
        """
        Telefone no formato brasileiro `(DDD) NÚMERO`.

        Ex.: 5518997999509 -> (18) 99799-9509. Remove o código do país (55) quando
        presente. Se o formato for inesperado, devolve o valor original.
        """
        digitos = "".join(ch for ch in self.telefone_whatsapp if ch.isdigit())
        if len(digitos) >= 12 and digitos.startswith("55"):
            digitos = digitos[2:]  # remove o código do país
        if len(digitos) == 11:  # DDD + celular (9 dígitos)
            return f"({digitos[:2]}) {digitos[2:7]}-{digitos[7:]}"
        if len(digitos) == 10:  # DDD + fixo (8 dígitos)
            return f"({digitos[:2]}) {digitos[2:6]}-{digitos[6:]}"
        return self.telefone_whatsapp  # formato inesperado: devolve original


class PlanoOdontologico(ModeloBase):
    """Convênio/plano odontológico do paciente (vários por paciente)."""

    class Status(models.TextChoices):
        ATIVO = "ATIVO", "Ativo"
        SUSPENSO = "SUSPENSO", "Suspenso"
        CANCELADO = "CANCELADO", "Cancelado"

    paciente = models.ForeignKey(Paciente, on_delete=models.CASCADE, related_name="planos")
    # Convênio do catálogo da clínica (fonte da `operadora`). Opcional no banco por
    # compatibilidade; a API preenche `operadora` a partir dele quando informado.
    convenio = models.ForeignKey(
        "convenios.Convenio",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="planos",
    )
    operadora = models.CharField(max_length=100)  # ex.: Amil Dental, Uniodonto
    numero_carteirinha = models.CharField(max_length=50, blank=True)
    validade = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ATIVO)

    class Meta:
        verbose_name = "Plano odontológico"
        verbose_name_plural = "Planos odontológicos"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"{self.operadora} - {self.paciente.nome_completo}"


class Guia(ModeloBase):
    """
    Guia de procedimento vinculada a um plano odontológico.

    Pode ser vinculada à `Consulta` (app agenda) no momento do atendimento.
    """

    class Status(models.TextChoices):
        EMITIDA = "EMITIDA", "Emitida"
        AUTORIZADA = "AUTORIZADA", "Autorizada"
        EXECUTADA = "EXECUTADA", "Executada"
        GLOSADA = "GLOSADA", "Glosada"
        PAGA = "PAGA", "Paga"

    plano = models.ForeignKey(PlanoOdontologico, on_delete=models.PROTECT, related_name="guias")
    # Vinculada à consulta no momento do atendimento (string ref evita import circular).
    consulta = models.ForeignKey(
        "agenda.Consulta",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="guias",
    )
    numero_guia = models.CharField(max_length=50)
    procedimento = models.CharField(max_length=255)  # descrição / código TUSS
    valor = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Procedimentos por dente (odontograma), notação FDI.
    # Ex.: [{"dente": 44, "procedimento": "Restauração"}, {"dente": 22, "procedimento": "Canal"}].
    dentes = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.EMITIDA)

    class Meta:
        verbose_name = "Guia"
        verbose_name_plural = "Guias"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"Guia {self.numero_guia} ({self.get_status_display()})"

    # Transições permitidas do ciclo de vida da guia.
    # PAGA e GLOSADA são estados terminais.
    TRANSICOES = {
        Status.EMITIDA: {Status.AUTORIZADA, Status.GLOSADA},
        Status.AUTORIZADA: {Status.EXECUTADA, Status.GLOSADA},
        Status.EXECUTADA: {Status.PAGA, Status.GLOSADA},
        Status.PAGA: set(),
        Status.GLOSADA: set(),
    }

    def pode_transicionar_para(self, novo_status):
        """Indica se a guia pode ir do status atual para `novo_status`."""
        return novo_status in self.TRANSICOES.get(self.status, set())
