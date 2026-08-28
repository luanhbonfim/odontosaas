import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FichaPage } from './ficha-page'

const { fichaMock, fichasMock, consultasMock, criarMock, atualizarMock } = vi.hoisted(() => ({
  fichaMock: vi.fn(),
  fichasMock: vi.fn(),
  consultasMock: vi.fn(),
  criarMock: vi.fn(),
  atualizarMock: vi.fn(),
}))

vi.mock('./use-paciente-detalhe', () => ({
  useFicha: fichaMock,
  useFichasDoPaciente: fichasMock,
  useConsultasDoPaciente: consultasMock,
  useCriarFicha: () => ({ mutateAsync: criarMock, isPending: false }),
  useAtualizarFicha: () => ({ mutateAsync: atualizarMock, isPending: false }),
}))

function renderRota(entrada: string) {
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path="/pacientes/:pacienteId/fichas/nova" element={<FichaPage />} />
        <Route path="/pacientes/:pacienteId/fichas/:fichaId" element={<FichaPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('FichaPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('cria uma ficha avulsa (sem consulta)', async () => {
    fichaMock.mockReturnValue({ data: undefined, isLoading: false })
    fichasMock.mockReturnValue({ data: [] })
    consultasMock.mockReturnValue({ data: [] })
    criarMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderRota('/pacientes/5/fichas/nova')

    expect(screen.getByRole('heading', { name: 'Nova ficha' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Anotações'), 'Avaliação inicial')
    await user.click(screen.getByRole('button', { name: /salvar ficha/i }))

    await waitFor(() => expect(criarMock).toHaveBeenCalled())
    expect(criarMock).toHaveBeenCalledWith(
      expect.objectContaining({ paciente: 5, consulta: null, anotacoes: 'Avaliação inicial' }),
    )
  })

  it('cria uma ficha vinculada a uma consulta selecionada', async () => {
    fichaMock.mockReturnValue({ data: undefined, isLoading: false })
    fichasMock.mockReturnValue({ data: [] })
    consultasMock.mockReturnValue({
      data: [{ id: 10, inicio: '2026-08-10T13:00:00Z', procedimento: 'Limpeza' }],
    })
    criarMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderRota('/pacientes/5/fichas/nova')

    await user.selectOptions(screen.getByLabelText(/consulta vinculada/i), '10')
    await user.click(screen.getByRole('button', { name: /salvar ficha/i }))

    await waitFor(() => expect(criarMock).toHaveBeenCalled())
    expect(criarMock).toHaveBeenCalledWith(expect.objectContaining({ consulta: 10 }))
  })

  it('não lista consultas já vinculadas a outra ficha', () => {
    fichaMock.mockReturnValue({ data: undefined, isLoading: false })
    fichasMock.mockReturnValue({ data: [{ id: 1, consulta: 10 }] })
    consultasMock.mockReturnValue({
      data: [
        { id: 10, inicio: '2026-08-10T13:00:00Z', procedimento: 'Limpeza' },
        { id: 11, inicio: '2026-08-11T13:00:00Z', procedimento: 'Canal' },
      ],
    })
    renderRota('/pacientes/5/fichas/nova')

    const select = screen.getByLabelText(/consulta vinculada/i)
    expect(within(select).queryByText(/Canal/)).toBeInTheDocument()
    expect(within(select).queryByText(/Limpeza/)).toBeNull()
  })

  it('edição pré-preenche odontograma, anotações e consulta vinculada', () => {
    fichaMock.mockReturnValue({
      data: {
        id: 3,
        paciente: 5,
        consulta: 10,
        dentes: [{ dente: 44, procedimento: 'Restauração' }],
        anotacoes: 'Nota X',
      },
      isLoading: false,
    })
    fichasMock.mockReturnValue({ data: [{ id: 3, consulta: 10 }] })
    consultasMock.mockReturnValue({
      data: [{ id: 10, inicio: '2026-08-10T13:00:00Z', procedimento: 'Limpeza' }],
    })
    renderRota('/pacientes/5/fichas/3')

    expect(screen.getByRole('heading', { name: 'Editar ficha' })).toBeInTheDocument()
    expect(screen.getByLabelText('Anotações')).toHaveValue('Nota X')
    expect(screen.getByLabelText(/consulta vinculada/i)).toHaveValue('10')
  })

  it('link "Voltar ao paciente" aponta pro paciente', () => {
    fichaMock.mockReturnValue({ data: undefined, isLoading: false })
    fichasMock.mockReturnValue({ data: [] })
    consultasMock.mockReturnValue({ data: [] })
    renderRota('/pacientes/5/fichas/nova')
    expect(screen.getByRole('link', { name: /voltar ao paciente/i })).toHaveAttribute(
      'href',
      '/pacientes/5',
    )
  })
})
