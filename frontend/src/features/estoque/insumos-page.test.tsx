import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InsumosPage } from './insumos-page'

const renderRota = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

const { categoriasMock, insumosMock, criarInsumoMock } = vi.hoisted(() => ({
  categoriasMock: vi.fn(),
  insumosMock: vi.fn(),
  criarInsumoMock: vi.fn(),
}))

vi.mock('./use-estoque', () => ({
  useCategoriasInsumo: categoriasMock,
  useInsumos: insumosMock,
  useCriarInsumo: () => ({ mutateAsync: criarInsumoMock }),
  useAtualizarInsumo: () => ({ mutateAsync: vi.fn() }),
  useRemoverInsumo: () => ({ mutateAsync: vi.fn() }),
}))

const INSUMO_OK = {
  id: 1,
  nome: 'Gaze',
  categoria: null,
  categoria_nome: null,
  unidade: 'PC',
  estoque_minimo: '5.00',
  saldo: '20.00',
  estoque_baixo: false,
  ativo: true,
}
const INSUMO_BAIXO = {
  id: 2,
  nome: 'Resina A2',
  categoria: 1,
  categoria_nome: 'Restauradores',
  unidade: 'UN',
  estoque_minimo: '8.00',
  saldo: '2.00',
  estoque_baixo: true,
  ativo: true,
}

describe('InsumosPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista com saldo e badge de estoque baixo', () => {
    categoriasMock.mockReturnValue({ data: [], isLoading: false })
    insumosMock.mockReturnValue({ data: [INSUMO_OK, INSUMO_BAIXO], isLoading: false })
    renderRota(<InsumosPage />)
    expect(screen.getByRole('heading', { name: 'Insumos' })).toBeInTheDocument()
    expect(screen.getByText('Gaze')).toBeInTheDocument()
    expect(screen.getByText('Resina A2')).toBeInTheDocument()
    expect(screen.getByText('Estoque baixo')).toBeInTheDocument()
  })

  it('cria um insumo novo', async () => {
    categoriasMock.mockReturnValue({ data: [], isLoading: false })
    insumosMock.mockReturnValue({ data: [], isLoading: false })
    criarInsumoMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderRota(<InsumosPage />)

    await user.click(screen.getByRole('button', { name: /novo insumo/i }))
    await user.type(screen.getByLabelText(/nome/i), 'Anestésico Lidocaína')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(criarInsumoMock).toHaveBeenCalled())
    expect(criarInsumoMock).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'Anestésico Lidocaína', unidade: 'UN' }),
    )
  })
})
