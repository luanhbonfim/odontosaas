import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ContasPagarPage } from './contas-pagar-page'

const { lancamentosMock, quitarMock, estornarMock, criarMock, removerMock } = vi.hoisted(() => ({
  lancamentosMock: vi.fn(),
  quitarMock: vi.fn(),
  estornarMock: vi.fn(),
  criarMock: vi.fn(),
  removerMock: vi.fn(),
}))

vi.mock('./use-lancamentos', () => ({
  useLancamentos: lancamentosMock,
  useQuitarLancamento: () => ({ mutateAsync: quitarMock }),
  useEstornarLancamento: () => ({ mutateAsync: estornarMock }),
  useCriarLancamento: () => ({ mutateAsync: criarMock }),
  useAtualizarLancamento: () => ({ mutateAsync: vi.fn() }),
  useRemoverLancamento: () => ({ mutateAsync: removerMock }),
}))
vi.mock('@/features/estoque/use-fornecedores', () => ({
  useFornecedores: () => ({ data: [{ id: 5, nome: 'Distribuidora X' }] }),
}))

const DESPESA_MANUAL = {
  id: 1,
  tipo: 'DESPESA',
  descricao: 'Material de escritório',
  valor: '40.00',
  status: 'PENDENTE',
  vencimento: '2026-10-01',
  forma_pagamento: '',
  paciente_nome: '',
  fornecedor_nome: '',
  origem_automatica: false,
}

// Despesa de compra de insumo: só `fornecedor` setado, sem consulta/guia/fatura
// — o caso que expõe o bug se o gating voltasse a ser !consulta && !guia && !fatura.
const DESPESA_COMPRA_INSUMO = {
  id: 2,
  tipo: 'DESPESA',
  descricao: 'Compra de insumo - Luva (Distribuidora X)',
  valor: '300.00',
  status: 'PENDENTE',
  vencimento: null,
  forma_pagamento: '',
  paciente_nome: '',
  fornecedor_nome: 'Distribuidora X',
  origem_automatica: true,
}

describe('ContasPagarPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista lançamentos com a coluna fornecedor', () => {
    lancamentosMock.mockReturnValue({ data: [DESPESA_COMPRA_INSUMO], isLoading: false })
    render(<ContasPagarPage />)
    expect(screen.getByText('Distribuidora X')).toBeInTheDocument()
  })

  it('troca o filtro de status e chama useLancamentos com tipo DESPESA', async () => {
    lancamentosMock.mockReturnValue({ data: [], isLoading: false })
    const user = userEvent.setup()
    render(<ContasPagarPage />)

    await user.selectOptions(screen.getByLabelText(/filtrar por status/i), 'PAGO')
    await waitFor(() =>
      expect(lancamentosMock).toHaveBeenCalledWith({ tipo: 'DESPESA', status: 'PAGO' }),
    )
  })

  it('despesa de compra de insumo (origem_automatica=true, só fornecedor) não mostra Editar/Excluir', () => {
    lancamentosMock.mockReturnValue({ data: [DESPESA_COMPRA_INSUMO], isLoading: false })
    render(<ContasPagarPage />)

    expect(screen.queryByRole('button', { name: /editar lançamento/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /excluir lançamento/i })).toBeNull()
  })

  it('despesa manual mostra Editar e Excluir', () => {
    lancamentosMock.mockReturnValue({ data: [DESPESA_MANUAL], isLoading: false })
    render(<ContasPagarPage />)

    expect(screen.getByRole('button', { name: /editar lançamento/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /excluir lançamento/i })).toBeInTheDocument()
  })

  it('cria uma despesa manual com fornecedor opcional', async () => {
    lancamentosMock.mockReturnValue({ data: [], isLoading: false })
    criarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<ContasPagarPage />)

    await user.click(screen.getByRole('button', { name: /novo lançamento/i }))
    expect(screen.getByLabelText(/fornecedor/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/descrição/i), 'Aluguel')
    await user.type(screen.getByLabelText(/^valor/i), '1000')
    await user.selectOptions(screen.getByLabelText(/fornecedor/i), '5')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() =>
      expect(criarMock).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'DESPESA', descricao: 'Aluguel', valor: '1000', fornecedor: 5 }),
      ),
    )
  })

  it('não tem aba/seção de Faturas', () => {
    lancamentosMock.mockReturnValue({ data: [], isLoading: false })
    render(<ContasPagarPage />)
    expect(screen.queryByRole('tab', { name: /faturas/i })).toBeNull()
  })
})
