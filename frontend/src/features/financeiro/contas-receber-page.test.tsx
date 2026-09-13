import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ContasReceberPage } from './contas-receber-page'

const {
  lancamentosMock,
  quitarMock,
  estornarMock,
  criarMock,
  removerMock,
  faturasMock,
  faturarMock,
  conveniosMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  lancamentosMock: vi.fn(),
  quitarMock: vi.fn(),
  estornarMock: vi.fn(),
  criarMock: vi.fn(),
  removerMock: vi.fn(),
  faturasMock: vi.fn(),
  faturarMock: vi.fn(),
  conveniosMock: vi.fn(),
  toastErrorMock: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: toastErrorMock, success: vi.fn() } }))
vi.mock('./use-lancamentos', () => ({
  useLancamentos: lancamentosMock,
  useQuitarLancamento: () => ({ mutateAsync: quitarMock }),
  useEstornarLancamento: () => ({ mutateAsync: estornarMock }),
  useCriarLancamento: () => ({ mutateAsync: criarMock }),
  useAtualizarLancamento: () => ({ mutateAsync: vi.fn() }),
  useRemoverLancamento: () => ({ mutateAsync: removerMock }),
}))
vi.mock('./use-faturas', () => ({
  useFaturas: faturasMock,
  useFaturarOperadora: () => ({ mutateAsync: faturarMock, isPending: false }),
}))
vi.mock('../convenios/use-convenios', () => ({ useConvenios: conveniosMock }))
vi.mock('@/features/estoque/use-fornecedores', () => ({ useFornecedores: () => ({ data: [] }) }))

const LANCAMENTO_MANUAL = {
  id: 1,
  tipo: 'RECEITA',
  descricao: 'Venda avulsa',
  valor: '50.00',
  status: 'PENDENTE',
  vencimento: '2026-10-01',
  forma_pagamento: 'PIX',
  paciente_nome: '',
  fornecedor_nome: '',
  origem_automatica: false,
}

const LANCAMENTO_AUTOMATICO = {
  id: 2,
  tipo: 'RECEITA',
  descricao: 'Consulta',
  valor: '150.00',
  status: 'PAGO',
  vencimento: '2026-09-15',
  forma_pagamento: 'PIX',
  paciente_nome: 'Maria Souza',
  fornecedor_nome: '',
  origem_automatica: true,
}

