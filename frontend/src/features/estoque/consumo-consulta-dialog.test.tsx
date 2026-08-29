import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConsumoConsultaDialog } from './consumo-consulta-dialog'

const { consumosMock, criarMock, removerMock, insumosMock } = vi.hoisted(() => ({
  consumosMock: vi.fn(),
  criarMock: vi.fn(),
  removerMock: vi.fn(),
  insumosMock: vi.fn(),
}))

vi.mock('./use-estoque', () => ({
  useConsumosDaConsulta: consumosMock,
  useCriarConsumo: () => ({ mutateAsync: criarMock, isPending: false }),
  useRemoverConsumo: () => ({ mutateAsync: removerMock }),
  useInsumos: insumosMock,
}))

describe('ConsumoConsultaDialog', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista os consumos já registrados e adiciona um novo', async () => {
    consumosMock.mockReturnValue({
      data: [{ id: 1, consulta: 7, insumo: 3, insumo_nome: 'Luva', quantidade: '2.00' }],
      isLoading: false,
    })
    insumosMock.mockReturnValue({ data: [{ id: 3, nome: 'Luva' }, { id: 4, nome: 'Gaze' }] })
    criarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<ConsumoConsultaDialog consultaId={7} trigger={<button>Registrar insumos</button>} />)

    await user.click(screen.getByRole('button', { name: 'Registrar insumos' }))
    expect(await screen.findByText(/Luva —/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Insumo'), '4')
    await user.type(screen.getByLabelText('Quantidade'), '3')
    await user.click(screen.getByRole('button', { name: /adicionar/i }))

    await waitFor(() =>
      expect(criarMock).toHaveBeenCalledWith({ consulta: 7, insumo: 4, quantidade: '3' }),
    )
  })

  it('exige insumo e quantidade antes de adicionar', async () => {
    consumosMock.mockReturnValue({ data: [], isLoading: false })
    insumosMock.mockReturnValue({ data: [{ id: 3, nome: 'Luva' }] })
    const user = userEvent.setup()
    render(<ConsumoConsultaDialog consultaId={7} trigger={<button>Registrar insumos</button>} />)

    await user.click(screen.getByRole('button', { name: 'Registrar insumos' }))
    await user.click(screen.getByRole('button', { name: /adicionar/i }))
    expect(await screen.findByText('Selecione um insumo.')).toBeInTheDocument()
    expect(criarMock).not.toHaveBeenCalled()
  })

  it('remove um consumo após confirmação', async () => {
    consumosMock.mockReturnValue({
      data: [{ id: 1, consulta: 7, insumo: 3, insumo_nome: 'Luva', quantidade: '2.00' }],
      isLoading: false,
    })
    insumosMock.mockReturnValue({ data: [{ id: 3, nome: 'Luva' }] })
    removerMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<ConsumoConsultaDialog consultaId={7} trigger={<button>Registrar insumos</button>} />)

    await user.click(screen.getByRole('button', { name: 'Registrar insumos' }))
    await user.click(screen.getByRole('button', { name: /remover luva/i }))
    await user.click(screen.getByRole('button', { name: /^remover$/i }))

    await waitFor(() => expect(removerMock).toHaveBeenCalledWith(1))
  })
})
