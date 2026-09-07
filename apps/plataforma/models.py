"""
Models da plataforma (schema `public`).

`PlanoAssinatura` representa os planos comerciais do próprio SaaS (o que cada
clínica assina para usar o sistema). Não confundir com `PlanoOdontologico`,
que é o convênio odontológico do paciente (app `pacientes`, sprints adiante).
"""

from datetime import timedelta

from django.db import models
from django.utils import timezone


class PlanoAssinatura(models.Model):
    """Plano comercial do SaaS assinado por uma clínica."""

    class Periodicidade(models.TextChoices):
        MENSAL = "MENSAL", "Mensal"
        ANUAL = "ANUAL", "Anual"
        PERMANENTE = "PERMANENTE", "Permanente (Vitalício)"

    nome = models.CharField(max_length=100, unique=True)
    periodicidade = models.CharField(
        max_length=20,
        choices=Periodicidade.choices,
        default=Periodicidade.MENSAL,
        help_text="Ciclo de cobrança/renovação padrão do plano",
    )
    preco_mensal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    preco_anual = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Valor anual com desconto (opcional)",
    )
    limite_dentistas = models.PositiveIntegerField(
        null=True, blank=True, help_text="Vazio = ilimitado"
    )
    limite_usuarios = models.PositiveIntegerField(
        null=True, blank=True, help_text="Vazio = ilimitado"
    )
    limite_pacientes_ativos = models.PositiveIntegerField(
        null=True, blank=True, help_text="Vazio = ilimitado"
    )
    limite_armazenamento_mb = models.PositiveIntegerField(
        default=1024,
        help_text="Cota em MB para uploads futuros",
    )
    modulo_financeiro_ativo = models.BooleanField(
        default=True,
        help_text="Habilita módulo financeiro",
    )
    modulo_estoque_ativo = models.BooleanField(
        default=True,
        help_text="Habilita módulo de estoque/insumos",
    )
    sync_google_ativo = models.BooleanField(
        default=True,
        help_text="Habilita integração com Google Calendar",
    )
    whatsapp_waha_ativo = models.BooleanField(
        default=True,
        help_text="Habilita automações de WhatsApp",
    )
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Plano de assinatura"
        verbose_name_plural = "Planos de assinatura"
        ordering = ["preco_mensal"]

    def __str__(self):
        return self.nome


class Aviso(models.Model):
    """Aviso/novidade da plataforma — exibido em carrossel ao tenant logo após
    o login, pelo período configurado (publicado_em + dias_visibilidade).
    Gerenciado pelo Vendor Admin; visível a todos os tenants."""

    class Icone(models.TextChoices):
        MEGAFONE = "megafone", "Megafone"
        SPARKLES = "sparkles", "Novidade (estrelas)"
        PRESENTE = "presente", "Presente"
        SINO = "sino", "Sino"
        FOGUETE = "foguete", "Foguete"
        FESTA = "festa", "Comemoração"
        FERRAMENTA = "ferramenta", "Manutenção"
        INFO = "info", "Informação"

    titulo = models.CharField(max_length=150)
    descricao = models.TextField(blank=True)
    imagem_url = models.URLField(blank=True)
    icone = models.CharField(
        max_length=20,
        choices=Icone.choices,
        default=Icone.MEGAFONE,
        help_text="Exibido no lugar da imagem quando não houver imagem_url",
    )
    link_url = models.URLField(blank=True)
    link_rotulo = models.CharField(max_length=50, blank=True)
    publicado_em = models.DateField(default=timezone.localdate)
    dias_visibilidade = models.PositiveSmallIntegerField(default=7)
    ordem = models.PositiveSmallIntegerField(default=0)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Aviso"
        verbose_name_plural = "Avisos"
        ordering = ["ordem", "-publicado_em"]

    def __str__(self):
        return self.titulo

    def esta_vigente(self) -> bool:
        """Dentro da janela de dias configurada a partir da publicação."""
        fim = self.publicado_em + timedelta(days=self.dias_visibilidade)
        return self.ativo and self.publicado_em <= timezone.localdate() <= fim


class HistoricoPagamentoAssinatura(models.Model):
    """Um registro por renovação/troca de plano da assinatura da clínica —
    histórico de verdade (valor, forma de pagamento, vigência antes/depois),
    ao contrário do RegistroAuditoriaVendor genérico (detalhes soltos em JSON,
    misturado com toda ação administrativa do vendor)."""

    class Tipo(models.TextChoices):
        RENOVACAO = "RENOVACAO", "Renovação"
        TROCA_PLANO = "TROCA_PLANO", "Troca de plano"

    class FormaPagamento(models.TextChoices):
        PIX = "PIX", "Pix"
        BOLETO = "BOLETO", "Boleto"
        CARTAO = "CARTAO", "Cartão"
        DINHEIRO = "DINHEIRO", "Dinheiro"
        TRANSFERENCIA = "TRANSFERENCIA", "Transferência"

    clinica = models.ForeignKey(
        "tenants.Clinica", on_delete=models.CASCADE, related_name="historico_pagamentos"
    )
    plano = models.ForeignKey(
        PlanoAssinatura, null=True, blank=True, on_delete=models.SET_NULL
    )
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    vigencia_anterior = models.DateField(null=True, blank=True)
    vigencia_nova = models.DateField(null=True, blank=True)
    valor = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    forma_pagamento = models.CharField(max_length=20, choices=FormaPagamento.choices, blank=True)
    observacao = models.TextField(blank=True)
    operador_email = models.EmailField(max_length=255, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Histórico de pagamento/assinatura"
        verbose_name_plural = "Histórico de pagamentos/assinaturas"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"{self.clinica_id} - {self.tipo} ({self.criado_em:%Y-%m-%d})"
