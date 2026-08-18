import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProcedimentosPage } from './procedimentos-page'

const { procedimentosMock, criarMock, atualizarMock, removerMock } = vi.hoisted(() => ({
  procedimentosMock: vi.fn(),
  criarMock: vi.fn(),
  atualizarMock: vi.fn(),
  removerMock: vi.fn(),
}))
vi.mock('./use-procedimentos', () => ({
  useProcedimentos: procedimentosMock,
  useCriarProcedimento: () => ({ mutateAsync: criarMock }),
  useAtualizarProcedimento: () => ({ mutateAsync: atualizarMock }),
  useRemoverProcedimento: () => ({ mutateAsync: removerMock }),
}))

const PROC = { id: 1, nome: 'Limpeza', ativo: true }

describe('ProcedimentosPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista os procedimentos', () => {
    procedimentosMock.mockReturnValue({ data: [PROC], isLoading: false, isError: false })
    render(<ProcedimentosPage />)
    expect(screen.getByText('Limpeza')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /adicionar procedimento/i })).toBeInTheDocument()
  })

  it('adiciona um procedimento', async () => {
    procedimentosMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    criarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<ProcedimentosPage />)
    await user.click(screen.getByRole('button', { name: /adicionar procedimento/i }))
    await user.type(screen.getByLabelText(/nome/i), 'Canal')
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(criarMock).toHaveBeenCalledWith({ nome: 'Canal', ativo: true }))
  })

  it('valida nome obrigatório', async () => {
    procedimentosMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    const user = userEvent.setup()
    render(<ProcedimentosPage />)
    await user.click(screen.getByRole('button', { name: /adicionar procedimento/i }))
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    expect(await screen.findByText('Informe o nome do procedimento')).toBeInTheDocument()
    expect(criarMock).not.toHaveBeenCalled()
  })

  it('exclui um procedimento após confirmação', async () => {
    procedimentosMock.mockReturnValue({ data: [PROC], isLoading: false, isError: false })
    removerMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<ProcedimentosPage />)
    await user.click(screen.getByRole('button', { name: /excluir limpeza/i }))
    await user.click(screen.getByRole('button', { name: /^excluir$/i }))
    await waitFor(() => expect(removerMock).toHaveBeenCalledWith(1))
  })
})
