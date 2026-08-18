import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AbaGuias } from './aba-guias'

const { guiasMock, atualizarMock, removerMock, navegarMock } = vi.hoisted(() => ({
  guiasMock: vi.fn(),
  atualizarMock: vi.fn(),
  removerMock: vi.fn(),
  navegarMock: vi.fn(),
}))
vi.mock('./use-paciente-detalhe', () => ({
  useGuiasDoPaciente: guiasMock,
  useAtualizarGuia: () => ({ mutateAsync: atualizarMock }),
  useRemoverGuia: () => ({ mutateAsync: removerMock }),
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const real = await importOriginal<typeof import('react-router-dom')>()
  return { ...real, useNavigate: () => navegarMock }
})

const GUIA = {
  id: 1,
  plano: 7,
  numero_guia: 'G-1',
  procedimento: 'Limpeza',
  valor: '100.00',
  status: 'EMITIDA',
}

function renderAba() {
  render(
    <MemoryRouter>
      <AbaGuias pacienteId={5} />
    </MemoryRouter>,
  )
}

describe('AbaGuias', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista e mostra apenas as transições válidas (EMITIDA)', () => {
    guiasMock.mockReturnValue({ data: [GUIA], isLoading: false })
    renderAba()
    expect(screen.getByText('G-1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Autorizar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Glosar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /marcar paga/i })).not.toBeInTheDocument()
  })

  it('o número da guia é um link para a página da guia (sem lápis)', () => {
    guiasMock.mockReturnValue({ data: [GUIA], isLoading: false })
    renderAba()
    expect(screen.getByRole('link', { name: 'G-1' })).toHaveAttribute(
      'href',
      '/pacientes/5/guias/1',
    )
    expect(screen.queryByRole('button', { name: /editar guia/i })).not.toBeInTheDocument()
  })

  it('transiciona o status (Autorizar → AUTORIZADA)', async () => {
    guiasMock.mockReturnValue({ data: [GUIA], isLoading: false })
    atualizarMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderAba()
    await user.click(screen.getByRole('button', { name: 'Autorizar' }))
    await waitFor(() =>
      expect(atualizarMock).toHaveBeenCalledWith({ id: 1, dados: { status: 'AUTORIZADA' } }),
    )
  })

  it('"Adicionar guia" navega para a página de nova guia', async () => {
    guiasMock.mockReturnValue({ data: [], isLoading: false })
    const user = userEvent.setup()
    renderAba()
    await user.click(screen.getByRole('button', { name: /adicionar guia/i }))
    expect(navegarMock).toHaveBeenCalledWith('/pacientes/5/guias/nova')
  })

  it('exclui uma guia após confirmação', async () => {
    guiasMock.mockReturnValue({ data: [GUIA], isLoading: false })
    removerMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderAba()
    await user.click(screen.getByRole('button', { name: /excluir guia g-1/i }))
    await user.click(screen.getByRole('button', { name: /^excluir$/i }))
    await waitFor(() => expect(removerMock).toHaveBeenCalledWith(1))
  })
})
