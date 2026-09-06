import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AvisosPage } from './avisos-page'

const { avisosMock, criarMock, atualizarMock, deletarMock } = vi.hoisted(() => ({
  avisosMock: vi.fn(),
  criarMock: vi.fn(),
  atualizarMock: vi.fn(),
  deletarMock: vi.fn(),
}))
vi.mock('./use-vendor-avisos', () => ({
  useVendorAvisos: avisosMock,
  useCriarAviso: () => ({ mutateAsync: criarMock }),
  useAtualizarAviso: () => ({ mutateAsync: atualizarMock }),
  useDeletarAviso: () => ({ mutate: deletarMock }),
}))

const AVISO = {
  id: 1,
  titulo: 'Novo módulo de Estoque',
  descricao: '',
  imagem_url: '',
  icone: 'megafone',
  link_url: '',
  link_rotulo: '',
  publicado_em: '2026-08-01',
  dias_visibilidade: 7,
  ordem: 0,
  ativo: true,
  criado_em: '2026-08-01T00:00:00Z',
  vigente_ate: '2026-08-08',
}

describe('AvisosPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista os avisos com datas de publicação e vigência', () => {
    avisosMock.mockReturnValue({ data: [AVISO], isLoading: false })
    render(<AvisosPage />)
    expect(screen.getByText('Novo módulo de Estoque')).toBeInTheDocument()
    expect(screen.getByText('01/08/2026')).toBeInTheDocument()
    expect(screen.getByText('08/08/2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /novo aviso/i })).toBeInTheDocument()
  })

  it('cria um novo aviso', async () => {
    avisosMock.mockReturnValue({ data: [], isLoading: false })
    criarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<AvisosPage />)

    await user.click(screen.getByRole('button', { name: /novo aviso/i }))
    await user.type(screen.getByLabelText(/^título/i), 'Nova tela de Fornecedores')
    await user.click(screen.getByRole('button', { name: /salvar aviso/i }))

    await waitFor(() =>
      expect(criarMock).toHaveBeenCalledWith(
        expect.objectContaining({ titulo: 'Nova tela de Fornecedores', dias_visibilidade: 7 }),
      ),
    )
  })

  it('exclui um aviso após confirmação', async () => {
    avisosMock.mockReturnValue({ data: [AVISO], isLoading: false })
    const user = userEvent.setup()
    render(<AvisosPage />)

    await user.click(screen.getByRole('button', { name: /excluir aviso/i }))
    await user.click(screen.getByRole('button', { name: /^excluir$/i }))
    expect(deletarMock).toHaveBeenCalledWith(1, expect.anything())
  })
})
