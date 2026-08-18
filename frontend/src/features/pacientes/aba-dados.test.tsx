import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AbaDados } from './aba-dados'

const { criarMock, atualizarMock, navegarMock, papelMock } = vi.hoisted(() => ({
  criarMock: vi.fn(),
  atualizarMock: vi.fn(),
  navegarMock: vi.fn(),
  papelMock: { papel: 'ADMIN' as string },
}))
vi.mock('./use-pacientes', () => ({
  useCriarPaciente: () => ({ mutateAsync: criarMock }),
  useAtualizarPaciente: () => ({ mutateAsync: atualizarMock }),
}))
vi.mock('@/features/dentistas/use-dentistas', () => ({
  useDentistas: () => ({
    data: [
      { id: 3, nome_completo: 'Dra. Ana' },
      { id: 5, nome_completo: 'Dra. Bea' },
    ],
  }),
}))
vi.mock('@/features/auth/use-sessao', () => ({
  useSessao: () => ({ usuario: { papel: papelMock.papel } }),
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const real = await importOriginal<typeof import('react-router-dom')>()
  return { ...real, useNavigate: () => navegarMock }
})

function renderAba(props: { paciente?: Record<string, unknown>; modoCriacao: boolean }) {
  render(
    <MemoryRouter>
      <AbaDados paciente={props.paciente as never} modoCriacao={props.modoCriacao} />
    </MemoryRouter>,
  )
}

describe('AbaDados', () => {
  afterEach(() => {
    vi.clearAllMocks()
    papelMock.papel = 'ADMIN'
  })

  it('cria o paciente com o dentista responsável e navega para a ficha', async () => {
    criarMock.mockResolvedValue({ id: 42 })
    const user = userEvent.setup()
    renderAba({ modoCriacao: true })

    await user.type(screen.getByLabelText(/nome/i), 'João')
    await user.type(screen.getByLabelText(/cpf/i), '11122233344')
    await user.selectOptions(screen.getByLabelText(/dentista responsável/i), '3')
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => expect(criarMock).toHaveBeenCalled())
    expect(criarMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nome_completo: 'João',
        cpf: '11122233344',
        dentista_responsavel: 3,
      }),
    )
    expect(navegarMock).toHaveBeenCalledWith('/pacientes/42')
  })

  it('compartilha com outros dentistas (o responsável não é opção)', async () => {
    criarMock.mockResolvedValue({ id: 7 })
    const user = userEvent.setup()
    renderAba({ modoCriacao: true })

    await user.type(screen.getByLabelText(/nome/i), 'João')
    await user.type(screen.getByLabelText(/cpf/i), '11122233344')
    await user.selectOptions(screen.getByLabelText(/dentista responsável/i), '3')

    const compartilhar = screen.getByLabelText(/compartilhado com/i)
    // A responsável (Dra. Ana) não aparece como opção de compartilhamento.
    expect(within(compartilhar).queryByRole('option', { name: 'Dra. Ana' })).toBeNull()

    await user.selectOptions(compartilhar, '5')
    // Vira um chip removível.
    expect(screen.getByRole('button', { name: 'Remover Dra. Bea' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(criarMock).toHaveBeenCalled())
    expect(criarMock).toHaveBeenCalledWith(
      expect.objectContaining({ dentista_responsavel: 3, dentistas_compartilhados: [5] }),
    )
  })

  it('esconde responsável e compartilhamento para o dentista comum', () => {
    papelMock.papel = 'DENTISTA'
    renderAba({ modoCriacao: true })
    // O backend ignora esses campos para o dentista comum (auto-atribuição).
    expect(screen.queryByLabelText(/dentista responsável/i)).toBeNull()
    expect(screen.queryByLabelText(/compartilhado com/i)).toBeNull()
    // O restante do formulário continua disponível.
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument()
  })

  it('valida o CPF', async () => {
    const user = userEvent.setup()
    renderAba({ modoCriacao: true })
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    expect(await screen.findByText('CPF deve ter 11 dígitos')).toBeInTheDocument()
    expect(criarMock).not.toHaveBeenCalled()
  })

  it('edição pré-carrega os dados (sem responsável definido)', async () => {
    const paciente = { id: 5, nome_completo: 'Maria', cpf: '98765432100', ativo: true }
    const user = userEvent.setup()
    renderAba({ paciente, modoCriacao: false })

    await user.click(screen.getByRole('button', { name: /editar/i }))
    expect(screen.getByLabelText(/nome/i)).toHaveValue('Maria')
    expect(screen.getByLabelText(/dentista responsável/i)).toHaveValue('')
  })
})
