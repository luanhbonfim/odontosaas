import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BaixasPage } from './baixas-page'

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

describe('BaixasPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista saídas com origem manual/automática e registra uma baixa manual', async () => {
    insumosMock.mockReturnValue({ data: [{ id: 2, nome: 'Resina A2' }] })
    movimentacoesMock.mockReturnValue({
      data: [
        {
          id: 2,
          insumo: 1,
          insumo_nome: 'Gaze',
          tipo: 'SAIDA',
          quantidade: '5.00',
          observacao: 'Quebra',
          consulta: null,
          criado_em: '2026-08-02T12:00:00Z',
        },
        {
          id: 3,
          insumo: 2,
          insumo_nome: 'Resina A2',
          tipo: 'SAIDA',
          quantidade: '1.00',
          observacao: 'Baixa automática — consulta #9',
          consulta: 9,
          criado_em: '2026-08-03T12:00:00Z',
        },
      ],
      isLoading: false,
    })
    criarMovimentacaoMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<BaixasPage />)

    expect(screen.getByRole('heading', { name: 'Baixas' })).toBeInTheDocument()
    expect(movimentacoesMock).toHaveBeenCalledWith('SAIDA')
    const tabela = screen.getByRole('table')
    expect(within(tabela).getByText('Manual')).toBeInTheDocument()
    expect(within(tabela).getByText('Automática (consulta)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /nova baixa/i }))
    await user.selectOptions(screen.getByRole('combobox', { name: /insumo/i }), '2')
    await user.type(screen.getByRole('textbox', { name: /quantidade/i }), '1')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(criarMovimentacaoMock).toHaveBeenCalled())
    expect(criarMovimentacaoMock).toHaveBeenCalledWith(
      expect.objectContaining({ insumo: 2, tipo: 'SAIDA', quantidade: '1' }),
    )
  })
})
