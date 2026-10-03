import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatarMoeda } from '@/lib/utils/format'

import type { DashboardDados } from './use-dashboard'

type Atendimento = DashboardDados['atendimento']
type Financeiro = NonNullable<DashboardDados['financeiro']>
type Estoque = NonNullable<DashboardDados['estoque']>

const eixo = { fill: 'var(--muted-foreground)', fontSize: 12 }
const estiloTooltip = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12,
}
// Debounce evita que o recharts recalcule o SVG a cada frame enquanto o menu
// (des)colapsa — o que causava a animação "travada".
const DEBOUNCE = 200
const emReais = (valor: unknown) => `R$${(Number(valor) / 1000).toFixed(0)}k`

// Cores por CHAVE (não por índice): categorias/status com ordem variável não
// trocam de cor nem repetem quando passam de 4 itens.
const COR_STATUS: Record<string, string> = {
  confirmadas: 'var(--chart-3)',
  aguardando: 'var(--chart-1)',
  em_atendimento: 'var(--chart-2)',
  realizadas: 'var(--chart-4)',
  canceladas: 'var(--destructive)',
  faltaram: 'var(--chart-5)',
}
const COR_CATEGORIA: Record<string, string> = {
  MATERIAIS: 'var(--chart-1)',
  SALARIOS: 'var(--chart-2)',
  ALUGUEL: 'var(--chart-4)',
  LABORATORIO: 'var(--chart-5)',
  OUTRAS: 'var(--chart-3)',
  SEM_CATEGORIA: 'var(--muted-foreground)',
}

function SemDados() {
  return (
    <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      Sem dados no período.
    </p>
  )
}

/** Consultas da semana atual (seg–dom): confirmadas x pendentes. */
export function ConsultasPorDiaChart({ dados }: { dados: Atendimento['consultas_por_dia'] }) {
  return (
    <ResponsiveContainer width="100%" height={260} debounce={DEBOUNCE}>
      <BarChart data={dados} barGap={4}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="dia" tick={eixo} axisLine={false} tickLine={false} />
        <YAxis tick={eixo} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip contentStyle={estiloTooltip} cursor={{ fill: 'var(--accent)', opacity: 0.4 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="confirmadas" name="Confirmadas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="pendentes" name="Pendentes" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Faturamento no período: bruto (área) x líquido (linha), por mês. */
export function FaturamentoChart({ dados }: { dados: Financeiro['fluxo_caixa'] }) {
  const serie = dados.map((m) => ({
    rotulo: m.rotulo,
    bruto: m.entradas,
    liquido: m.entradas - m.saidas,
  }))
  return (
    <ResponsiveContainer width="100%" height={260} debounce={DEBOUNCE}>
      <ComposedChart data={serie}>
        <defs>
          <linearGradient id="grad-faturamento" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.5} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="rotulo" tick={eixo} axisLine={false} tickLine={false} />
        <YAxis tick={eixo} axisLine={false} tickLine={false} width={56} tickFormatter={emReais} />
        <Tooltip contentStyle={estiloTooltip} formatter={(valor) => formatarMoeda(Number(valor))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="bruto"
          name="Bruto"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#grad-faturamento)"
        />
        <Line
          type="monotone"
          dataKey="liquido"
          name="Líquido"
          stroke="var(--chart-3)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Distribuição de consultas por status no período (rosca). */
export function ConsultasPorStatusChart({ dados }: { dados: Atendimento['consultas_por_status'] }) {
  if (dados.every((item) => item.total === 0)) return <SemDados />
  return (
    <ResponsiveContainer width="100%" height={260} debounce={DEBOUNCE}>
      <PieChart>
        <Pie
          data={dados.filter((item) => item.total > 0)}
          dataKey="total"
          nameKey="rotulo"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          stroke="var(--card)"
        >
          {dados
            .filter((item) => item.total > 0)
            .map((item) => (
              <Cell key={item.status} fill={COR_STATUS[item.status] ?? 'var(--muted-foreground)'} />
            ))}
        </Pie>
        <Tooltip contentStyle={estiloTooltip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

/** Fluxo de caixa: entradas x saídas (pagas) por mês. */
export function FluxoCaixaChart({ dados }: { dados: Financeiro['fluxo_caixa'] }) {
  return (
    <ResponsiveContainer width="100%" height={260} debounce={DEBOUNCE}>
      <BarChart data={dados} barGap={4}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="rotulo" tick={eixo} axisLine={false} tickLine={false} />
        <YAxis tick={eixo} axisLine={false} tickLine={false} width={56} tickFormatter={emReais} />
        <Tooltip
          contentStyle={estiloTooltip}
          cursor={{ fill: 'var(--accent)', opacity: 0.4 }}
          formatter={(valor) => formatarMoeda(Number(valor))}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="entradas" name="Entradas" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="saidas" name="Saídas" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Despesas pagas no período por categoria. */
export function DespesasPorCategoriaChart({ dados }: { dados: Financeiro['despesas_por_categoria'] }) {
  if (dados.length === 0) return <SemDados />
  return (
    <ResponsiveContainer width="100%" height={260} debounce={DEBOUNCE}>
      <PieChart>
        <Pie
          data={dados}
          dataKey="valor"
          nameKey="rotulo"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          stroke="var(--card)"
        >
          {dados.map((item) => (
            <Cell key={item.categoria} fill={COR_CATEGORIA[item.categoria] ?? 'var(--muted-foreground)'} />
          ))}
        </Pie>
        <Tooltip contentStyle={estiloTooltip} formatter={(valor) => formatarMoeda(Number(valor))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

/** Insumos mais consumidos no período (barras horizontais). */
export function MateriaisConsumidosChart({ dados }: { dados: Estoque['materiais_consumidos'] }) {
  if (dados.length === 0) return <SemDados />
  return (
    <ResponsiveContainer width="100%" height={260} debounce={DEBOUNCE}>
      <BarChart data={dados} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis type="number" tick={eixo} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="material"
          tick={eixo}
          axisLine={false}
          tickLine={false}
          width={96}
        />
        <Tooltip contentStyle={estiloTooltip} cursor={{ fill: 'var(--accent)', opacity: 0.4 }} />
        <Bar dataKey="quantidade" name="Consumo" fill="var(--chart-4)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
