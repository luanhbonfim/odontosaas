import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LancamentosPage } from './lancamentos-page'

const { insumosMock, movimentacoesMock, criarMovimentacaoMock } = vi.hoisted(() => ({
  insumosMock: vi.fn(),
  movimentacoesMock: vi.fn(),
  criarMovimentacaoMock: vi.fn(),
}))

vi.mock('./use-estoque', () => ({
  useInsumos: insumosMock,
  useMovimentacoesEstoque: movimentacoesMock,
  useCriarMovimentacao: () => ({ mutateAsync: criarMovimentacaoMock }),
}))

describe('LancamentosPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista só entradas (sem coluna de origem) e registra uma nova', async () => {
    insumosMock.mockReturnValue({ data: [{ id: 1, nome: 'Gaze' }] })
    movimentacoesMock.mockReturnValue({
      data: [
        {
          id: 1,
          insumo: 1,
          insumo_nome: 'Gaze',
          tipo: 'ENTRADA',
          quantidade: '20.00',
          observacao: '',
          consulta: null,
          criado_em: '2026-08-01T12:00:00Z',
        },
      ],
      isLoading: false,
    })
    criarMovimentacaoMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<LancamentosPage />)

    expect(screen.getByRole('heading', { name: 'Lançamentos' })).toBeInTheDocument()
    expect(screen.getByText('Gaze')).toBeInTheDocument()
    expect(movimentacoesMock).toHaveBeenCalledWith('ENTRADA')

    await user.click(screen.getByRole('button', { name: /novo lançamento/i }))
    await user.selectOptions(screen.getByRole('combobox', { name: /insumo/i }), '1')
    await user.type(screen.getByRole('textbox', { name: /quantidade/i }), '15')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(criarMovimentacaoMock).toHaveBeenCalled())
    expect(criarMovimentacaoMock).toHaveBeenCalledWith(
      expect.objectContaining({ insumo: 1, tipo: 'ENTRADA', quantidade: '15' }),
    )
  })
})
