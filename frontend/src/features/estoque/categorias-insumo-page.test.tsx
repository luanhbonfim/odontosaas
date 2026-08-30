import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CategoriasInsumoPage } from './categorias-insumo-page'

const { categoriasMock, criarCategoriaMock } = vi.hoisted(() => ({
  categoriasMock: vi.fn(),
  criarCategoriaMock: vi.fn(),
}))

vi.mock('./use-estoque', () => ({
  useCategoriasInsumo: categoriasMock,
  useCriarCategoriaInsumo: () => ({ mutateAsync: criarCategoriaMock }),
  useAtualizarCategoriaInsumo: () => ({ mutateAsync: vi.fn() }),
  useRemoverCategoriaInsumo: () => ({ mutateAsync: vi.fn() }),
}))

describe('CategoriasInsumoPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista as categorias', () => {
    categoriasMock.mockReturnValue({ data: [{ id: 1, nome: 'Restauradores', ativo: true }], isLoading: false })
    render(<CategoriasInsumoPage />)
    expect(screen.getByRole('heading', { name: 'Categorias' })).toBeInTheDocument()
    expect(screen.getByText('Restauradores')).toBeInTheDocument()
  })

  it('cria uma categoria nova', async () => {
    categoriasMock.mockReturnValue({ data: [], isLoading: false })
    criarCategoriaMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<CategoriasInsumoPage />)

    await user.click(screen.getByRole('button', { name: /nova categoria/i }))
    await user.type(screen.getByLabelText(/nome/i), 'Anestésicos')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() =>
      expect(criarCategoriaMock).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Anestésicos' })),
    )
  })
})
