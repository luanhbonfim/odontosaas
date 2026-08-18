import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConsultaPage } from './consulta-page'

const { paramsMock, navegarMock, consultaMock, salvarMock } = vi.hoisted(() => ({
  paramsMock: vi.fn(),
  navegarMock: vi.fn(),
  consultaMock: vi.fn(),
  salvarMock: vi.fn(),
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const real = await importOriginal<typeof import('react-router-dom')>()
  return { ...real, useParams: paramsMock, useNavigate: () => navegarMock }
})
vi.mock('./use-paciente-detalhe', () => ({
  useConsulta: consultaMock,
  useSalvarFichaConsulta: () => ({ mutateAsync: salvarMock, isPending: false }),
}))

const CONSULTA = {
  id: 1,
  paciente: 5,
  paciente_nome: 'João da Silva',
  dentista: 3,
  dentista_nome: 'Dra. Ana',
  inicio: '2026-07-24T12:00:00Z',
  convenio_nome: null,
  status: 'REALIZADA',
  dentes: [{ dente: 44, procedimento: 'Restauração' }],
  anotacoes: 'Paciente relatou sensibilidade.',
}

function renderPage() {
  render(
    <MemoryRouter>
      <ConsultaPage />
    </MemoryRouter>,
  )
}

describe('ConsultaPage (ficha)', () => {
  afterEach(() => vi.clearAllMocks())

  it('pré-preenche o odontograma e as anotações e salva a ficha', async () => {
    paramsMock.mockReturnValue({ pacienteId: '5', consultaId: '1' })
    consultaMock.mockReturnValue({ data: CONSULTA, isLoading: false })
    salvarMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderPage()

    // Resumo read-only.
    expect(screen.getByText('João da Silva')).toBeInTheDocument()
    expect(screen.getByText('Dra. Ana')).toBeInTheDocument()
    expect(screen.getByText('Particular')).toBeInTheDocument()

    // Odontograma e anotações pré-preenchidos.
    expect(screen.getByRole('button', { name: 'Dente 44' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Procedimento 1')).toHaveValue('Restauração')
    const anotacoes = screen.getByLabelText('Anotações')
    expect(anotacoes).toHaveValue('Paciente relatou sensibilidade.')

    await user.type(anotacoes, ' Orientado retorno.')
    await user.click(screen.getByRole('button', { name: /salvar ficha/i }))

    await waitFor(() => expect(salvarMock).toHaveBeenCalled())
    expect(salvarMock).toHaveBeenCalledWith({
      id: 1,
      dados: {
        dentes: [{ dente: 44, procedimento: 'Restauração' }],
        anotacoes: 'Paciente relatou sensibilidade. Orientado retorno.',
      },
    })
    expect(navegarMock).toHaveBeenCalledWith('/pacientes/5')
  })

  it('"Voltar ao paciente" é um link para a ficha do paciente', () => {
    paramsMock.mockReturnValue({ pacienteId: '5', consultaId: '1' })
    consultaMock.mockReturnValue({ data: CONSULTA, isLoading: false })
    renderPage()
    expect(screen.getByRole('link', { name: /voltar ao paciente/i })).toHaveAttribute(
      'href',
      '/pacientes/5',
    )
  })

  it('consulta cancelada: mostra aviso e não há ficha para preencher', () => {
    paramsMock.mockReturnValue({ pacienteId: '5', consultaId: '1' })
    consultaMock.mockReturnValue({
      data: { ...CONSULTA, status: 'CANCELADA' },
      isLoading: false,
    })
    renderPage()
    expect(screen.getByText(/não há ficha para preencher/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /salvar ficha/i })).toBeNull()
    expect(screen.queryByLabelText('Anotações')).toBeNull()
  })
})
