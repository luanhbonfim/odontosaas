import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

import type { Periodo } from './periodos'

type Bruto = components['schemas']['Dashboard']

/** Métrica com variação % (ou p.p.) — `null` quando não há base de comparação. */
export type Metrica = { valor: number; variacao: number | null }

export type DashboardDados = {
  periodo: Periodo
  atendimento: {
    consultas_hoje: Metrica
    taxa_confirmacao: { valor: number | null; variacao: number | null }
    pacientes_ativos: Metrica
    confirmacoes_pendentes: number
    consultas_por_dia: { data: string; dia: string; confirmadas: number; pendentes: number }[]
    consultas_por_status: { status: string; rotulo: string; total: number }[]
    proximas_consultas: {
      id: number
      paciente: string
      telefone: string
      inicio: string
      valor: number
      status: string
      status_confirmacao: string
    }[]
  }
  /** `null` = sem permissão ou módulo desligado no plano (a seção some). */
  financeiro: {
    contas_a_receber: Metrica
    contas_a_pagar: Metrica
    faturamento_bruto: Metrica
    faturamento_liquido: Metrica
    fluxo_caixa: { mes: string; rotulo: string; entradas: number; saidas: number }[]
    despesas_por_categoria: { categoria: string; rotulo: string; valor: number }[]
  } | null
  estoque: {
    itens_em_estoque: Metrica
    insumos_abaixo_minimo: Metrica
    materiais_gastos: Metrica
    custo_de_materiais: Metrica
    materiais_consumidos: { material: string; unidade: string; quantidade: number }[]
    estoque_baixo: { item: string; unidade: string; atual: number; minimo: number }[]
  } | null
}

const num = (valor: string | number) => Number(valor)
const metrica = (m: { valor: string | number; variacao: number | null }): Metrica => ({
  valor: num(m.valor),
  variacao: m.variacao,
})

/** O backend manda dinheiro/quantidade como string decimal (padrão do DRF); o
 * Recharts e os KPIs trabalham com número — converte uma vez, aqui. */
export function adaptarDashboard(bruto: Bruto): DashboardDados {
  const { atendimento, financeiro, estoque } = bruto
  return {
    periodo: bruto.periodo as Periodo,
    atendimento: {
      ...atendimento,
      consultas_hoje: atendimento.consultas_hoje,
      pacientes_ativos: atendimento.pacientes_ativos,
      proximas_consultas: atendimento.proximas_consultas.map((c) => ({ ...c, valor: num(c.valor) })),
    },
    financeiro: financeiro && {
      contas_a_receber: metrica(financeiro.contas_a_receber),
      contas_a_pagar: metrica(financeiro.contas_a_pagar),
      faturamento_bruto: metrica(financeiro.faturamento_bruto),
      faturamento_liquido: metrica(financeiro.faturamento_liquido),
      fluxo_caixa: financeiro.fluxo_caixa.map((m) => ({
        ...m,
        entradas: num(m.entradas),
        saidas: num(m.saidas),
      })),
      despesas_por_categoria: financeiro.despesas_por_categoria.map((d) => ({
        ...d,
        valor: num(d.valor),
      })),
    },
    estoque: estoque && {
      itens_em_estoque: estoque.itens_em_estoque,
      insumos_abaixo_minimo: estoque.insumos_abaixo_minimo,
      materiais_gastos: metrica(estoque.materiais_gastos),
      custo_de_materiais: metrica(estoque.custo_de_materiais),
      materiais_consumidos: estoque.materiais_consumidos.map((m) => ({
        ...m,
        quantidade: num(m.quantidade),
      })),
      estoque_baixo: estoque.estoque_baixo.map((i) => ({
        ...i,
        atual: num(i.atual),
        minimo: num(i.minimo),
      })),
    },
  }
}

/** Números do Dashboard por período. `staleTime: 0` — o painel reflete
 * qualquer mudança feita nas outras telas ao ser reaberto, sem invalidar
 * `['dashboard']` em cada mutation. `placeholderData` evita piscar ao trocar o período. */
export function useDashboard(periodo: Periodo) {
  return useQuery({
    queryKey: ['dashboard', periodo] as const,
    queryFn: async () => (await api.get<Bruto>('/dashboard/', { params: { periodo } })).data,
    select: adaptarDashboard,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
}
