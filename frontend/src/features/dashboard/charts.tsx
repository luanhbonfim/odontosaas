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

import {
  consultasPorDia,
  consultasPorStatus,
  despesasPorCategoria,
  materiaisConsumidos,
  type Periodo,
  serieFaturamento,
  serieFluxo,
} from './dados-demo'

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

const coresStatus = ['var(--chart-3)', 'var(--chart-1)', 'var(--chart-5)', 'var(--destructive)']
const coresDespesas = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-4)', 'var(--chart-5)']

/** Consultas por dia (últimos 7 dias): confirmadas x pendentes. */
export function ConsultasPorDiaChart() {
  return (
    <ResponsiveContainer width="100%" height={260} debounce={DEBOUNCE}>
      <BarChart data={consultasPorDia} barGap={4}>
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

/** Faturamento no período: bruto (área) x líquido (linha). */
export function FaturamentoChart({ periodo }: { periodo: Periodo }) {
  return (
    <ResponsiveContainer width="100%" height={260} debounce={DEBOUNCE}>
      <ComposedChart data={serieFaturamento(periodo)}>
        <defs>
          <linearGradient id="grad-faturamento" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.5} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="mes" tick={eixo} axisLine={false} tickLine={false} />
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

/** Distribuição de consultas por status (rosca). */
export function ConsultasPorStatusChart() {
  return (
    <ResponsiveContainer width="100%" height={260} debounce={DEBOUNCE}>
      <PieChart>
        <Pie
          data={consultasPorStatus}
          dataKey="total"
          nameKey="status"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          stroke="var(--card)"
        >
          {consultasPorStatus.map((item, indice) => (
            <Cell key={item.status} fill={coresStatus[indice % coresStatus.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={estiloTooltip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

/** Fluxo de caixa: entradas x saídas no período. */
export function FluxoCaixaChart({ periodo }: { periodo: Periodo }) {
  return (
    <ResponsiveContainer width="100%" height={260} debounce={DEBOUNCE}>
      <BarChart data={serieFluxo(periodo)} barGap={4}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="mes" tick={eixo} axisLine={false} tickLine={false} />
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

/** Despesas do mês (contas pagas) por categoria. */
export function DespesasPorCategoriaChart() {
  return (
    <ResponsiveContainer width="100%" height={260} debounce={DEBOUNCE}>
      <PieChart>
        <Pie
          data={despesasPorCategoria}
          dataKey="valor"
          nameKey="categoria"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          stroke="var(--card)"
        >
          {despesasPorCategoria.map((item, indice) => (
            <Cell key={item.categoria} fill={coresDespesas[indice % coresDespesas.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={estiloTooltip} formatter={(valor) => formatarMoeda(Number(valor))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

/** Insumos mais consumidos no mês (barras horizontais). */
export function MateriaisConsumidosChart() {
  return (
    <ResponsiveContainer width="100%" height={260} debounce={DEBOUNCE}>
      <BarChart data={materiaisConsumidos} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis type="number" tick={eixo} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="material"
          tick={eixo}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip contentStyle={estiloTooltip} cursor={{ fill: 'var(--accent)', opacity: 0.4 }} />
        <Bar dataKey="quantidade" name="Consumo" fill="var(--chart-4)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
