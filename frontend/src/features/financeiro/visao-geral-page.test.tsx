import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VisaoGeralPage } from './visao-geral-page'

const { fluxoCaixaMock } = vi.hoisted(() => ({ fluxoCaixaMock: vi.fn() }))
vi.mock('./use-lancamentos', () => ({ useFluxoCaixa: fluxoCaixaMock }))
vi.mock('./grafico-resumo-financeiro', () => ({
  GraficoResumoFinanceiro: ({ dados }: { dados: Record<string, number> }) => (
    <div data-testid="grafico">{JSON.stringify(dados)}</div>
  ),
}))

function renderizar() {
  return render(
    <MemoryRouter>
      <VisaoGeralPage />
    </MemoryRouter>,
  )
}

describe('VisaoGeralPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('renderiza os 4 KPIs formatados em moeda, sem skeleton', () => {
    fluxoCaixaMock.mockReturnValue({
      data: {
        a_receber: '1000.00',
        a_pagar: '400.00',
        saldo_previsto: '600.00',
        recebido: '700.00',
        pago: '200.00',
        saldo_realizado: '500.00',
      },
      isLoading: false,
    })
    renderizar()

    expect(screen.getByText('A Receber')).toBeInTheDocument()
    expect(screen.getByText('R$ 1.000,00')).toBeInTheDocument()
    expect(screen.getByText('A Pagar')).toBeInTheDocument()
    expect(screen.getByText('R$ 400,00')).toBeInTheDocument()
    expect(screen.getByText('Recebido')).toBeInTheDocument()
    expect(screen.getByText('R$ 700,00')).toBeInTheDocument()
    expect(screen.getByText('Pago')).toBeInTheDocument()
    expect(screen.getByText('R$ 200,00')).toBeInTheDocument()
  })

  it('passa os totais corretos pro gráfico', () => {
    fluxoCaixaMock.mockReturnValue({
      data: {
        a_receber: '1000.00',
        a_pagar: '400.00',
        saldo_previsto: '600.00',
        recebido: '700.00',
        pago: '200.00',
        saldo_realizado: '500.00',
      },
      isLoading: false,
    })
    renderizar()

    expect(screen.getByTestId('grafico')).toHaveTextContent(
      JSON.stringify({ a_receber: 1000, a_pagar: 400, recebido: 700, pago: 200 }),
    )
  })

  it('mostra 2 atalhos para Contas a Receber e a Pagar', () => {
    fluxoCaixaMock.mockReturnValue({ data: undefined, isLoading: false })
    renderizar()

    expect(screen.getByRole('link', { name: /contas a receber/i })).toHaveAttribute(
      'href',
      '/financeiro/receber',
    )
    expect(screen.getByRole('link', { name: /contas a pagar/i })).toHaveAttribute(
      'href',
      '/financeiro/pagar',
    )
  })

  it('estado de carregamento não quebra a página', () => {
    fluxoCaixaMock.mockReturnValue({ data: undefined, isLoading: true })
    renderizar()
    expect(screen.getByText('Financeiro — Visão Geral')).toBeInTheDocument()
    expect(screen.queryByText('A Receber')).toBeNull()
  })
})
