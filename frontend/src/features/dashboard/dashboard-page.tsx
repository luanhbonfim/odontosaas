import type { ColumnDef } from '@tanstack/react-table'
import {
  Boxes,
  CalendarCheck,
  DollarSign,
  PackageX,
  PiggyBank,
  Receipt,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'

import { DataTable } from '@/components/common/data-table'
import { EmptyState } from '@/components/common/empty-state'
import { DateTime, Money, PhoneText } from '@/components/common/formato'
import { type ItemSegmento, SegmentadorRodape } from '@/components/common/segmentador-rodape'
import { StatusBadge, type VarianteStatus } from '@/components/common/status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useEhDesktop } from '@/stores/ui'

import {
  ConsultasPorDiaChart,
  ConsultasPorStatusChart,
  DespesasPorCategoriaChart,
  FaturamentoChart,
  FluxoCaixaChart,
  MateriaisConsumidosChart,
} from './charts'
import { EstoqueBaixoLista } from './estoque-baixo'
import { KpiCard } from './kpi-card'
import { PeriodoSelector } from './periodo-selector'
import { type Periodo, rotuloComparacao } from './periodos'
import { type DashboardDados, useDashboard } from './use-dashboard'

// Moeda compacta (sem centavos) para os KPIs.
const brl = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor)

const inteiro = (valor: number) => new Intl.NumberFormat('pt-BR').format(valor)

type ProximaConsulta = DashboardDados['atendimento']['proximas_consultas'][number]

function badgeConsulta(c: ProximaConsulta): { variante: VarianteStatus; rotulo: string } {
  if (c.status === 'EM_ATENDIMENTO') return { variante: 'info', rotulo: 'Em atendimento' }
  if (c.status_confirmacao === 'CONFIRMADA' || c.status_confirmacao === 'MANUAL')
    return { variante: 'sucesso', rotulo: 'Confirmada' }
  if (c.status_confirmacao === 'RECUSADA') return { variante: 'erro', rotulo: 'Recusada' }
  if (c.status_confirmacao === 'SEM_RESPOSTA') return { variante: 'neutro', rotulo: 'Sem resposta' }
  return { variante: 'pendente', rotulo: 'Aguardando' }
}

const colunasConsultas: ColumnDef<ProximaConsulta, unknown>[] = [
  { accessorKey: 'paciente', header: 'Paciente' },
  {
    accessorKey: 'telefone',
    header: 'Telefone',
    cell: ({ row }) => <PhoneText valor={row.original.telefone} />,
  },
  {
    accessorKey: 'inicio',
    header: 'Início',
    cell: ({ row }) => <DateTime iso={row.original.inicio} />,
  },
  {
    accessorKey: 'valor',
    header: 'Valor',
    cell: ({ row }) => <Money valor={row.original.valor} />,
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const b = badgeConsulta(row.original)
      return <StatusBadge variante={b.variante}>{b.rotulo}</StatusBadge>
    },
  },
]

function SecaoTitulo({ children }: { children: string }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  )
}

