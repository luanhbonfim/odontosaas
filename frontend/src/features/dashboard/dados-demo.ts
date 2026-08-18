import type { VarianteStatus } from '@/components/common/status-badge'

// Dados de amostra do dashboard. Serão substituídos pelos endpoints reais
// (agenda / financeiro) nas sprints seguintes.

export type ConsultaDemo = {
  paciente: string
  telefone: string
  inicio: string
  valor: string
  status: VarianteStatus
  rotulo: string
}

export const consultasPorDia = [
  { dia: 'Seg', confirmadas: 9, pendentes: 3 },
  { dia: 'Ter', confirmadas: 11, pendentes: 2 },
  { dia: 'Qua', confirmadas: 8, pendentes: 4 },
  { dia: 'Qui', confirmadas: 12, pendentes: 1 },
  { dia: 'Sex', confirmadas: 14, pendentes: 3 },
  { dia: 'Sáb', confirmadas: 6, pendentes: 2 },
  { dia: 'Dom', confirmadas: 0, pendentes: 0 },
]

export const consultasPorStatus = [
  { status: 'Confirmadas', total: 68 },
  { status: 'Aguardando', total: 14 },
  { status: 'Realizadas', total: 42 },
  { status: 'Canceladas', total: 8 },
]

export const proximasConsultas: ConsultaDemo[] = [
  {
    paciente: 'Maria Aparecida',
    telefone: '5518997999509',
    inicio: '2026-07-27T12:00:00Z',
    valor: '250.00',
    status: 'sucesso',
    rotulo: 'Confirmada',
  },
  {
    paciente: 'João Batista',
    telefone: '5518988887777',
    inicio: '2026-07-27T13:30:00Z',
    valor: '180.50',
    status: 'pendente',
    rotulo: 'Aguardando',
  },
  {
    paciente: 'Rita de Cássia',
    telefone: '5518977776666',
    inicio: '2026-07-27T15:00:00Z',
    valor: '420.00',
    status: 'info',
    rotulo: 'Realizada',
  },
]

// Financeiro: entradas x saídas (fluxo de caixa) no ano corrente até o mês atual (Jul).
export const fluxoCaixa = [
  { mes: 'Jan', entradas: 28900, saidas: 20100 },
  { mes: 'Fev', entradas: 31200, saidas: 21800 },
  { mes: 'Mar', entradas: 35800, saidas: 24100 },
  { mes: 'Abr', entradas: 33400, saidas: 23500 },
  { mes: 'Mai', entradas: 39900, saidas: 26900 },
  { mes: 'Jun', entradas: 41200, saidas: 27400 },
  { mes: 'Jul', entradas: 42800, saidas: 28600 },
]

// Despesas do mês por categoria (contas pagas).
export const despesasPorCategoria = [
  { categoria: 'Materiais', valor: 12400 },
  { categoria: 'Salários', valor: 9800 },
  { categoria: 'Aluguel', valor: 4200 },
  { categoria: 'Laboratório', valor: 2200 },
]

// Insumos mais consumidos no mês (unidades).
export const materiaisConsumidos = [
  { material: 'Luvas', quantidade: 1200 },
  { material: 'Máscaras', quantidade: 950 },
  { material: 'Anestésico', quantidade: 340 },
  { material: 'Resina', quantidade: 210 },
  { material: 'Brocas', quantidade: 180 },
]

// Itens de estoque abaixo do mínimo.
export const estoqueBaixo = [
  { item: 'Resina A2', atual: 2, minimo: 8 },
  { item: 'Luva M (caixa)', atual: 3, minimo: 10 },
  { item: 'Anestésico Lidocaína', atual: 8, minimo: 20 },
  { item: 'Sugador descartável', atual: 15, minimo: 30 },
]

// Período de visualização do dashboard.
export type Periodo = 'mes' | 'semestre' | 'ano'

export const periodos: { valor: Periodo; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Mês atual' },
  { valor: 'semestre', rotulo: 'Últimos 6 meses' },
  { valor: 'ano', rotulo: 'Anual' },
]

// Rótulo de comparação usado sob cada KPI, conforme o período selecionado.
export const rotuloComparacao: Record<Periodo, string> = {
  mes: 'vs. mês anterior',
  semestre: 'vs. semestre anterior',
  ano: 'vs. ano anterior',
}

/** Recorta o fluxo de caixa conforme o período (1, 6 ou todos os meses do ano). */
export function serieFluxo(periodo: Periodo) {
  if (periodo === 'mes') return fluxoCaixa.slice(-1)
  if (periodo === 'semestre') return fluxoCaixa.slice(-6)
  return fluxoCaixa
}

// Faturamento derivado do fluxo de caixa:
//   bruto   = tudo que entra (receita / contas a receber realizadas)
//   líquido = bruto − o que sai (despesas / contas pagas)
export function serieFaturamento(periodo: Periodo) {
  return serieFluxo(periodo).map((mes) => ({
    mes: mes.mes,
    bruto: mes.entradas,
    liquido: mes.entradas - mes.saidas,
  }))
}

/** Totais de faturamento (soma do período). */
export function resumoFaturamento(periodo: Periodo) {
  const serie = serieFluxo(periodo)
  const bruto = serie.reduce((total, mes) => total + mes.entradas, 0)
  const liquido = serie.reduce((total, mes) => total + (mes.entradas - mes.saidas), 0)
  return { bruto, liquido }
}
