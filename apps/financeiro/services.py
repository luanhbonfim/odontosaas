"""Regras de negócio do financeiro (isoladas para teste e reuso)."""

import calendar
from decimal import ROUND_DOWN, Decimal

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


def _somar_meses(data, n):
    """Soma `n` meses a `data`, ajustando o dia se o mês de destino for mais
    curto (ex.: 31/01 + 1 mês -> 28 ou 29/02)."""
    mes_total = data.month - 1 + n
    ano = data.year + mes_total // 12
    mes = mes_total % 12 + 1
    dia = min(data.day, calendar.monthrange(ano, mes)[1])
    return data.replace(year=ano, month=mes, day=dia)


def _gerar_parcelas(consulta, valor_a_distribuir, parcelas, a_partir_da_parcela=1):
    """Cria as parcelas (RECEITA) de `a_partir_da_parcela` até `parcelas`,
    dividindo `valor_a_distribuir` entre elas — o resto do arredondamento vai
    para a última parcela gerada. Vencimento mensal a partir de
    `consulta.data_primeira_parcela` (ou hoje, se não informada)."""
    primeira_data = consulta.data_primeira_parcela or timezone.localdate()
    quantidade = parcelas - a_partir_da_parcela + 1
    base = (valor_a_distribuir / quantidade).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
    resto = valor_a_distribuir - base * quantidade
    criados = []
    for n in range(a_partir_da_parcela, parcelas + 1):
        valor_parcela = base + (resto if n == parcelas else Decimal("0"))
        criados.append(
            LancamentoFinanceiro.objects.create(
                tipo=LancamentoFinanceiro.Tipo.RECEITA,
                descricao=(
                    f"Consulta particular - {consulta.paciente.nome_completo}"
                    + (f" (parcela {n}/{parcelas})" if parcelas > 1 else "")
                ),
                valor=valor_parcela,
                vencimento=_somar_meses(primeira_data, n - 1),
                consulta=consulta,
                forma_pagamento=consulta.forma_pagamento,
                numero_parcela=n,
                total_parcelas=parcelas,
            )
        )
    return criados


def gerar_conta_da_consulta(consulta):
    """
    Gera a(s) conta(s) a receber (RECEITA) de uma consulta **particular**
    realizada — uma por parcela (`consulta.parcelas`; 1 = à vista).

    Consulta por convênio é faturada via Guia — não gera conta particular (evita
    cobrança em dobro). Idempotente (só gera se a consulta ainda não tem nenhum
    lançamento) e ignora consultas sem valor. Retorna a lista de
    LancamentoFinanceiro criados (vazia se não gerou nada).
    """
    if consulta.convenio_id:
        return []
    if not consulta.valor or consulta.valor <= 0:
        return []
    if LancamentoFinanceiro.objects.filter(consulta=consulta).exists():
        return []
    return _gerar_parcelas(consulta, consulta.valor, max(1, consulta.parcelas or 1))


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


def sincronizar_parcelas_da_consulta(consulta):
    """Se valor/forma de pagamento/parcelas/data da 1ª parcela mudaram depois
    que as parcelas já foram geradas: cancela as parcelas ainda PENDENTES e
    recria do zero com a configuração atual — nunca mexe nas já PAGAS. Sem
    efeito se a consulta ainda não gerou nenhuma parcela (isso é papel de
    `gerar_conta_da_consulta`) ou se está tudo pago/cancelado. Retorna quantas
    parcelas foram recriadas."""
    existentes = LancamentoFinanceiro.objects.filter(consulta=consulta)
    pendentes = existentes.filter(status=LancamentoFinanceiro.Status.PENDENTE)
    if not existentes.exists() or not pendentes.exists():
        return 0

    pagas = existentes.filter(status=LancamentoFinanceiro.Status.PAGO)
    pago_total = pagas.aggregate(s=Sum("valor"))["s"] or Decimal("0")
    parcelas_pagas = pagas.count()
    restante = (consulta.valor or Decimal("0")) - pago_total
    # Nunca menos parcelas do que já foi efetivamente pago; e se sobrou valor a
    # cobrar, precisa de pelo menos mais 1 parcela pra colocá-lo.
    total_parcelas = max(consulta.parcelas or 1, parcelas_pagas)
    if restante > 0:
        total_parcelas = max(total_parcelas, parcelas_pagas + 1)

    valor_pendente_atual = pendentes.aggregate(s=Sum("valor"))["s"] or Decimal("0")
    primeiro_pendente = pendentes.order_by("numero_parcela").first()
    ja_sincronizado = (
        pendentes.count() == total_parcelas - parcelas_pagas
        and abs(valor_pendente_atual - restante) < Decimal("0.01")
        and primeiro_pendente.forma_pagamento == (consulta.forma_pagamento or "")
    )
    if ja_sincronizado:
        return 0

    faturas = _faturas_de(pendentes)
    pendentes.delete()
    if restante > 0:
        _gerar_parcelas(consulta, restante, total_parcelas, a_partir_da_parcela=parcelas_pagas + 1)
    for fatura in faturas:
        recalcular_total_fatura(fatura)
    return total_parcelas - parcelas_pagas


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
