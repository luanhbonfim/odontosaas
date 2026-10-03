"""Cálculo dos números do Dashboard (agregados por período) — sem models próprios.

Período (`mes|semestre|ano`) e comparação **like-for-like**: o período atual vai
do início da janela até hoje e é comparado com o MESMO trecho do período
anterior (ex.: 01–03/10 contra 01–03/09), nunca com o período anterior inteiro.
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone

from apps.agenda.models import Consulta
from apps.core.mixins import escopo_dentista_q
from apps.estoque.models import Insumo, MovimentacaoEstoque
from apps.financeiro.models import LancamentoFinanceiro
from apps.financeiro.services import _somar_meses, calcular_fluxo_caixa
from apps.pacientes.models import Paciente

PERIODOS = ("mes", "semestre", "ano")
DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
ZERO = Decimal("0")

_CONFIRMADOS = Consulta.STATUS_CONFIRMACAO_CONFIRMADOS


@dataclass(frozen=True)
class Janela:
    """Intervalo de datas **inclusivo** (atual) e o trecho equivalente anterior."""

    inicio: date
    fim: date
    inicio_ant: date
    fim_ant: date


def calcular_janelas(periodo: str, hoje: date) -> Janela:
    if periodo == "mes":
        inicio = hoje.replace(day=1)
        return Janela(inicio, hoje, _somar_meses(inicio, -1), _somar_meses(hoje, -1))
    if periodo == "ano":
        inicio = date(hoje.year, 1, 1)
        return Janela(inicio, hoje, date(hoje.year - 1, 1, 1), _somar_meses(hoje, -12))
    inicio = _somar_meses(hoje.replace(day=1), -5)  # semestre: 6 meses incl. o atual
    return Janela(inicio, hoje, _somar_meses(inicio, -6), _somar_meses(hoje, -6))


def calcular_variacao(atual, anterior):
    """% de variação (1 casa). `None` quando não há base de comparação (anterior
    zero/negativo ou ausente) — evita "+∞%" e percentual sobre base negativa."""
    if atual is None or anterior is None:
        return None
    anterior = float(anterior)
    if anterior <= 0:
        return None
    return round((float(atual) - anterior) / anterior * 100, 1)


def _dt(dia: date) -> datetime:
    """Meia-noite local (aware) do dia."""
    return timezone.make_aware(datetime.combine(dia, time.min))


def _intervalo(inicio: date, fim: date):
    """[00:00 de `inicio`, 00:00 do dia seguinte a `fim`) — fim exclusivo."""
    return _dt(inicio), _dt(fim + timedelta(days=1))


def _soma(qs, campo="valor") -> Decimal:
    return qs.aggregate(s=Sum(campo))["s"] or ZERO


def _metrica(atual, anterior):
    return {"valor": atual, "variacao": calcular_variacao(atual, anterior)}


# --------------------------------------------------------------------------
# Atendimento
# --------------------------------------------------------------------------
def _consultas_do_usuario(user):
    """Dentista só enxerga as consultas dele (fail-closed sem cadastro)."""
    qs = Consulta.objects.all()
    if getattr(user, "papel", None) == "DENTISTA":
        dentista = getattr(user, "dentista", None)
        if dentista is None:
            return qs.none()
        return qs.filter(dentista=dentista)
    return qs


def _pacientes_do_usuario(user):
    qs = Paciente.objects.filter(ativo=True)
    if getattr(user, "papel", None) == "DENTISTA":
        dentista = getattr(user, "dentista", None)
        if dentista is None:
            return qs.none()
        return qs.filter(escopo_dentista_q(dentista)).distinct()
    return qs


def _taxa_confirmacao(consultas, inicio: date, fim: date):
    ini, fim_dt = _intervalo(inicio, fim)
    base = consultas.filter(inicio__gte=ini, inicio__lt=fim_dt).exclude(
        status=Consulta.Status.CANCELADA
    )
    total = base.count()
    if total == 0:
        return None
    confirmadas = base.filter(status_confirmacao__in=_CONFIRMADOS).count()
    return round(confirmadas / total * 100, 1)


def _consultas_por_dia(consultas, hoje: date):
    segunda = hoje - timedelta(days=hoje.weekday())
    ini, fim = _intervalo(segunda, segunda + timedelta(days=6))
    ativas = consultas.filter(inicio__gte=ini, inicio__lt=fim).exclude(
        status__in=(Consulta.Status.CANCELADA, Consulta.Status.FALTOU)
    )
    por_dia = {
        linha["dia"]: linha
        for linha in ativas.annotate(dia=TruncDate("inicio", tzinfo=timezone.get_current_timezone()))
        .values("dia")
        .annotate(
            confirmadas=Count("id", filter=Q(status_confirmacao__in=_CONFIRMADOS)),
            total=Count("id"),
        )
    }
    serie = []
    for i in range(7):
        dia = segunda + timedelta(days=i)
        linha = por_dia.get(dia)
        confirmadas = linha["confirmadas"] if linha else 0
        total = linha["total"] if linha else 0
        serie.append(
            {
                "data": dia.isoformat(),
                "dia": DIAS_SEMANA[i],
                "confirmadas": confirmadas,
                "pendentes": total - confirmadas,
            }
        )
    return serie


def _consultas_por_status(consultas, inicio: date, fim: date):
    ini, fim_dt = _intervalo(inicio, fim)
    base = consultas.filter(inicio__gte=ini, inicio__lt=fim_dt)
    S = Consulta.Status
    agendada = base.filter(status=S.AGENDADA)
    contagens = [
        ("confirmadas", "Confirmadas", agendada.filter(status_confirmacao__in=_CONFIRMADOS).count()),
        ("aguardando", "Aguardando", agendada.exclude(status_confirmacao__in=_CONFIRMADOS).count()),
        ("em_atendimento", "Em atendimento", base.filter(status=S.EM_ATENDIMENTO).count()),
        ("realizadas", "Realizadas", base.filter(status=S.REALIZADA).count()),
        ("canceladas", "Canceladas", base.filter(status=S.CANCELADA).count()),
        ("faltaram", "Faltaram", base.filter(status=S.FALTOU).count()),
    ]
    return [{"status": chave, "rotulo": rotulo, "total": total} for chave, rotulo, total in contagens]


def _proximas_consultas(consultas, agora):
    # `fim >= agora` (não `inicio`): consulta EM_ATENDIMENTO já começou mas ainda não acabou.
    qs = (
        consultas.filter(
            fim__gte=agora,
            status__in=(Consulta.Status.AGENDADA, Consulta.Status.EM_ATENDIMENTO),
        )
        .select_related("paciente")
        .order_by("inicio")[:5]
    )
    return [
        {
            "id": c.id,
            "paciente": c.paciente.nome_completo,
            "telefone": c.paciente.telefone_whatsapp,
            "inicio": c.inicio,
            "valor": c.valor,
            "status": c.status,
            "status_confirmacao": c.status_confirmacao,
        }
        for c in qs
    ]


def calcular_atendimento(user, janela: Janela, hoje: date, agora):
    consultas = _consultas_do_usuario(user)
    ini_hoje, fim_hoje = _intervalo(hoje, hoje)
    consultas_hoje = (
        consultas.filter(inicio__gte=ini_hoje, inicio__lt=fim_hoje)
        .exclude(status=Consulta.Status.CANCELADA)
        .count()
    )
    taxa = _taxa_confirmacao(consultas, janela.inicio, janela.fim)
    taxa_ant = _taxa_confirmacao(consultas, janela.inicio_ant, janela.fim_ant)
    pendentes = (
        consultas.filter(status=Consulta.Status.AGENDADA, inicio__gte=agora)
        .exclude(status_confirmacao__in=_CONFIRMADOS)
        .exclude(status_confirmacao=Consulta.StatusConfirmacao.RECUSADA)
        .count()
    )
    return {
        "consultas_hoje": {"valor": consultas_hoje, "variacao": None},
        "taxa_confirmacao": {
            "valor": taxa,
            # Percentual: a variação é em pontos percentuais, não em %.
            "variacao": None if taxa is None or taxa_ant is None else round(taxa - taxa_ant, 1),
        },
        "pacientes_ativos": {"valor": _pacientes_do_usuario(user).count(), "variacao": None},
        "confirmacoes_pendentes": pendentes,
        "consultas_por_dia": _consultas_por_dia(consultas, hoje),
        "consultas_por_status": _consultas_por_status(consultas, janela.inicio, janela.fim),
        "proximas_consultas": _proximas_consultas(consultas, agora),
    }


# --------------------------------------------------------------------------
# Financeiro
# --------------------------------------------------------------------------
def _pagos(janela_inicio: date, janela_fim: date):
    ini, fim = _intervalo(janela_inicio, janela_fim)
    return LancamentoFinanceiro.objects.filter(
        status=LancamentoFinanceiro.Status.PAGO, pago_em__gte=ini, pago_em__lt=fim
    )


def _bruto_liquido(inicio: date, fim: date):
    pagos = _pagos(inicio, fim)
    bruto = _soma(pagos.filter(tipo=LancamentoFinanceiro.Tipo.RECEITA))
    despesas = _soma(pagos.filter(tipo=LancamentoFinanceiro.Tipo.DESPESA))
    return bruto, bruto - despesas


def _meses_da_janela(inicio: date, fim: date):
    meses = []
    atual = inicio.replace(day=1)
    while atual <= fim:
        meses.append(atual)
        atual = _somar_meses(atual, 1)
    return meses


def _fluxo_mensal(inicio: date, fim: date):
    por_mes = {}
    linhas = (
        _pagos(inicio, fim)
        .annotate(mes=TruncMonth("pago_em", tzinfo=timezone.get_current_timezone()))
        .values("mes", "tipo")
        .annotate(total=Sum("valor"))
    )
    for linha in linhas:
        chave = (linha["mes"].year, linha["mes"].month)
        por_mes.setdefault(chave, {})[linha["tipo"]] = linha["total"]
    serie = []
    for mes in _meses_da_janela(inicio, fim):
        somas = por_mes.get((mes.year, mes.month), {})
        serie.append(
            {
                "mes": f"{mes.year}-{mes.month:02d}",
                "rotulo": MESES[mes.month - 1],
                "entradas": somas.get(LancamentoFinanceiro.Tipo.RECEITA, ZERO),
                "saidas": somas.get(LancamentoFinanceiro.Tipo.DESPESA, ZERO),
            }
        )
    return serie


def _despesas_por_categoria(inicio: date, fim: date):
    rotulos = dict(LancamentoFinanceiro.Categoria.choices)
    linhas = (
        _pagos(inicio, fim)
        .filter(tipo=LancamentoFinanceiro.Tipo.DESPESA)
        .values("categoria")
        .annotate(total=Sum("valor"))
        .order_by("-total")
    )
    return [
        {
            "categoria": linha["categoria"] or "SEM_CATEGORIA",
            "rotulo": rotulos.get(linha["categoria"], "Sem categoria"),
            "valor": linha["total"],
        }
        for linha in linhas
    ]


def calcular_financeiro(janela: Janela):
    fluxo = calcular_fluxo_caixa()
    bruto, liquido = _bruto_liquido(janela.inicio, janela.fim)
    bruto_ant, liquido_ant = _bruto_liquido(janela.inicio_ant, janela.fim_ant)
    return {
        "contas_a_receber": {"valor": fluxo["a_receber"], "variacao": None},
        "contas_a_pagar": {"valor": fluxo["a_pagar"], "variacao": None},
        "faturamento_bruto": _metrica(bruto, bruto_ant),
        "faturamento_liquido": _metrica(liquido, liquido_ant),
        "fluxo_caixa": _fluxo_mensal(janela.inicio, janela.fim),
        "despesas_por_categoria": _despesas_por_categoria(janela.inicio, janela.fim),
    }


# --------------------------------------------------------------------------
# Estoque
# --------------------------------------------------------------------------
def _saidas(inicio: date, fim: date):
    ini, fim_dt = _intervalo(inicio, fim)
    return MovimentacaoEstoque.objects.filter(
        tipo=MovimentacaoEstoque.Tipo.SAIDA, criado_em__gte=ini, criado_em__lt=fim_dt
    )


def _custo_materiais(inicio: date, fim: date):
    return _soma(
        _pagos(inicio, fim).filter(
            tipo=LancamentoFinanceiro.Tipo.DESPESA,
            categoria=LancamentoFinanceiro.Categoria.MATERIAIS,
        )
    )


def calcular_estoque(janela: Janela):
    # 1 query: saldo anotado (sem N+1). Insumo inativo fica fora dos KPIs e do alerta.
    insumos = list(Insumo.objects.com_saldo().filter(ativo=True))
    baixos = [i for i in insumos if i.estoque_minimo > 0 and i.saldo_calculado <= i.estoque_minimo]
    baixos.sort(key=lambda i: (i.saldo_calculado / i.estoque_minimo, i.nome))

    gasto = _soma(_saidas(janela.inicio, janela.fim), "quantidade")
    gasto_ant = _soma(_saidas(janela.inicio_ant, janela.fim_ant), "quantidade")
    custo = _custo_materiais(janela.inicio, janela.fim)
    custo_ant = _custo_materiais(janela.inicio_ant, janela.fim_ant)

    consumidos = (
        _saidas(janela.inicio, janela.fim)
        .values("insumo__nome", "insumo__unidade")
        .annotate(total=Sum("quantidade"))
        .order_by("-total", "insumo__nome")[:5]
    )
    return {
        # Unidades diferentes (UN/CX/ML/G) — soma de saldos não faz sentido: conta itens.
        "itens_em_estoque": {
            "valor": sum(1 for i in insumos if i.saldo_calculado > 0),
            "variacao": None,
        },
        "insumos_abaixo_minimo": {"valor": len(baixos), "variacao": None},
        "materiais_gastos": _metrica(gasto, gasto_ant),
        "custo_de_materiais": _metrica(custo, custo_ant),
        "materiais_consumidos": [
            {
                "material": linha["insumo__nome"],
                "unidade": linha["insumo__unidade"],
                "quantidade": linha["total"],
            }
            for linha in consumidos
        ],
        "estoque_baixo": [
            {
                "item": i.nome,
                "unidade": i.unidade,
                "atual": i.saldo_calculado,
                "minimo": i.estoque_minimo,
            }
            for i in baixos[:8]
        ],
    }


# --------------------------------------------------------------------------
# Orquestração
# --------------------------------------------------------------------------
def _modulo_ativo(tenant, recurso: str) -> bool:
    if tenant is None or not hasattr(tenant, "recurso_habilitado"):
        return True
    return tenant.recurso_habilitado(recurso)


def calcular_dashboard(user, periodo: str, tenant=None, agora=None):
    """Monta o payload completo. `financeiro`/`estoque` = None quando o usuário
    não tem permissão de ver o módulo OU o plano da clínica o desabilitou."""
    agora = agora or timezone.now()
    hoje = timezone.localtime(agora).date()
    janela = calcular_janelas(periodo, hoje)

    financeiro = None
    if user.has_perm("financeiro.view_lancamentofinanceiro") and _modulo_ativo(tenant, "financeiro"):
        financeiro = calcular_financeiro(janela)

    estoque = None
    if user.has_perm("estoque.view_insumo") and _modulo_ativo(tenant, "estoque"):
        estoque = calcular_estoque(janela)

    return {
        "periodo": periodo,
        "atendimento": calcular_atendimento(user, janela, hoje, agora),
        "financeiro": financeiro,
        "estoque": estoque,
    }

