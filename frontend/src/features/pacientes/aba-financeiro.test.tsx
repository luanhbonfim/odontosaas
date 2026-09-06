import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
  afterEach(() => vi.clearAllMocks())

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
})
