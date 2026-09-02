import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FornecedoresPage } from './fornecedores-page'

const { fornecedoresMock, criarMock, atualizarMock, removerMock } = vi.hoisted(() => ({
  fornecedoresMock: vi.fn(),
  criarMock: vi.fn(),
  atualizarMock: vi.fn(),
  removerMock: vi.fn(),
}))
vi.mock('./use-fornecedores', () => ({
  useFornecedores: fornecedoresMock,
  useCriarFornecedor: () => ({ mutateAsync: criarMock }),
  useAtualizarFornecedor: () => ({ mutateAsync: atualizarMock }),
  useRemoverFornecedor: () => ({ mutateAsync: removerMock }),
}))

const FORNECEDOR = { id: 1, nome: 'Dental Center', ativo: true }

describe('FornecedoresPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista os fornecedores', () => {
    fornecedoresMock.mockReturnValue({ data: [FORNECEDOR], isLoading: false, isError: false })
    render(<FornecedoresPage />)
    expect(screen.getByText('Dental Center')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /adicionar fornecedor/i })).toBeInTheDocument()
  })

  it('adiciona um fornecedor', async () => {
    fornecedoresMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    criarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<FornecedoresPage />)
    await user.click(screen.getByRole('button', { name: /adicionar fornecedor/i }))
    await user.type(screen.getByLabelText(/nome/i), 'Distribuidora Odonto')
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() =>
      expect(criarMock).toHaveBeenCalledWith({ nome: 'Distribuidora Odonto', ativo: true }),
    )
  })

  it('valida nome obrigatório', async () => {
    fornecedoresMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    const user = userEvent.setup()
    render(<FornecedoresPage />)
    await user.click(screen.getByRole('button', { name: /adicionar fornecedor/i }))
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    expect(await screen.findByText('Informe o nome do fornecedor')).toBeInTheDocument()
    expect(criarMock).not.toHaveBeenCalled()
  })

  it('exclui um fornecedor após confirmação', async () => {
    fornecedoresMock.mockReturnValue({ data: [FORNECEDOR], isLoading: false, isError: false })
    removerMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<FornecedoresPage />)
    await user.click(screen.getByRole('button', { name: /excluir dental center/i }))
    await user.click(screen.getByRole('button', { name: /^excluir$/i }))
    await waitFor(() => expect(removerMock).toHaveBeenCalledWith(1))
  })
})