function Carregando() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando dashboard">
      <Skeleton className="h-48 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[92px] w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function DashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>('semestre')
  const { data, isLoading, isError, isPlaceholderData, refetch } = useDashboard(periodo)
  const comparacao = rotuloComparacao[periodo]

  // Dashboard é denso: no mobile mostramos UMA seção por vez, trocada pelo
  // segmentador do rodapé. No desktop (>= md) tudo aparece normalmente.
  const desktop = useEhDesktop()
  const [secao, setSecao] = useState('atendimento')
  const financeiro = data?.financeiro ?? null
  const estoque = data?.estoque ?? null
  const segmentos: ItemSegmento[] = [
    { id: 'atendimento', rotulo: 'Atendimento', icone: CalendarCheck },
    ...(financeiro ? [{ id: 'financeiro', rotulo: 'Financeiro', icone: Wallet }] : []),
    ...(estoque ? [{ id: 'estoque', rotulo: 'Estoque', icone: Boxes }] : []),
  ]
  // No mobile, oculta as seções que não são a ativa.
  const oculto = (id: string) => (!desktop && secao !== id ? 'hidden' : '')
  // Só mostra a legenda de comparação quando há variação de fato.
  const legenda = (variacao: number | null) => (variacao === null ? undefined : comparacao)

  const cabecalho = (
    <PageHeader
      titulo="Dashboard"
      descricao="Visão geral da clínica."
      acoes={<PeriodoSelector valor={periodo} aoMudar={setPeriodo} />}
    />
  )

  if (isLoading) {
    return (
      <div className="space-y-8 pb-20 md:pb-0">
        {cabecalho}
        <Carregando />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="space-y-8 pb-20 md:pb-0">
        {cabecalho}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center text-sm text-muted-foreground">
            Não foi possível carregar o dashboard.
            <Button variant="outline" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { atendimento } = data
  const taxa = atendimento.taxa_confirmacao

  return (
    <div
      className={cn('space-y-8 pb-20 md:pb-0', isPlaceholderData && 'opacity-60 transition-opacity')}
    >
      {cabecalho}

      {/* Próximas consultas — em destaque, acima de tudo (seção Atendimento no mobile) */}
      <Card className={oculto('atendimento')}>
        <CardHeader>
          <CardTitle>Próximas consultas</CardTitle>
        </CardHeader>
        <CardContent>
          {atendimento.proximas_consultas.length === 0 ? (
            <EmptyState titulo="Nenhuma consulta pela frente" />
          ) : (
            <DataTable
              columns={colunasConsultas}
              data={atendimento.proximas_consultas}
              cardMobile={(c) => {
                const b = badgeConsulta(c)
                return (
                  <div className="space-y-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold break-words">{c.paciente}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                        <PhoneText valor={c.telefone} />
                        <span aria-hidden="true">·</span>
                        <DateTime iso={c.inicio} />
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge variante={b.variante}>{b.rotulo}</StatusBadge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>Valor:</span>
                      <Money valor={c.valor} />
                    </div>
                  </div>
                )
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Atendimento */}
      <section className={cn('space-y-4', oculto('atendimento'))}>
        <SecaoTitulo>Atendimento</SecaoTitulo>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            titulo="Consultas hoje"
            valor={inteiro(atendimento.consultas_hoje.valor)}
            icone={CalendarCheck}
            legenda={
              atendimento.confirmacoes_pendentes > 0
                ? `${atendimento.confirmacoes_pendentes} confirmação(ões) pendente(s)`
                : undefined
            }
          />
          <KpiCard
            titulo="Taxa de confirmação"
            valor={taxa.valor === null ? '—' : `${taxa.valor}%`}
            icone={UserCheck}
            variacao={taxa.variacao}
            sufixoVariacao=" p.p."
            legenda={legenda(taxa.variacao)}
          />
          <KpiCard
            titulo="Pacientes ativos"
            valor={inteiro(atendimento.pacientes_ativos.valor)}
            icone={Users}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Consultas da semana</CardTitle>
            </CardHeader>
            <CardContent>
              <ConsultasPorDiaChart dados={atendimento.consultas_por_dia} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Consultas por status</CardTitle>
            </CardHeader>
            <CardContent>
              <ConsultasPorStatusChart dados={atendimento.consultas_por_status} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Financeiro — só quem tem permissão e o módulo está no plano (o backend manda null) */}
      {financeiro && (
        <section className={cn('space-y-4', oculto('financeiro'))}>
          <SecaoTitulo>Financeiro</SecaoTitulo>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              titulo="Contas a receber"
              valor={brl(financeiro.contas_a_receber.valor)}
              icone={Wallet}
              legenda="em aberto"
            />
            <KpiCard
              titulo="Contas a pagar"
              valor={brl(financeiro.contas_a_pagar.valor)}
              icone={Receipt}
              legenda="em aberto"
            />
            <KpiCard
              titulo="Faturamento líquido"
              valor={brl(financeiro.faturamento_liquido.valor)}
              icone={PiggyBank}
              variacao={financeiro.faturamento_liquido.variacao}
              legenda={legenda(financeiro.faturamento_liquido.variacao)}
            />
            <KpiCard
              titulo="Faturamento bruto"
              valor={brl(financeiro.faturamento_bruto.valor)}
              icone={DollarSign}
              variacao={financeiro.faturamento_bruto.variacao}
              legenda={legenda(financeiro.faturamento_bruto.variacao)}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Fluxo de caixa (entradas x saídas)</CardTitle>
              </CardHeader>
              <CardContent>
                <FluxoCaixaChart dados={financeiro.fluxo_caixa} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Despesas por categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <DespesasPorCategoriaChart dados={financeiro.despesas_por_categoria} />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Faturamento bruto x líquido</CardTitle>
            </CardHeader>
            <CardContent>
              <FaturamentoChart dados={financeiro.fluxo_caixa} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Estoque e insumos */}
      {estoque && (
        <section className={cn('space-y-4', oculto('estoque'))}>
          <SecaoTitulo>Estoque e insumos</SecaoTitulo>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              titulo="Itens em estoque"
              valor={inteiro(estoque.itens_em_estoque.valor)}
              icone={Boxes}
              legenda="com saldo"
            />
            <KpiCard
              titulo="Insumos abaixo do mínimo"
              valor={`${estoque.insumos_abaixo_minimo.valor} ${estoque.insumos_abaixo_minimo.valor === 1 ? 'item' : 'itens'}`}
              icone={PackageX}
            />
            <KpiCard
              titulo="Materiais gastos"
              valor={`${inteiro(estoque.materiais_gastos.valor)} un.`}
              icone={Boxes}
              variacao={estoque.materiais_gastos.variacao}
              legenda={legenda(estoque.materiais_gastos.variacao)}
              inverterCor
            />
            <KpiCard
              titulo="Custo de materiais"
              valor={brl(estoque.custo_de_materiais.valor)}
              icone={Receipt}
              variacao={estoque.custo_de_materiais.variacao}
              legenda={legenda(estoque.custo_de_materiais.variacao)}
              inverterCor
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Insumos mais consumidos</CardTitle>
              </CardHeader>
              <CardContent>
                <MateriaisConsumidosChart dados={estoque.materiais_consumidos} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Estoque baixo</CardTitle>
              </CardHeader>
              <CardContent>
                <EstoqueBaixoLista itens={estoque.estoque_baixo} />
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      <SegmentadorRodape itens={segmentos} ativo={secao} aoMudar={setSecao} />
    </div>
  )
}
