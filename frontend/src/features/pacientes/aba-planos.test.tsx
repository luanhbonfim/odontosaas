import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AbaPlanos } from './aba-planos'

const { planosMock, criarMock, atualizarMock, removerMock, conveniosMock } = vi.hoisted(() => ({
  planosMock: vi.fn(),
  criarMock: vi.fn(),
  atualizarMock: vi.fn(),
  removerMock: vi.fn(),
  conveniosMock: vi.fn(),
}))
vi.mock('./use-paciente-detalhe', () => ({
  usePlanosDoPaciente: planosMock,
  useCriarPlano: () => ({ mutateAsync: criarMock }),
  useAtualizarPlano: () => ({ mutateAsync: atualizarMock }),
  useRemoverPlano: () => ({ mutateAsync: removerMock }),
}))
vi.mock('@/features/convenios/use-convenios', () => ({ useConvenios: conveniosMock }))

const PLANO = {
  id: 1,
  convenio: 1,
  convenio_nome: 'Amil',
  numero_carteirinha: '123',
  validade: null,
  status: 'ATIVO',
}

function renderAba() {
  conveniosMock.mockReturnValue({ data: [{ id: 1, nome: 'Amil', ativo: true }] })
  render(
    <MemoryRouter>
      <AbaPlanos pacienteId={5} />
    </MemoryRouter>,
  )
}

describe('AbaPlanos', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista pelo nome do convênio e mostra "Adicionar plano"', () => {
    planosMock.mockReturnValue({ data: [PLANO], isLoading: false })
    renderAba()
    expect(screen.getByText('Amil')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /adicionar plano/i })).toBeInTheDocument()
  })

  it('adiciona um plano selecionando o convênio', async () => {
    planosMock.mockReturnValue({ data: [], isLoading: false })
    criarMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderAba()

    await user.click(screen.getByRole('button', { name: /adicionar plano/i }))
    await user.selectOptions(screen.getByLabelText(/convênio/i), '1')
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => expect(criarMock).toHaveBeenCalled())
    expect(criarMock).toHaveBeenCalledWith({
      convenio: 1,
      numero_carteirinha: '',
      validade: null,
      status: 'ATIVO',
    })
  })

  it('valida a seleção do convênio', async () => {
    planosMock.mockReturnValue({ data: [], isLoading: false })
    const user = userEvent.setup()
    renderAba()
    await user.click(screen.getByRole('button', { name: /adicionar plano/i }))
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    expect(await screen.findByText('Selecione um convênio')).toBeInTheDocument()
    expect(criarMock).not.toHaveBeenCalled()
  })

  it('edita um plano (pré-seleciona o convênio e faz patch)', async () => {
    planosMock.mockReturnValue({ data: [PLANO], isLoading: false })
    atualizarMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderAba()

    await user.click(screen.getByRole('button', { name: /editar plano amil/i }))
    expect(screen.getByLabelText(/convênio/i)).toHaveValue('1')
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(atualizarMock).toHaveBeenCalled())
    expect(atualizarMock).toHaveBeenCalledWith({
      id: 1,
      dados: { convenio: 1, numero_carteirinha: '123', validade: null, status: 'ATIVO' },
    })
  })

  it('esconde convênio inativo no seletor, mas mantém o já vinculado ao editar', async () => {
    planosMock.mockReturnValue({ data: [PLANO], isLoading: false })
    // Amil (id 1, vinculado ao plano) inativo; Bradesco (id 2) ativo; Uniodonto (id 3) inativo.
    conveniosMock.mockReturnValue({
      data: [
        { id: 1, nome: 'Amil', ativo: false },
        { id: 2, nome: 'Bradesco', ativo: true },
        { id: 3, nome: 'Uniodonto', ativo: false },
      ],
    })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AbaPlanos pacienteId={5} />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: /editar plano amil/i }))
    const select = screen.getByLabelText(/convênio/i)
    expect(within(select).getByRole('option', { name: 'Amil' })).toBeInTheDocument() // vinculado
    expect(within(select).getByRole('option', { name: 'Bradesco' })).toBeInTheDocument() // ativo
    expect(within(select).queryByRole('option', { name: 'Uniodonto' })).toBeNull() // inativo
  })

  it('plano vencido: mostra status "Vencido" e o botão Renovar', () => {
    planosMock.mockReturnValue({
      data: [{ ...PLANO, vencido: true, validade: '2020-01-01' }],
      isLoading: false,
    })
    renderAba()
    expect(screen.getByText('Vencido')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Renovar plano Amil' })).toBeInTheDocument()
    // Vencido não permite editar, apenas renovar.
    expect(screen.queryByRole('button', { name: /editar plano/i })).toBeNull()
  })

  it('renovar um plano vencido define a nova validade e reativa (status ATIVO)', async () => {
    planosMock.mockReturnValue({
      data: [{ ...PLANO, vencido: true, validade: '2020-01-01' }],
      isLoading: false,
    })
    atualizarMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderAba()

    await user.click(screen.getByRole('button', { name: 'Renovar plano Amil' }))
    fireEvent.change(screen.getByLabelText(/nova validade/i), {
      target: { value: '2030-12-31' },
    })
    await user.click(screen.getByRole('button', { name: 'Renovar' }))
    await waitFor(() => expect(atualizarMock).toHaveBeenCalled())
    expect(atualizarMock).toHaveBeenCalledWith({
      id: 1,
      dados: { validade: '2030-12-31', status: 'ATIVO' },
    })
  })

  it('exclui um plano após confirmação', async () => {
    planosMock.mockReturnValue({ data: [PLANO], isLoading: false })
    removerMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderAba()

    await user.click(screen.getByRole('button', { name: /excluir plano amil/i }))
    await user.click(screen.getByRole('button', { name: /^excluir$/i }))
    await waitFor(() => expect(removerMock).toHaveBeenCalledWith(1))
  })
})