describe('ContasReceberPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista lançamentos com a coluna paciente', () => {
    lancamentosMock.mockReturnValue({ data: [LANCAMENTO_AUTOMATICO], isLoading: false })
    faturasMock.mockReturnValue({ data: [], isLoading: false })
    conveniosMock.mockReturnValue({ data: [] })
    render(<ContasReceberPage />)
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
  })

  it('troca o filtro de status e chama useLancamentos com o novo status', async () => {
    lancamentosMock.mockReturnValue({ data: [], isLoading: false })
    faturasMock.mockReturnValue({ data: [], isLoading: false })
    conveniosMock.mockReturnValue({ data: [] })
    const user = userEvent.setup()
    render(<ContasReceberPage />)

    await user.selectOptions(screen.getByLabelText(/filtrar por status/i), 'PAGO')
    await waitFor(() =>
      expect(lancamentosMock).toHaveBeenCalledWith({ tipo: 'RECEITA', status: 'PAGO' }),
    )
  })

  it('lançamento automático não mostra Editar/Excluir; automático PAGO mostra Desfazer pagamento', () => {
    lancamentosMock.mockReturnValue({ data: [LANCAMENTO_AUTOMATICO], isLoading: false })
    faturasMock.mockReturnValue({ data: [], isLoading: false })
    conveniosMock.mockReturnValue({ data: [] })
    render(<ContasReceberPage />)

    expect(screen.queryByRole('button', { name: /editar lançamento/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /excluir lançamento/i })).toBeNull()
    expect(screen.getByRole('button', { name: /desfazer pagamento/i })).toBeInTheDocument()
  })

  it('lançamento manual mostra Editar e Excluir', () => {
    lancamentosMock.mockReturnValue({ data: [LANCAMENTO_MANUAL], isLoading: false })
    faturasMock.mockReturnValue({ data: [], isLoading: false })
    conveniosMock.mockReturnValue({ data: [] })
    render(<ContasReceberPage />)

    expect(screen.getByRole('button', { name: /editar lançamento/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /excluir lançamento/i })).toBeInTheDocument()
  })

  it('cria um lançamento manual', async () => {
    lancamentosMock.mockReturnValue({ data: [], isLoading: false })
    faturasMock.mockReturnValue({ data: [], isLoading: false })
    conveniosMock.mockReturnValue({ data: [] })
    criarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<ContasReceberPage />)

    await user.click(screen.getByRole('button', { name: /novo lançamento/i }))
    await user.type(screen.getByLabelText(/descrição/i), 'Venda avulsa')
    await user.type(screen.getByLabelText(/^valor/i), '50')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() =>
      expect(criarMock).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'RECEITA', descricao: 'Venda avulsa', valor: '50' }),
      ),
    )
  })

  it('exclui um lançamento manual após confirmação', async () => {
    lancamentosMock.mockReturnValue({ data: [LANCAMENTO_MANUAL], isLoading: false })
    faturasMock.mockReturnValue({ data: [], isLoading: false })
    conveniosMock.mockReturnValue({ data: [] })
    removerMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<ContasReceberPage />)

    await user.click(screen.getByRole('button', { name: /excluir lançamento/i }))
    await user.click(screen.getByRole('button', { name: /^excluir$/i }))
    await waitFor(() => expect(removerMock).toHaveBeenCalledWith(1))
  })

  it('aba Faturas lista as faturas existentes', async () => {
    lancamentosMock.mockReturnValue({ data: [], isLoading: false })
    faturasMock.mockReturnValue({
      data: [{ id: 1, numero: 'F1', operadora: 'Amil', competencia: '09/2026', valor_total: '300.00', status: 'ABERTA' }],
      isLoading: false,
    })
    conveniosMock.mockReturnValue({ data: [{ id: 1, nome: 'Amil' }] })
    const user = userEvent.setup()
    render(<ContasReceberPage />)

    await user.click(screen.getByRole('tab', { name: /faturas/i }))
    expect(screen.getByText('F1')).toBeInTheDocument()
    expect(screen.getByText('09/2026')).toBeInTheDocument()
  })

  it('faturar operadora chama useFaturarOperadora com operadora e competência', async () => {
    lancamentosMock.mockReturnValue({ data: [], isLoading: false })
    faturasMock.mockReturnValue({ data: [], isLoading: false })
    conveniosMock.mockReturnValue({ data: [{ id: 1, nome: 'Amil' }] })
    faturarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<ContasReceberPage />)

    await user.click(screen.getByRole('tab', { name: /faturas/i }))
    await user.selectOptions(screen.getByLabelText(/faturar operadora/i), 'Amil')
    await user.type(screen.getByLabelText(/competência/i), '09/2026')
    await user.click(screen.getByRole('button', { name: /^faturar$/i }))

    await waitFor(() =>
      expect(faturarMock).toHaveBeenCalledWith({ operadora: 'Amil', competencia: '09/2026' }),
    )
  })

  it('faturar sem contas pendentes mostra a mensagem do backend', async () => {
    lancamentosMock.mockReturnValue({ data: [], isLoading: false })
    faturasMock.mockReturnValue({ data: [], isLoading: false })
    conveniosMock.mockReturnValue({ data: [{ id: 1, nome: 'Amil' }] })
    faturarMock.mockRejectedValue({
      mensagem: 'Nenhuma conta a receber pendente para essa operadora.',
    })
    const user = userEvent.setup()
    render(<ContasReceberPage />)

    await user.click(screen.getByRole('tab', { name: /faturas/i }))
    await user.selectOptions(screen.getByLabelText(/faturar operadora/i), 'Amil')
    await user.click(screen.getByRole('button', { name: /^faturar$/i }))

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Nenhuma conta a receber pendente para essa operadora.',
      ),
    )
  })
})
