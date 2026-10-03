import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'

import { adaptarDashboard, useDashboard } from './use-dashboard'

vi.mock('@/lib/api/client', () => ({ api: { get: vi.fn() } }))

const BRUTO = {
  periodo: 'mes',
  atendimento: {
    consultas_hoje: { valor: 3, variacao: null },
    taxa_confirmacao: { valor: 80, variacao: 1.5 },
    pacientes_ativos: { valor: 10, variacao: null },
    confirmacoes_pendentes: 1,
    consultas_por_dia: [],
    consultas_por_status: [],
    proximas_consultas: [
      {
        id: 1,
        paciente: 'Ana',
        telefone: '',
        inicio: '2026-10-07T12:00:00Z',
        valor: '250.00',
        status: 'AGENDADA',
        status_confirmacao: 'PENDENTE',
      },
    ],
  },
  financeiro: {
    contas_a_receber: { valor: '30.00', variacao: null },
    contas_a_pagar: { valor: '0.00', variacao: null },
    faturamento_bruto: { valor: '100.00', variacao: 100 },
    faturamento_liquido: { valor: '50.00', variacao: 0 },
    fluxo_caixa: [{ mes: '2026-10', rotulo: 'Out', entradas: '100.00', saidas: '50.00' }],
    despesas_por_categoria: [{ categoria: 'MATERIAIS', rotulo: 'Materiais', valor: '40.00' }],
  },
  estoque: {
    itens_em_estoque: { valor: 2, variacao: null },
    insumos_abaixo_minimo: { valor: 1, variacao: null },
    materiais_gastos: { valor: '3.00', variacao: null },
    custo_de_materiais: { valor: '40.00', variacao: null },
    materiais_consumidos: [{ material: 'Luva', unidade: 'UN', quantidade: '3.00' }],
    estoque_baixo: [{ item: 'Luva', unidade: 'UN', atual: '7.00', minimo: '10.00' }],
  },
}

function criarWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('adaptarDashboard', () => {
  it('converte dinheiro/quantidade de string para número', () => {
    const dados = adaptarDashboard(BRUTO as never)
    expect(dados.atendimento.proximas_consultas[0].valor).toBe(250)
    expect(dados.financeiro?.faturamento_bruto).toEqual({ valor: 100, variacao: 100 })
    expect(dados.financeiro?.fluxo_caixa[0]).toMatchObject({ entradas: 100, saidas: 50 })
    expect(dados.financeiro?.despesas_por_categoria[0].valor).toBe(40)
    expect(dados.estoque?.materiais_gastos.valor).toBe(3)
    expect(dados.estoque?.estoque_baixo[0]).toMatchObject({ atual: 7, minimo: 10 })
    expect(dados.estoque?.materiais_consumidos[0].quantidade).toBe(3)
  })

  it('preserva null de variação e de blocos sem permissão', () => {
    const dados = adaptarDashboard({ ...BRUTO, financeiro: null, estoque: null } as never)
    expect(dados.financeiro).toBeNull()
    expect(dados.estoque).toBeNull()
    expect(dados.atendimento.consultas_hoje.variacao).toBeNull()
  })
})

describe('useDashboard', () => {
  it('chama GET /dashboard/ com o período e devolve os dados adaptados', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: BRUTO })
    const { result } = renderHook(() => useDashboard('mes'), { wrapper: criarWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/dashboard/', { params: { periodo: 'mes' } })
    expect(result.current.data?.financeiro?.contas_a_receber.valor).toBe(30)
  })

  it('propaga erro da API', async () => {
    vi.mocked(api.get).mockRejectedValue({ mensagem: 'falhou' })
    const { result } = renderHook(() => useDashboard('ano'), { wrapper: criarWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
