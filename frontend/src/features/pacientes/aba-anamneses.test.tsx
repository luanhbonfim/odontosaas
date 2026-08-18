import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AbaAnamneses } from './aba-anamneses'

const { anamnesesMock, criarMock } = vi.hoisted(() => ({
  anamnesesMock: vi.fn(),
  criarMock: vi.fn(),
}))
vi.mock('./use-paciente-detalhe', () => ({
  useAnamnesesDoPaciente: anamnesesMock,
  useCriarAnamnese: () => ({ mutateAsync: criarMock }),
}))

describe('AbaAnamneses', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista as anamneses com queixa e fatores de risco', () => {
    anamnesesMock.mockReturnValue({
      data: [
        {
          id: 1,
          queixa_principal: 'Dor no molar',
          pressao_arterial: '120/80',
          fumante: true,
          diabetico: false,
          gestante: false,
          criado_em: '2026-07-01T12:00:00Z',
        },
      ],
      isLoading: false,
    })
    render(<AbaAnamneses pacienteId={5} />)
    expect(screen.getByText('Dor no molar')).toBeInTheDocument()
    expect(screen.getByText('Fumante')).toBeInTheDocument()
    expect(screen.getByText('PA: 120/80')).toBeInTheDocument()
  })

  it('registra uma anamnese pelo drawer', async () => {
    anamnesesMock.mockReturnValue({ data: [], isLoading: false })
    criarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<AbaAnamneses pacienteId={5} />)

    await user.click(screen.getByRole('button', { name: /nova anamnese/i }))
    await screen.findByLabelText(/queixa principal/i) // drawer aberto
    await user.type(screen.getByLabelText(/queixa principal/i), 'Sensibilidade')
    await user.type(screen.getByLabelText(/pressão arterial/i), '110/70')
    await user.click(screen.getByLabelText('Fumante'))
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => expect(criarMock).toHaveBeenCalled())
    expect(criarMock).toHaveBeenCalledWith({
      paciente: 5,
      queixa_principal: 'Sensibilidade',
      pressao_arterial: '110/70',
      fumante: true,
      diabetico: false,
      gestante: false,
    })
  })

  it('exige a queixa principal', async () => {
    anamnesesMock.mockReturnValue({ data: [], isLoading: false })
    const user = userEvent.setup()
    render(<AbaAnamneses pacienteId={5} />)
    await user.click(screen.getByRole('button', { name: /nova anamnese/i }))
    await screen.findByLabelText(/queixa principal/i)
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    expect(await screen.findByText('Informe a queixa principal')).toBeInTheDocument()
    expect(criarMock).not.toHaveBeenCalled()
  })
})
