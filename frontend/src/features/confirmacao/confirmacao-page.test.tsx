import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConfirmacaoPage } from './confirmacao-page'

const { infoMock, responderMock } = vi.hoisted(() => ({
  infoMock: vi.fn(),
  responderMock: vi.fn(),
}))
vi.mock('./use-confirmacao', () => ({
  useConfirmacaoInfo: infoMock,
  useResponderConfirmacao: () => ({ mutateAsync: responderMock, isPending: false }),
}))

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/c/abc123']}>
      <Routes>
        <Route path="/c/:token" element={<ConfirmacaoPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const INFO = {
  paciente_nome: 'Zé',
  dentista_nome: 'Dra. Ana',
  inicio: '2026-08-16T12:30:00Z',
  status_confirmacao: 'PENDENTE',
  status: 'AGENDADA',
}

describe('ConfirmacaoPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('pendente: mostra os botões e confirma', async () => {
    infoMock.mockReturnValue({ data: INFO, isLoading: false, isError: false })
    responderMock.mockResolvedValue({ status_confirmacao: 'CONFIRMADA' })
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByText(/você confirma/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /confirmar presença/i }))
    await waitFor(() => expect(responderMock).toHaveBeenCalledWith('confirmar'))
    expect(await screen.findByText(/consulta confirmada/i)).toBeInTheDocument()
  })

  it('já respondida: mostra o estado final (sem botões)', () => {
    infoMock.mockReturnValue({
      data: { ...INFO, status_confirmacao: 'CONFIRMADA' },
      isLoading: false,
      isError: false,
    })
    renderPage()
    expect(screen.getByText(/consulta confirmada/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirmar presença/i })).toBeNull()
  })

  it('link inválido: mensagem de erro', () => {
    infoMock.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    renderPage()
    expect(screen.getByText(/link inválido/i)).toBeInTheDocument()
  })
})
