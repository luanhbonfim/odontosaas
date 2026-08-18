import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DentistaFormDrawer } from './dentista-form-drawer'

const { criarMock, atualizarMock } = vi.hoisted(() => ({
  criarMock: vi.fn(),
  atualizarMock: vi.fn(),
}))
vi.mock('./use-dentistas', () => ({
  useEspecialidades: () => ({
    data: [
      { id: 1, nome: 'Ortodontia' },
      { id: 2, nome: 'Endodontia' },
    ],
  }),
  useCriarDentista: () => ({ mutateAsync: criarMock }),
  useAtualizarDentista: () => ({ mutateAsync: atualizarMock }),
}))

async function abrir() {
  const user = userEvent.setup()
  render(<DentistaFormDrawer trigger={<button>Abrir</button>} />)
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  await screen.findByText('Novo dentista')
  return user
}

describe('DentistaFormDrawer', () => {
  afterEach(() => vi.clearAllMocks())

  it('valida campos obrigatórios', async () => {
    const user = await abrir()
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    expect(await screen.findByText('Informe o nome')).toBeInTheDocument()
    expect(screen.getByText('Informe o CRO')).toBeInTheDocument()
    expect(criarMock).not.toHaveBeenCalled()
  })

  it('cria o dentista com os dados do formulário', async () => {
    criarMock.mockResolvedValue({})
    const user = await abrir()
    await user.type(screen.getByLabelText(/nome/i), 'Dra. Ana')
    await user.type(screen.getByLabelText(/cro/i), 'SP-9')
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(criarMock).toHaveBeenCalled())
    expect(criarMock).toHaveBeenCalledWith(
      expect.objectContaining({ nome_completo: 'Dra. Ana', cro: 'SP-9' }),
    )
  })

  it('reflete o erro de CRO duplicado do backend inline', async () => {
    criarMock.mockRejectedValue({
      status: 400,
      mensagem: 'inválido',
      campos: { cro: ['CRO já cadastrado'] },
    })
    const user = await abrir()
    await user.type(screen.getByLabelText(/nome/i), 'Dra. Ana')
    await user.type(screen.getByLabelText(/cro/i), 'SP-111')
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    expect(await screen.findByText('CRO já cadastrado')).toBeInTheDocument()
  })
})
