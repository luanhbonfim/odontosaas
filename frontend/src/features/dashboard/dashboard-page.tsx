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
import { DateTime, Money, PhoneText } from '@/components/common/formato'
import { type ItemSegmento, SegmentadorRodape } from '@/components/common/segmentador-rodape'
import { StatusBadge } from '@/components/common/status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSessao } from '@/features/auth/use-sessao'
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
import {
  type ConsultaDemo,
  type Periodo,
  proximasConsultas,
  resumoFaturamento,
  rotuloComparacao,
} from './dados-demo'
import { EstoqueBaixoLista } from './estoque-baixo'
import { KpiCard } from './kpi-card'
import { PeriodoSelector } from './periodo-selector'

// Moeda compacta (sem centavos) para os KPIs.
const brl = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor)

// Escolhe a variação % conforme o período selecionado (mock — viria do backend).
const varPeriodo = (periodo: Periodo, valores: Record<Periodo, number>) => valores[periodo]

const colunasConsultas: ColumnDef<ConsultaDemo, unknown>[] = [
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
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <StatusBadge variante={row.original.status}>{row.original.rotulo}</StatusBadge>
    ),
  },
]

function SecaoTitulo({ children }: { children: string }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  )
}

export function DashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>('semestre')
  const faturamento = resumoFaturamento(periodo)
  const comparacao = rotuloComparacao[periodo]
  const { usuario } = useSessao()
  // Seção Financeiro só para quem tem acesso (Gerente/Admin), espelhando a matriz.
  const podeVerFinanceiro = usuario?.papel === 'DENTISTA_GERENTE' || usuario?.papel === 'ADMIN'

  // Dashboard é denso: no mobile mostramos UMA seção por vez, trocada pelo
  // segmentador do rodapé. No desktop (>= md) tudo aparece normalmente.
  const desktop = useEhDesktop()
  const [secao, setSecao] = useState('atendimento')
  const segmentos: ItemSegmento[] = [
    { id: 'atendimento', rotulo: 'Atendimento', icone: CalendarCheck },
    ...(podeVerFinanceiro ? [{ id: 'financeiro', rotulo: 'Financeiro', icone: Wallet }] : []),
    { id: 'estoque', rotulo: 'Estoque', icone: Boxes },
  ]
  // No mobile, oculta as seções que não são a ativa.
  const oculto = (id: string) => (!desktop && secao !== id ? 'hidden' : '')

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      <PageHeader
        titulo="Dashboard"
        descricao="Visão geral da clínica."
        acoes={<PeriodoSelector valor={periodo} aoMudar={setPeriodo} />}
      />

      {/* Próximas consultas — em destaque, acima de tudo (seção Atendimento no mobile) */}
      <Card className={oculto('atendimento')}>
        <CardHeader>
          <CardTitle>Próximas consultas</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={colunasConsultas} data={proximasConsultas} />
        </CardContent>
      </Card>

      {/* Atendimento */}
      <section className={cn('space-y-4', oculto('atendimento'))}>
        <SecaoTitulo>Atendimento</SecaoTitulo>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            titulo="Consultas hoje"
            valor="12"
            icone={CalendarCheck}
            variacao={varPeriodo(periodo, { mes: 9, semestre: 14, ano: 22 })}
            legenda={comparacao}
          />
          <KpiCard
            titulo="Taxa de confirmação"
            valor="83%"
            icone={UserCheck}
            variacao={varPeriodo(periodo, { mes: 4, semestre: 6, ano: 9 })}
            legenda={comparacao}
          />
          <KpiCard
            titulo="Pacientes ativos"
            valor="328"
            icone={Users}
            variacao={varPeriodo(periodo, { mes: -2, semestre: 3, ano: 12 })}
            legenda={comparacao}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Consultas por dia</CardTitle>
            </CardHeader>
            <CardContent>
              <ConsultasPorDiaChart />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Consultas por status</CardTitle>
            </CardHeader>
            <CardContent>
              <ConsultasPorStatusChart />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Financeiro — só Gerente/Admin (espelha a matriz; nota 1) */}
      {podeVerFinanceiro && (
        <section className={cn('space-y-4', oculto('financeiro'))}>
          <SecaoTitulo>Financeiro</SecaoTitulo>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              titulo="Contas a receber"
              valor="R$ 18.900"
              icone={Wallet}
              variacao={varPeriodo(periodo, { mes: 6, semestre: 9, ano: 15 })}
              legenda={comparacao}
            />
            <KpiCard
              titulo="Contas a pagar"
              valor="R$ 11.200"
              icone={Receipt}
              variacao={varPeriodo(periodo, { mes: 8, semestre: 5, ano: 11 })}
              legenda={comparacao}
              inverterCor
            />
            <KpiCard
              titulo="Faturamento líquido"
              valor={brl(faturamento.liquido)}
              icone={PiggyBank}
              variacao={varPeriodo(periodo, { mes: 10, semestre: 14, ano: 20 })}
              legenda={comparacao}
            />
            <KpiCard
              titulo="Faturamento bruto"
              valor={brl(faturamento.bruto)}
              icone={DollarSign}
              variacao={varPeriodo(periodo, { mes: 4, semestre: 8, ano: 12 })}
              legenda={comparacao}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Fluxo de caixa (entradas x saídas)</CardTitle>
              </CardHeader>
              <CardContent>
                <FluxoCaixaChart periodo={periodo} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Despesas por categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <DespesasPorCategoriaChart />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Faturamento bruto x líquido</CardTitle>
            </CardHeader>
            <CardContent>
              <FaturamentoChart periodo={periodo} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Estoque e insumos */}
      <section className={cn('space-y-4', oculto('estoque'))}>
        <SecaoTitulo>Estoque e insumos</SecaoTitulo>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            titulo="Itens em estoque"
            valor="1.284"
            icone={Boxes}
            variacao={varPeriodo(periodo, { mes: 3, semestre: 6, ano: 10 })}
            legenda={comparacao}
          />
          <KpiCard
            titulo="Insumos abaixo do mínimo"
            valor="4 itens"
            icone={PackageX}
            variacao={varPeriodo(periodo, { mes: -1, semestre: -3, ano: -2 })}
            legenda={comparacao}
            inverterCor
          />
          <KpiCard
            titulo="Materiais gastos"
            valor="2.880 un."
            icone={Boxes}
            variacao={varPeriodo(periodo, { mes: 7, semestre: 10, ano: 15 })}
            legenda={comparacao}
            inverterCor
          />
          <KpiCard
            titulo="Custo de materiais"
            valor="R$ 12.400"
            icone={Receipt}
            variacao={varPeriodo(periodo, { mes: -5, semestre: -3, ano: 4 })}
            legenda={comparacao}
            inverterCor
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Insumos mais consumidos</CardTitle>
            </CardHeader>
            <CardContent>
              <MateriaisConsumidosChart />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Estoque baixo</CardTitle>
            </CardHeader>
            <CardContent>
              <EstoqueBaixoLista />
            </CardContent>
          </Card>
        </div>
      </section>

      <SegmentadorRodape itens={segmentos} ativo={secao} aoMudar={setSecao} />
    </div>
  )
}
