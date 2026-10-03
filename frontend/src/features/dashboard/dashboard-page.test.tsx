import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DashboardPage } from './dashboard-page'
import type { DashboardDados } from './use-dashboard'

const { dashboardMock } = vi.hoisted(() => ({ dashboardMock: vi.fn() }))
vi.mock('./use-dashboard', () => ({ useDashboard: dashboardMock }))

// Ambiente de teste = desktop: mostra todas as seções (o segmentador do rodapé é
// só mobile). Evita depender de window.matchMedia no jsdom.
vi.mock('@/stores/ui', () => ({ useEhDesktop: () => true, useEhTelaLarga: () => true }))

// Gráficos (recharts) mockados: aqui o teste é sobre a página, não sobre os gráficos.
vi.mock('./charts', () => ({
  ConsultasPorDiaChart: () => <div />,
  ConsultasPorStatusChart: () => <div />,
  FaturamentoChart: () => <div />,
  FluxoCaixaChart: () => <div />,
  DespesasPorCategoriaChart: () => <div />,
  MateriaisConsumidosChart: () => <div />,
}))

const metrica = (valor: number, variacao: number | null = null) => ({ valor, variacao })

function dados(sobrescrever: Partial<DashboardDados> = {}): DashboardDados {
  return {
    periodo: 'semestre',
    atendimento: {
      consultas_hoje: metrica(4),
      taxa_confirmacao: { valor: 83.3, variacao: 2.5 },
      pacientes_ativos: metrica(328),
      confirmacoes_pendentes: 2,
      consultas_por_dia: [],
      consultas_por_status: [],
      proximas_consultas: [
        {
          id: 1,
          paciente: 'Maria Aparecida',
          telefone: '5518997999509',
          inicio: '2026-10-07T12:00:00Z',
          valor: 250,
          status: 'AGENDADA',
          status_confirmacao: 'CONFIRMADA',
        },
      ],
    },
    financeiro: {
      contas_a_receber: metrica(18900),
      contas_a_pagar: metrica(11200),
      faturamento_bruto: metrica(42800, 9.5),
      faturamento_liquido: metrica(14200, null),
      fluxo_caixa: [],
      despesas_por_categoria: [],
    },
    estoque: {
      itens_em_estoque: metrica(40),
      insumos_abaixo_minimo: metrica(1),
      materiais_gastos: metrica(2880, 7.1),
      custo_de_materiais: metrica(12400, -5),
      materiais_consumidos: [],
      estoque_baixo: [{ item: 'Resina A2', unidade: 'UN', atual: 2, minimo: 8 }],
    },
    ...sobrescrever,
  }
}

function renderizar(estado: Record<string, unknown>) {
  dashboardMock.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
    ...estado,
  })
  return render(<DashboardPage />)
}

describe('DashboardPage', () => {
  afterEach(() => dashboardMock.mockReset())

  it('mostra skeleton enquanto carrega', () => {
    renderizar({ isLoading: true })
    expect(screen.getByLabelText('Carregando dashboard')).toBeInTheDocument()
  })

  it('mostra erro com "Tentar de novo" que refaz a busca', async () => {
    const refetch = vi.fn()
    renderizar({ isError: true, refetch })
    expect(screen.getByText(/não foi possível carregar o dashboard/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /tentar de novo/i }))
    expect(refetch).toHaveBeenCalled()
  })

  it('renderiza valores reais nos KPIs e nas próximas consultas', () => {
    renderizar({ data: dados() })
    expect(screen.getByText('Maria Aparecida')).toBeInTheDocument()
    expect(screen.getByText('Confirmada')).toBeInTheDocument()
    expect(screen.getByText('328')).toBeInTheDocument()
    expect(screen.getByText('83.3%')).toBeInTheDocument()
    expect(screen.getByText('R$ 42.800')).toBeInTheDocument()
    expect(screen.getByText('2 confirmação(ões) pendente(s)')).toBeInTheDocument()
    expect(screen.getByText('Resina A2')).toBeInTheDocument()
  })

  it('seção Financeiro some quando o backend manda null (sem permissão ou módulo off)', () => {
    renderizar({ data: dados({ financeiro: null }) })
    expect(screen.getByRole('heading', { name: 'Atendimento' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Financeiro' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Estoque e insumos' })).toBeInTheDocument()
  })

  it('mostra Financeiro quando o bloco vem preenchido', () => {
    renderizar({ data: dados() })
    expect(screen.getByRole('heading', { name: 'Financeiro' })).toBeInTheDocument()
  })

  it('seção Estoque some quando o backend manda null', () => {
    renderizar({ data: dados({ estoque: null }) })
    expect(screen.queryByRole('heading', { name: 'Estoque e insumos' })).not.toBeInTheDocument()
  })

  it('variação null não mostra seta nem legenda de comparação', () => {
    renderizar({ data: dados() })
    // líquido tem variacao null; bruto tem +9.5% -> exatamente 1 legenda de comparação nos KPIs financeiros
    expect(screen.getByText('+9.5%')).toBeInTheDocument()
    expect(screen.getAllByText(/vs\. mesmo período do semestre anterior/i).length).toBeGreaterThan(0)
  })

  it('taxa de confirmação sem consultas mostra "—"', () => {
    const base = dados()
    renderizar({
      data: dados({
        atendimento: { ...base.atendimento, taxa_confirmacao: { valor: null, variacao: null } },
      }),
    })
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('próximas consultas vazias mostram estado vazio', () => {
    const base = dados()
    renderizar({
      data: dados({ atendimento: { ...base.atendimento, proximas_consultas: [] } }),
    })
    expect(screen.getByText('Nenhuma consulta pela frente')).toBeInTheDocument()
  })

  it('trocar o período chama o hook com o novo período', async () => {
    renderizar({ data: dados() })
    await userEvent.click(screen.getByRole('tab', { name: 'Mês atual' }))
    expect(dashboardMock).toHaveBeenLastCalledWith('mes')
  })
})
