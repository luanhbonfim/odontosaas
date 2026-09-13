import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatarMoeda } from '@/lib/utils/format'

const eixo = { fill: 'var(--muted-foreground)', fontSize: 12 }
const estiloTooltip = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12,
}
// Debounce evita que o recharts recalcule o SVG a cada frame enquanto o menu
// (des)colapsa — mesmo ajuste já usado nos gráficos do Dashboard.
const DEBOUNCE = 200
const emReais = (valor: unknown) => `R$${(Number(valor) / 1000).toFixed(0)}k`

export type ResumoFinanceiro = {
  a_receber: number
  a_pagar: number
  recebido: number
  pago: number
}

/** Previsto (a receber x a pagar) x Realizado (recebido x pago) — só totais
 * agregados (o backend não tem série mensal); NÃO é o FluxoCaixaChart do
 * Dashboard, que exige série por mês. */
export function GraficoResumoFinanceiro({ dados }: { dados: ResumoFinanceiro }) {
  const serie = [
    { nome: 'Previsto', receber: dados.a_receber, pagar: dados.a_pagar },
    { nome: 'Realizado', receber: dados.recebido, pagar: dados.pago },
  ]

  return (
    <ResponsiveContainer width="100%" height={260} debounce={DEBOUNCE}>
      <BarChart data={serie} barGap={4}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="nome" tick={eixo} axisLine={false} tickLine={false} />
        <YAxis tick={eixo} axisLine={false} tickLine={false} tickFormatter={emReais} width={48} />
        <Tooltip
          contentStyle={estiloTooltip}
          cursor={{ fill: 'var(--accent)', opacity: 0.4 }}
          formatter={(valor) => formatarMoeda(Number(valor))}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="receber" name="A receber / Recebido" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="pagar" name="A pagar / Pago" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
