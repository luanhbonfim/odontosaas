import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GuiaPage } from './guia-page'

function renderPage() {
  render(
    <MemoryRouter>
      <GuiaPage />
    </MemoryRouter>,
  )
}

const { paramsMock, navegarMock, planosMock, guiaMock, criarMock, atualizarMock } = vi.hoisted(
  () => ({
    paramsMock: vi.fn(),
    navegarMock: vi.fn(),
    planosMock: vi.fn(),
    guiaMock: vi.fn(),
    criarMock: vi.fn(),
    atualizarMock: vi.fn(),
  }),
)
vi.mock('react-router-dom', async (importOriginal) => {
  const real = await importOriginal<typeof import('react-router-dom')>()
  return { ...real, useParams: paramsMock, useNavigate: () => navegarMock }
})
vi.mock('./use-paciente-detalhe', () => ({
  usePlanosDoPaciente: planosMock,
  useGuia: guiaMock,
  useCriarGuia: () => ({ mutateAsync: criarMock }),
  useAtualizarGuia: () => ({ mutateAsync: atualizarMock }),
}))

describe('GuiaPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('nova guia: preenche, seleciona dentes, cria e volta ao paciente', async () => {
    paramsMock.mockReturnValue({ pacienteId: '5' }) // sem guiaId -> nova
    planosMock.mockReturnValue({
      data: [{ id: 7, convenio_nome: 'Amil', numero_carteirinha: '123' }],
    })
    guiaMock.mockReturnValue({ data: undefined })
    criarMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByRole('heading', { name: 'Nova guia' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/plano/i), '7')
    await user.type(screen.getByLabelText(/número/i), 'G-2')
    await user.type(screen.getByLabelText(/valor/i), '250')
    // Sem campo "Procedimento" no formulário — vai direto nos dentes.
    await user.click(screen.getByRole('button', { name: 'Dente 44' }))
    await user.type(screen.getByLabelText('Procedimento 1'), 'Restauração')
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => expect(criarMock).toHaveBeenCalled())
    expect(criarMock).toHaveBeenCalledWith({
      plano: 7,
      numero_guia: 'G-2',
      valor: '250',
      procedimento: 'Dente 44: Restauração', // resumo derivado dos dentes
      dentes: [{ dente: 44, procedimento: 'Restauração' }],
    })
    expect(navegarMock).toHaveBeenCalledWith('/pacientes/5')
  })

  it('editar: pré-preenche do backend (inclusive dentes) e faz PATCH', async () => {
    paramsMock.mockReturnValue({ pacienteId: '5', guiaId: '1' })
    planosMock.mockReturnValue({
      data: [{ id: 7, convenio_nome: 'Amil', numero_carteirinha: '' }],
    })
    guiaMock.mockReturnValue({
      data: {
        id: 1,
        plano: 7,
        numero_guia: 'G-1',
        procedimento: 'Limpeza',
        valor: '100.00',
        dentes: [{ dente: 21, procedimento: 'Canal' }],
        status: 'EMITIDA',
      },
    })
    atualizarMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByRole('heading', { name: 'Editar guia' })).toBeInTheDocument()
    expect(screen.getByLabelText(/número/i)).toHaveValue('G-1')
    expect(screen.getByRole('button', { name: 'Dente 21' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Procedimento 1')).toHaveValue('Canal')
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(atualizarMock).toHaveBeenCalled())
    expect(atualizarMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        dados: expect.objectContaining({ dentes: [{ dente: 21, procedimento: 'Canal' }] }),
      }),
    )
  })

  it('exige ao menos um dente selecionado para salvar', async () => {
    paramsMock.mockReturnValue({ pacienteId: '5' })
    planosMock.mockReturnValue({
      data: [{ id: 7, convenio_nome: 'Amil', numero_carteirinha: '' }],
    })
    guiaMock.mockReturnValue({ data: undefined })
    const user = userEvent.setup()
    renderPage()

    await user.selectOptions(screen.getByLabelText(/plano/i), '7')
    await user.type(screen.getByLabelText(/número/i), 'G-2')
    await user.type(screen.getByLabelText(/valor/i), '250')
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/selecione ao menos um dente/i)).toBeInTheDocument()
    expect(criarMock).not.toHaveBeenCalled()
  })

  it('"Voltar ao paciente" é um link para a ficha (mesmo padrão da ficha)', () => {
    paramsMock.mockReturnValue({ pacienteId: '5' })
    planosMock.mockReturnValue({ data: [] })
    guiaMock.mockReturnValue({ data: undefined })
    renderPage()
    expect(screen.getByRole('link', { name: /voltar ao paciente/i })).toHaveAttribute(
      'href',
      '/pacientes/5',
    )
  })
})
