import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { InsumoDetalhePage } from './insumo-detalhe-page'

const { insumoMock, movimentacoesMock } = vi.hoisted(() => ({
  insumoMock: vi.fn(),
  movimentacoesMock: vi.fn(),
}))

vi.mock('./use-estoque', () => ({
  useInsumo: insumoMock,
  useMovimentacoesEstoque: movimentacoesMock,
}))
vi.mock('./aba-insumos', () => ({
  InsumoFormDrawer: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}))

const INSUMO = {
  id: 2,
  nome: 'Resina A2',
  descricao: '',
  categoria: 1,
  categoria_nome: 'Restauradores',
  unidade: 'CX',
  estoque_minimo: '8.00',
  saldo: '12.00',
  estoque_baixo: false,
  ativo: true,
}

function renderRota() {
  render(
    <MemoryRouter initialEntries={['/estoque/2']}>
      <Routes>
        <Route path="/estoque/:insumoId" element={<InsumoDetalhePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('InsumoDetalhePage', () => {
  it('mostra os dados do insumo na aba Dados', () => {
    insumoMock.mockReturnValue({ data: INSUMO, isLoading: false, isError: false })
    movimentacoesMock.mockReturnValue({ data: [], isLoading: false })
    renderRota()

    expect(screen.getByRole('heading', { name: 'Resina A2' })).toBeInTheDocument()
    expect(screen.getByText('Restauradores')).toBeInTheDocument()
    expect(screen.getByText('12.00')).toBeInTheDocument()
  })

  it('aba Movimentações mostra o histórico com saldo acumulado correto', async () => {
    insumoMock.mockReturnValue({ data: INSUMO, isLoading: false, isError: false })
    movimentacoesMock.mockReturnValue({
      data: [
        {
          id: 1,
          insumo: 2,
          insumo_nome: 'Resina A2',
          tipo: 'ENTRADA',
          subtipo: 'COMPRA',
          quantidade: '20.00',
          observacao: '',
          consulta: null,
          lancamento_financeiro_detalhe: { fornecedor_nome: 'Dental Center' },
          criado_em: '2026-08-01T12:00:00Z',
        },
        {
          id: 2,
          insumo: 2,
          insumo_nome: 'Resina A2',
          tipo: 'SAIDA',
          subtipo: 'AJUSTE',
          quantidade: '8.00',
          observacao: '',
          consulta: null,
          lancamento_financeiro_detalhe: null,
          criado_em: '2026-08-02T12:00:00Z',
        },
      ],
      isLoading: false,
    })
    renderRota()

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Movimentações' }))

    expect(movimentacoesMock).toHaveBeenCalledWith({ insumo: 2 })
    const tabela = screen.getByRole('table')
    expect(tabela).toBeInTheDocument()
    // 20 (entrada) -> saldo 20; -8 (saída) -> saldo 12.
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('insumo não encontrado mostra estado vazio', () => {
    insumoMock.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    movimentacoesMock.mockReturnValue({ data: [], isLoading: false })
    renderRota()

    expect(screen.getByText('Insumo não encontrado')).toBeInTheDocument()
  })
})
