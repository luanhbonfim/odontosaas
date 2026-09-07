import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AbaFinanceiro } from './aba-financeiro'

const { lancamentosMock, quitarMock, estornarMock } = vi.hoisted(() => ({
  lancamentosMock: vi.fn(),
  quitarMock: vi.fn(),
  estornarMock: vi.fn(),
}))
vi.mock('./use-paciente-detalhe', () => ({
  useLancamentosDoPaciente: lancamentosMock,
}))
vi.mock('@/features/financeiro/use-lancamentos', () => ({
  useQuitarLancamento: () => ({ mutateAsync: quitarMock }),
  useEstornarLancamento: () => ({ mutateAsync: estornarMock }),
}))

const PENDENTE = {
  id: 1,
  descricao: 'Consulta particular (parcela 1/3)',
  valor: '100.00',
  status: 'PENDENTE',
  vencimento: '2026-08-10',
  consulta: 5,
  consulta_procedimento: 'Restauração',
  consulta_data: '2026-07-20T13:00:00Z',
  numero_parcela: 1,
  total_parcelas: 3,
  forma_pagamento: 'CARTAO',
}
const PAGO = {
  id: 2,
  descricao: 'Consulta particular',
  valor: '80.00',
  status: 'PAGO',
  vencimento: '2026-07-01',
  consulta: 6,
  consulta_procedimento: 'Limpeza',
  consulta_data: '2026-06-25T10:00:00Z',
  numero_parcela: 1,
  total_parcelas: 1,
  forma_pagamento: 'PIX',
}

function renderAba() {
  render(<AbaFinanceiro pacienteId={5} />)
}

describe('AbaFinanceiro', () => {
  // Fixa "hoje" pra classificação vencido/pendente ser determinística.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-06T00:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('lista as parcelas com valor, vencimento e parcela X/N', () => {
    lancamentosMock.mockReturnValue({ data: [PENDENTE], isLoading: false })
    renderAba()
    expect(screen.getByText('Restauração')).toBeInTheDocument()
    expect(screen.getByText('R$ 100,00')).toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(screen.getByText('Cartão')).toBeInTheDocument()
  })

  it('pendente mostra "Marcar como pago"; pago mostra "Desfazer pagamento"', () => {
    lancamentosMock.mockReturnValue({ data: [PENDENTE, PAGO], isLoading: false })
    renderAba()
    expect(screen.getByRole('button', { name: 'Marcar como pago' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desfazer pagamento' })).toBeInTheDocument()
  })

  it('marcar como pago chama a mutation de quitar', async () => {
    lancamentosMock.mockReturnValue({ data: [PENDENTE], isLoading: false })
    quitarMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderAba()
    await user.click(screen.getByRole('button', { name: 'Marcar como pago' }))
    await waitFor(() => expect(quitarMock).toHaveBeenCalledWith(1))
  })

  it('desfazer pagamento chama a mutation de estornar', async () => {
    lancamentosMock.mockReturnValue({ data: [PAGO], isLoading: false })
    estornarMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderAba()
    await user.click(screen.getByRole('button', { name: 'Desfazer pagamento' }))
    await waitFor(() => expect(estornarMock).toHaveBeenCalledWith(2))
  })

  it('vazio: mostra a mensagem padrão', () => {
    lancamentosMock.mockReturnValue({ data: [], isLoading: false })
    renderAba()
    expect(screen.getByText('Nenhum lançamento financeiro.')).toBeInTheDocument()
  })

  it('destaca a linha por situação (vencido/pendente/pago) e mostra a legenda', () => {
    // "Hoje" congelado em 2026-09-06: vencimento 08-10 já passou (vencido);
    // 10-01 ainda não chegou (pendente).
    const vencido = { ...PENDENTE, id: 3, consulta_procedimento: 'Vencida', vencimento: '2026-08-10' }
    const pendente = { ...PENDENTE, id: 4, consulta_procedimento: 'Consulta futura', vencimento: '2026-10-01' }
    lancamentosMock.mockReturnValue({ data: [vencido, pendente, PAGO], isLoading: false })
    renderAba()

    expect(screen.getByText('Vencida').closest('tr')).toHaveClass('bg-destructive/10')
    expect(screen.getByText('Consulta futura').closest('tr')).toHaveClass('bg-warning/10')
    expect(screen.getByText('Limpeza').closest('tr')).toHaveClass('bg-success/10')

    // Legenda: 3 rótulos indicando o que cada cor significa (o filtro também
    // tem opções com o mesmo texto — restringe a busca ao grupo da legenda).
    const legenda = within(screen.getByRole('group', { name: 'Legenda das cores por situação' }))
    expect(legenda.getByText('Vencido')).toBeInTheDocument()
    expect(legenda.getByText('Pendente')).toBeInTheDocument()
    expect(legenda.getByText('Pago')).toBeInTheDocument()
  })

  it('filtro por situação: "Vencido" mostra só os lançamentos vencidos', async () => {
    const vencido = { ...PENDENTE, id: 3, consulta_procedimento: 'Vencida', vencimento: '2026-08-10' }
    const pendente = { ...PENDENTE, id: 4, consulta_procedimento: 'Consulta futura', vencimento: '2026-10-01' }
    lancamentosMock.mockReturnValue({ data: [vencido, pendente, PAGO], isLoading: false })
    const user = userEvent.setup()
    renderAba()

    await user.selectOptions(screen.getByLabelText('Filtrar por situação'), 'VENCIDO')

    expect(screen.getByText('Vencida')).toBeInTheDocument()
    expect(screen.queryByText('Consulta futura')).toBeNull()
    expect(screen.queryByText('Limpeza')).toBeNull()
  })

  it('ordena por data da consulta crescente e, no empate, vencimento decrescente', () => {
    const antiga = {
      ...PENDENTE,
      id: 5,
      consulta_procedimento: 'Mais antiga',
      consulta_data: '2026-04-01T10:00:00Z',
      vencimento: '2026-04-05',
    }
    const recenteVencimentoCedo = {
      ...PENDENTE,
      id: 6,
      consulta_procedimento: 'Mesma consulta - vence cedo',
      consulta_data: '2026-05-01T10:00:00Z',
      vencimento: '2026-05-10',
    }
    const recenteVencimentoTarde = {
      ...PENDENTE,
      id: 7,
      consulta_procedimento: 'Mesma consulta - vence tarde',
      consulta_data: '2026-05-01T10:00:00Z',
      vencimento: '2026-05-20',
    }
    // Embaralhado de propósito -> a ordenação padrão precisa reorganizar.
    lancamentosMock.mockReturnValue({
      data: [recenteVencimentoCedo, antiga, recenteVencimentoTarde],
      isLoading: false,
    })
    renderAba()

    const procedimentos = screen.getAllByRole('row').slice(1).map((tr) => tr.textContent)
    const ordem = procedimentos.map((texto) =>
      ['Mais antiga', 'Mesma consulta - vence cedo', 'Mesma consulta - vence tarde'].find((p) =>
        texto?.includes(p),
      ),
    )
    expect(ordem).toEqual(['Mais antiga', 'Mesma consulta - vence tarde', 'Mesma consulta - vence cedo'])
  })
})
