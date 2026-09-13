import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LancamentoFormDrawer } from './lancamento-form-drawer'

const { criarMock, atualizarMock, fornecedoresMock } = vi.hoisted(() => ({
  criarMock: vi.fn(),
  atualizarMock: vi.fn(),
  fornecedoresMock: vi.fn(),
}))
vi.mock('./use-lancamentos', () => ({
  useCriarLancamento: () => ({ mutateAsync: criarMock }),
  useAtualizarLancamento: () => ({ mutateAsync: atualizarMock }),
}))
vi.mock('@/features/estoque/use-fornecedores', () => ({ useFornecedores: fornecedoresMock }))

describe('LancamentoFormDrawer', () => {
  afterEach(() => vi.clearAllMocks())

  it('cria RECEITA sem campo Fornecedor', async () => {
    fornecedoresMock.mockReturnValue({ data: [] })
    criarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<LancamentoFormDrawer tipo="RECEITA" trigger={<button>Novo lançamento</button>} />)

    await user.click(screen.getByRole('button', { name: 'Novo lançamento' }))
    expect(screen.queryByLabelText(/fornecedor/i)).toBeNull()

    await user.type(screen.getByLabelText(/descrição/i), 'Venda avulsa')
    await user.type(screen.getByLabelText(/^valor/i), '50')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    expect(criarMock).toHaveBeenCalledWith({
      tipo: 'RECEITA',
      descricao: 'Venda avulsa',
      valor: '50',
      vencimento: null,
      forma_pagamento: undefined,
      fornecedor: null,
    })
  })

  it('cria DESPESA com campo Fornecedor (opcional)', async () => {
    fornecedoresMock.mockReturnValue({ data: [{ id: 3, nome: 'Distribuidora X' }] })
    criarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<LancamentoFormDrawer tipo="DESPESA" trigger={<button>Novo lançamento</button>} />)

    await user.click(screen.getByRole('button', { name: 'Novo lançamento' }))
    await user.type(screen.getByLabelText(/descrição/i), 'Material de escritório')
    await user.type(screen.getByLabelText(/^valor/i), '40')
    await user.selectOptions(screen.getByLabelText(/fornecedor/i), '3')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    expect(criarMock).toHaveBeenCalledWith({
      tipo: 'DESPESA',
      descricao: 'Material de escritório',
      valor: '40',
      vencimento: null,
      forma_pagamento: undefined,
      fornecedor: 3,
    })
  })

  it('bloqueia envio com valor <= 0', async () => {
    fornecedoresMock.mockReturnValue({ data: [] })
    const user = userEvent.setup()
    render(<LancamentoFormDrawer tipo="RECEITA" trigger={<button>Novo lançamento</button>} />)

    await user.click(screen.getByRole('button', { name: 'Novo lançamento' }))
    await user.type(screen.getByLabelText(/descrição/i), 'Teste')
    await user.type(screen.getByLabelText(/^valor/i), '0')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    expect(await screen.findByText('O valor deve ser maior que zero')).toBeInTheDocument()
    expect(criarMock).not.toHaveBeenCalled()
  })

  it('bloqueia envio sem descrição', async () => {
    fornecedoresMock.mockReturnValue({ data: [] })
    const user = userEvent.setup()
    render(<LancamentoFormDrawer tipo="RECEITA" trigger={<button>Novo lançamento</button>} />)

    await user.click(screen.getByRole('button', { name: 'Novo lançamento' }))
    await user.type(screen.getByLabelText(/^valor/i), '50')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    expect(await screen.findByText('Informe a descrição')).toBeInTheDocument()
    expect(criarMock).not.toHaveBeenCalled()
  })

  it('modo editar: pré-popula os campos e chama useAtualizarLancamento', async () => {
    fornecedoresMock.mockReturnValue({ data: [] })
    atualizarMock.mockResolvedValue({})
    const user = userEvent.setup()
    const lancamento = {
      id: 7,
      tipo: 'RECEITA',
      descricao: 'Consulta particular',
      valor: '150.00',
      vencimento: '2026-09-20',
      forma_pagamento: 'PIX',
      fornecedor: null,
    }
    render(
      <LancamentoFormDrawer
        lancamento={lancamento as never}
        trigger={<button>Editar</button>}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText(/descrição/i)).toHaveValue('Consulta particular')
    expect(screen.getByLabelText(/^valor/i)).toHaveValue('150.00')

    await user.click(screen.getByRole('button', { name: /^salvar$/i }))
    expect(atualizarMock).toHaveBeenCalledWith({
      id: 7,
      dados: expect.objectContaining({ descricao: 'Consulta particular', valor: '150.00' }),
    })
    expect(criarMock).not.toHaveBeenCalled()
  })
})
