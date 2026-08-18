import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConexaoWhatsapp } from './conexao-whatsapp'

const { statusMock, qrMock, conectarMock, desconectarMock } = vi.hoisted(() => ({
  statusMock: vi.fn(),
  qrMock: vi.fn(),
  conectarMock: vi.fn(),
  desconectarMock: vi.fn(),
}))
vi.mock('./use-notificacoes', () => ({
  useWhatsappStatus: statusMock,
  useQrWhatsapp: qrMock,
  useConectarWhatsapp: () => ({ mutateAsync: conectarMock, isPending: false }),
  useDesconectarWhatsapp: () => ({ mutateAsync: desconectarMock, isPending: false }),
}))

describe('ConexaoWhatsapp', () => {
  afterEach(() => vi.clearAllMocks())

  it('desconectado: mostra "Conectar" e dispara a conexão', async () => {
    statusMock.mockReturnValue({
      data: { session: 's1', status: 'STOPPED', conectado: false, numero: null },
      isLoading: false,
    })
    qrMock.mockReturnValue({ data: undefined })
    conectarMock.mockResolvedValue({ status: 'SCAN_QR_CODE' })
    const user = userEvent.setup()
    render(<ConexaoWhatsapp />)
    expect(screen.getByText('Desconectado')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /conectar/i }))
    await waitFor(() => expect(conectarMock).toHaveBeenCalled())
  })

  it('aguardando QR: exibe a imagem do QR', () => {
    statusMock.mockReturnValue({
      data: { session: 's1', status: 'SCAN_QR_CODE', conectado: false, numero: null },
      isLoading: false,
    })
    qrMock.mockReturnValue({ data: 'data:image/png;base64,AAAA' })
    render(<ConexaoWhatsapp />)
    expect(screen.getByText(/aguardando leitura/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /qr code/i })).toHaveAttribute(
      'src',
      'data:image/png;base64,AAAA',
    )
  })

  it('conectado: mostra o número e permite desconectar', async () => {
    statusMock.mockReturnValue({
      data: { session: 's1', status: 'WORKING', conectado: true, numero: '5511999' },
      isLoading: false,
    })
    qrMock.mockReturnValue({ data: undefined })
    desconectarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<ConexaoWhatsapp />)
    expect(screen.getByText('Conectado')).toBeInTheDocument()
    expect(screen.getByText(/5511999/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /desconectar/i }))
    await waitFor(() => expect(desconectarMock).toHaveBeenCalled())
  })
})
