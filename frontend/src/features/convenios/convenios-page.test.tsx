import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConveniosPage } from './convenios-page'

const { conveniosMock, criarMock, atualizarMock, removerMock } = vi.hoisted(() => ({
  conveniosMock: vi.fn(),
  criarMock: vi.fn(),
  atualizarMock: vi.fn(),
  removerMock: vi.fn(),
}))
vi.mock('./use-convenios', () => ({
  useConvenios: conveniosMock,
  useCriarConvenio: () => ({ mutateAsync: criarMock }),
  useAtualizarConvenio: () => ({ mutateAsync: atualizarMock }),
  useRemoverConvenio: () => ({ mutateAsync: removerMock }),
}))

const CONV = { id: 1, nome: 'Amil', ativo: true }

describe('ConveniosPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista os convênios', () => {
    conveniosMock.mockReturnValue({ data: [CONV], isLoading: false, isError: false })
    render(<ConveniosPage />)
    expect(screen.getByText('Amil')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /adicionar convênio/i })).toBeInTheDocument()
  })

  it('adiciona um convênio', async () => {
    conveniosMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    criarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<ConveniosPage />)
    await user.click(screen.getByRole('button', { name: /adicionar convênio/i }))
    await user.type(screen.getByLabelText(/nome/i), 'Bradesco')
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(criarMock).toHaveBeenCalledWith({ nome: 'Bradesco', ativo: true }))
  })

  it('valida nome obrigatório', async () => {
    conveniosMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    const user = userEvent.setup()
    render(<ConveniosPage />)
    await user.click(screen.getByRole('button', { name: /adicionar convênio/i }))
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    expect(await screen.findByText('Informe o nome do convênio')).toBeInTheDocument()
    expect(criarMock).not.toHaveBeenCalled()
  })

  it('exclui um convênio após confirmação', async () => {
    conveniosMock.mockReturnValue({ data: [CONV], isLoading: false, isError: false })
    removerMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<ConveniosPage />)
    await user.click(screen.getByRole('button', { name: /excluir amil/i }))
    await user.click(screen.getByRole('button', { name: /^excluir$/i }))
    await waitFor(() => expect(removerMock).toHaveBeenCalledWith(1))
  })
})
