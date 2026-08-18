import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { IntegracoesPage } from './integracoes-page'

function renderPage() {
  return render(
    <MemoryRouter>
      <IntegracoesPage />
    </MemoryRouter>,
  )
}

const { conexoesMock, sincronizarMock, desconectarMock } = vi.hoisted(() => ({
  conexoesMock: vi.fn(),
  sincronizarMock: vi.fn(),
  desconectarMock: vi.fn(),
}))
vi.mock('./use-integracoes', () => ({
  useConexoesGoogle: conexoesMock,
  useConfigSync: () => ({
    data: {
      intervalo_minutos: 30,
      ultima_sincronizacao: '2026-08-16T12:00:00Z',
      proxima_sincronizacao: '2026-08-16T12:30:00Z',
    },
  }),
  useSincronizarGoogle: () => ({ mutateAsync: sincronizarMock, isPending: false }),
  useAtualizarConfigSync: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDesconectarGoogle: () => ({ mutateAsync: desconectarMock }),
  urlAutorizarGoogle: (d: number | null) =>
    d ? `/integracoes/google/authorize?dentista=${d}` : '/integracoes/google/authorize',
}))
vi.mock('@/features/auth/use-sessao', () => ({
  useSessao: () => ({ usuario: { papel: 'ADMIN' }, carregando: false, erro: false }),
}))

const CONEXOES = [
  {
    dentista: null,
    dentista_nome: 'Clínica (geral)',
    conectado: true,
    calendar_id: 'primary',
    token_expiry: null,
    atualizado_em: '2026-08-01T12:00:00Z',
  },
  {
    dentista: 3,
    dentista_nome: 'Dra. Ana',
    conectado: false,
    calendar_id: 'primary',
    token_expiry: null,
    atualizado_em: null,
  },
]

describe('IntegracoesPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista as conexões com status e ações conforme o estado', () => {
    conexoesMock.mockReturnValue({ data: CONEXOES, isLoading: false, isError: false })
    renderPage()
    expect(screen.getByText('Clínica (geral)')).toBeInTheDocument()
    expect(screen.getByText('Conectado')).toBeInTheDocument()
    expect(screen.getByText('Dra. Ana')).toBeInTheDocument()
    expect(screen.getByText('Desconectado')).toBeInTheDocument()
    // Conectada -> Desconectar; desconectada -> Conectar.
    expect(screen.getByRole('button', { name: 'Desconectar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Conectar' })).toBeInTheDocument()
  })

  it('força a sincronização', async () => {
    conexoesMock.mockReturnValue({ data: CONEXOES, isLoading: false, isError: false })
    sincronizarMock.mockResolvedValue({ criados: 2, atualizados: 0, removidos: 0, canceladas: 0 })
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /forçar sincronização/i }))
    await waitFor(() => expect(sincronizarMock).toHaveBeenCalled())
  })

  it('desconecta um alvo após confirmação', async () => {
    conexoesMock.mockReturnValue({ data: CONEXOES, isLoading: false, isError: false })
    desconectarMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Desconectar' })) // gatilho
    const botoes = screen.getAllByRole('button', { name: 'Desconectar' })
    await user.click(botoes[botoes.length - 1]) // confirmar
    await waitFor(() => expect(desconectarMock).toHaveBeenCalledWith(null))
  })
})
