"""Regras de negócio do financeiro (isoladas para teste e reuso)."""

from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from .models import Fatura, LancamentoFinanceiro


def gerar_conta_da_guia(guia):
    """
    Gera a conta a receber (RECEITA) de uma guia executada (valor da guia).

    Idempotente (uma conta por guia) e ignora guias sem valor. Retorna o
    LancamentoFinanceiro criado ou None.
    """
    if not guia.valor or guia.valor <= 0:
        return None
    if LancamentoFinanceiro.objects.filter(guia=guia).exists():
        return None
    return LancamentoFinanceiro.objects.create(
        tipo=LancamentoFinanceiro.Tipo.RECEITA,
        descricao=f"Guia {guia.numero_guia} - {guia.procedimento}",
        valor=guia.valor,
        vencimento=timezone.localdate(),
        guia=guia,
    )


def estornar_conta_da_guia(guia):
    """Cancela a conta a receber de uma guia glosada/excluída — só se ainda **não**
    foi paga. Uma conta já PAGO (recebida) não é mexida: a glosa nesse caso é uma
    reconciliação manual. Recalcula a fatura afetada. Retorna quantas foram canceladas.
    """
    return _cancelar_contas_pendentes(LancamentoFinanceiro.objects.filter(guia=guia))


def gerar_conta_da_consulta(consulta):
    """
    Gera a conta a receber (RECEITA) de uma consulta **particular** realizada.

    Consulta por convênio é faturada via Guia — não gera conta particular (evita
    cobrança em dobro). Idempotente (uma conta por consulta) e ignora consultas
    sem valor. Retorna o LancamentoFinanceiro criado ou None.
    """
    if consulta.convenio_id:
        return None
    if not consulta.valor or consulta.valor <= 0:
        return None
    if LancamentoFinanceiro.objects.filter(consulta=consulta).exists():
        return None
    return LancamentoFinanceiro.objects.create(
        tipo=LancamentoFinanceiro.Tipo.RECEITA,
        descricao=f"Consulta particular - {consulta.paciente.nome_completo}",
        valor=consulta.valor,
        vencimento=timezone.localdate(),
        consulta=consulta,
    )


def estornar_conta_da_consulta(consulta):
    """Cancela a conta a receber de uma consulta cancelada/excluída — só se não paga."""
    return _cancelar_contas_pendentes(LancamentoFinanceiro.objects.filter(consulta=consulta))


def _faturas_de(contas_qs):
    """Faturas distintas referenciadas por um queryset de lançamentos."""
    ids = list(
        contas_qs.exclude(fatura__isnull=True).values_list("fatura_id", flat=True).distinct()
    )
    return list(Fatura.objects.filter(id__in=ids)) if ids else []


def recalcular_total_fatura(fatura):
    """Recalcula `valor_total` pela soma dos lançamentos não cancelados da fatura (F6)."""
    total = fatura.lancamentos.exclude(
        status=LancamentoFinanceiro.Status.CANCELADO
    ).aggregate(s=Sum("valor"))["s"] or Decimal("0")
    if fatura.valor_total != total:
        fatura.valor_total = total
        fatura.save(update_fields=["valor_total", "atualizado_em"])
    return total


def _cancelar_contas_pendentes(contas_qs):
    """Cancela as contas PENDENTES do queryset e recalcula as faturas afetadas."""
    pendentes = contas_qs.filter(status=LancamentoFinanceiro.Status.PENDENTE)
    faturas = _faturas_de(pendentes)
    quantidade = pendentes.update(status=LancamentoFinanceiro.Status.CANCELADO)
    for fatura in faturas:
        recalcular_total_fatura(fatura)
    return quantidade


def sincronizar_valor_conta_da_guia(guia):
    """F3: se o valor da guia mudou, atualiza a conta a receber PENDENTE (e a fatura)."""
    if not guia.valor or guia.valor <= 0:
        return 0
    return _sincronizar_valor(LancamentoFinanceiro.objects.filter(guia=guia), guia.valor)


def sincronizar_valor_conta_da_consulta(consulta):
    """F3: idem para a conta particular de uma consulta editada."""
    if not consulta.valor or consulta.valor <= 0:
        return 0
    return _sincronizar_valor(
        LancamentoFinanceiro.objects.filter(consulta=consulta), consulta.valor
    )


def _sincronizar_valor(contas_qs, novo_valor):
    """Atualiza o valor das contas PENDENTES que divergem e recalcula as faturas."""
    pendentes = contas_qs.filter(status=LancamentoFinanceiro.Status.PENDENTE).exclude(
        valor=novo_valor
    )
    faturas = _faturas_de(pendentes)
    quantidade = pendentes.update(valor=novo_valor)
    for fatura in faturas:
        recalcular_total_fatura(fatura)
    return quantidade


def faturar_operadora(operadora, competencia=""):
    """
    Agrupa numa `Fatura` as contas a receber (de guias) ainda não faturadas de uma
    operadora. Define `valor_total` pela soma. Retorna a Fatura ou None se não há
    nada a faturar.
    """
    lancamentos = list(
        LancamentoFinanceiro.objects.filter(
            tipo=LancamentoFinanceiro.Tipo.RECEITA,
            status=LancamentoFinanceiro.Status.PENDENTE,  # não re-fatura pagas/canceladas
            fatura__isnull=True,
            guia__isnull=False,
            guia__plano__operadora=operadora,
        )
    )
    if not lancamentos:
        return None

    fatura = Fatura.objects.create(
        operadora=operadora, competencia=competencia, status=Fatura.Status.ABERTA
    )
    total = Decimal("0")
    for lancamento in lancamentos:
        lancamento.fatura = fatura
        lancamento.save(update_fields=["fatura", "atualizado_em"])
        total += lancamento.valor
    fatura.valor_total = total
    fatura.save(update_fields=["valor_total", "atualizado_em"])
    return fatura


def calcular_fluxo_caixa(de=None, ate=None):
    """
    Resumo de fluxo de caixa (opcionalmente por período de vencimento).

    Retorna os totais pendentes (a receber / a pagar) e realizados (recebido /
    pago), com os saldos previsto e realizado.
    """
    qs = LancamentoFinanceiro.objects.all()
    if de:
        qs = qs.filter(vencimento__gte=de)
    if ate:
        qs = qs.filter(vencimento__lte=ate)

    def _total(tipo, status):
        return qs.filter(tipo=tipo, status=status).aggregate(s=Sum("valor"))["s"] or Decimal("0")

    a_receber = _total(LancamentoFinanceiro.Tipo.RECEITA, LancamentoFinanceiro.Status.PENDENTE)
    a_pagar = _total(LancamentoFinanceiro.Tipo.DESPESA, LancamentoFinanceiro.Status.PENDENTE)
    recebido = _total(LancamentoFinanceiro.Tipo.RECEITA, LancamentoFinanceiro.Status.PAGO)
    pago = _total(LancamentoFinanceiro.Tipo.DESPESA, LancamentoFinanceiro.Status.PAGO)
    return {
        "a_receber": a_receber,
        "a_pagar": a_pagar,
        "saldo_previsto": a_receber - a_pagar,
        "recebido": recebido,
        "pago": pago,
        "saldo_realizado": recebido - pago,
    }
