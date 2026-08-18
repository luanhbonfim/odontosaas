import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DashboardPage } from './dashboard-page'

const { sessaoMock } = vi.hoisted(() => ({ sessaoMock: vi.fn() }))
vi.mock('@/features/auth/use-sessao', () => ({ useSessao: sessaoMock }))

// Gráficos (recharts) mockados: o teste é sobre o gating por papel, não sobre os gráficos.
vi.mock('./charts', () => ({
  ConsultasPorDiaChart: () => <div />,
  ConsultasPorStatusChart: () => <div />,
  FaturamentoChart: () => <div />,
  FluxoCaixaChart: () => <div />,
  DespesasPorCategoriaChart: () => <div />,
  MateriaisConsumidosChart: () => <div />,
}))

function renderComPapel(papel: string) {
  sessaoMock.mockReturnValue({
    usuario: { papel, clinica: { nomeFantasia: 'X' } },
    carregando: false,
    erro: false,
  })
  return render(<DashboardPage />)
}

describe('DashboardPage — seção Financeiro por papel', () => {
  afterEach(() => sessaoMock.mockReset())

  it('esconde a seção Financeiro para a Recepção', () => {
    renderComPapel('RECEPCAO')
    expect(screen.getByText('Atendimento')).toBeInTheDocument()
    expect(screen.queryByText('Financeiro')).not.toBeInTheDocument()
  })

  it('mostra a seção Financeiro para o Admin', () => {
    renderComPapel('ADMIN')
    expect(screen.getByText('Financeiro')).toBeInTheDocument()
  })
})
