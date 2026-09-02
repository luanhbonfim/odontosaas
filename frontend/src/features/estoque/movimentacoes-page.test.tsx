import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MovimentacoesPage } from './movimentacoes-page'

const { insumosMock, fornecedoresMock, movimentacoesMock, criarMovimentacaoMock } = vi.hoisted(() => ({
  insumosMock: vi.fn(),
  fornecedoresMock: vi.fn(),
  movimentacoesMock: vi.fn(),
  criarMovimentacaoMock: vi.fn(),
}))

vi.mock('./use-estoque', () => ({
  useInsumos: insumosMock,
  useMovimentacoesEstoque: movimentacoesMock,
  useCriarMovimentacao: () => ({ mutateAsync: criarMovimentacaoMock }),
}))
vi.mock('./use-fornecedores', () => ({ useFornecedores: fornecedoresMock }))

const AJUSTE = {
  id: 1,
  insumo: 1,
  insumo_nome: 'Gaze',
  tipo: 'ENTRADA',
  subtipo: 'AJUSTE',
  quantidade: '20.00',
  observacao: '',
  consulta: null,
  lancamento_financeiro_detalhe: null,
  criado_em: '2026-08-01T12:00:00Z',
}

const COMPRA = {
  id: 2,
  insumo: 2,
  insumo_nome: 'Resina A2',
  tipo: 'ENTRADA',
  subtipo: 'COMPRA',
  quantidade: '10.00',
  observacao: '',
  consulta: null,
  lancamento_financeiro_detalhe: {
    id: 9,
    valor: '150.00',
    vencimento: '2026-09-15',
    forma_pagamento: 'BOLETO',
    fornecedor: 1,
    fornecedor_nome: 'Dental Center',
    status: 'PENDENTE',
  },
  criado_em: '2026-08-02T12:00:00Z',
}

const BAIXA_MANUAL = {
  id: 3,
  insumo: 1,
  insumo_nome: 'Gaze',
  tipo: 'SAIDA',
  subtipo: 'AJUSTE',
  quantidade: '5.00',
  observacao: 'Quebra',
  consulta: null,
  lancamento_financeiro_detalhe: null,
  criado_em: '2026-08-03T12:00:00Z',
}

const BAIXA_AUTOMATICA = {
  id: 4,
  insumo: 2,
  insumo_nome: 'Resina A2',
  tipo: 'SAIDA',
  subtipo: 'AJUSTE',
  quantidade: '1.00',
  observacao: 'Baixa automática — consulta #9',
  consulta: 9,
  lancamento_financeiro_detalhe: null,
  criado_em: '2026-08-04T12:00:00Z',
}

describe('MovimentacoesPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista movimentações mistas com tipo, origem e fornecedor da compra', () => {
    insumosMock.mockReturnValue({ data: [{ id: 1, nome: 'Gaze' }, { id: 2, nome: 'Resina A2' }] })
    fornecedoresMock.mockReturnValue({ data: [{ id: 1, nome: 'Dental Center' }] })
    movimentacoesMock.mockReturnValue({
      data: [AJUSTE, COMPRA, BAIXA_MANUAL, BAIXA_AUTOMATICA],
      isLoading: false,
    })
    render(<MovimentacoesPage />)

    expect(screen.getByRole('heading', { name: 'Movimentações' })).toBeInTheDocument()
    const tabela = screen.getByRole('table')
    expect(within(tabela).getByText('Ajuste')).toBeInTheDocument()
    expect(within(tabela).getByText('Compra')).toBeInTheDocument()
    expect(within(tabela).getByText('Manual')).toBeInTheDocument()
    expect(within(tabela).getByText('Automática (consulta)')).toBeInTheDocument()
    expect(within(tabela).getByText('Dental Center')).toBeInTheDocument()
  })

  it('filtra por tipo', async () => {
    insumosMock.mockReturnValue({ data: [] })
    fornecedoresMock.mockReturnValue({ data: [] })
    movimentacoesMock.mockReturnValue({ data: [], isLoading: false })
    const user = userEvent.setup()
    render(<MovimentacoesPage />)

    await user.selectOptions(screen.getByRole('combobox', { name: /filtrar por tipo/i }), 'ENTRADA')
    expect(movimentacoesMock).toHaveBeenCalledWith({ tipo: 'ENTRADA' })
  })

  it('registra uma entrada por ajuste (sem campos de compra)', async () => {
    insumosMock.mockReturnValue({ data: [{ id: 1, nome: 'Gaze' }] })
    fornecedoresMock.mockReturnValue({ data: [] })
    movimentacoesMock.mockReturnValue({ data: [], isLoading: false })
    criarMovimentacaoMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<MovimentacoesPage />)

    await user.click(screen.getByRole('button', { name: /nova movimentação/i }))
    expect(screen.queryByRole('combobox', { name: /fornecedor/i })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: /insumo/i }), '1')
    await user.type(screen.getByRole('textbox', { name: /quantidade/i }), '15')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(criarMovimentacaoMock).toHaveBeenCalled())
    expect(criarMovimentacaoMock).toHaveBeenCalledWith(
      expect.objectContaining({ insumo: 1, tipo: 'ENTRADA', subtipo: 'AJUSTE', quantidade: '15' }),
    )
  })

  it('registra uma compra completa (fornecedor + valor)', async () => {
    insumosMock.mockReturnValue({ data: [{ id: 2, nome: 'Resina A2' }] })
    fornecedoresMock.mockReturnValue({ data: [{ id: 1, nome: 'Dental Center' }] })
    movimentacoesMock.mockReturnValue({ data: [], isLoading: false })
    criarMovimentacaoMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<MovimentacoesPage />)

    await user.click(screen.getByRole('button', { name: /nova movimentação/i }))
    await user.selectOptions(screen.getByRole('combobox', { name: /origem/i }), 'COMPRA')
    await user.selectOptions(screen.getByRole('combobox', { name: /insumo/i }), '2')
    await user.type(screen.getByRole('textbox', { name: /quantidade/i }), '10')
    await user.selectOptions(screen.getByRole('combobox', { name: /fornecedor/i }), '1')
    await user.type(screen.getByRole('textbox', { name: /valor pago/i }), '150')
    await user.selectOptions(screen.getByRole('combobox', { name: /forma de pagamento/i }), 'BOLETO')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(criarMovimentacaoMock).toHaveBeenCalled())
    expect(criarMovimentacaoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        insumo: 2,
        tipo: 'ENTRADA',
        subtipo: 'COMPRA',
        quantidade: '10',
        fornecedor: 1,
        valor: '150',
        forma_pagamento: 'BOLETO',
      }),
    )
  })

  it('compra sem fornecedor bloqueia o envio', async () => {
    insumosMock.mockReturnValue({ data: [{ id: 2, nome: 'Resina A2' }] })
    fornecedoresMock.mockReturnValue({ data: [{ id: 1, nome: 'Dental Center' }] })
    movimentacoesMock.mockReturnValue({ data: [], isLoading: false })
    const user = userEvent.setup()
    render(<MovimentacoesPage />)

    await user.click(screen.getByRole('button', { name: /nova movimentação/i }))
    await user.selectOptions(screen.getByRole('combobox', { name: /origem/i }), 'COMPRA')
    await user.selectOptions(screen.getByRole('combobox', { name: /insumo/i }), '2')
    await user.type(screen.getByRole('textbox', { name: /quantidade/i }), '10')
    await user.type(screen.getByRole('textbox', { name: /valor pago/i }), '150')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    expect(await screen.findByText('Selecione o fornecedor')).toBeInTheDocument()
    expect(criarMovimentacaoMock).not.toHaveBeenCalled()
  })

  it('saída não mostra o seletor de origem (ajuste/compra)', async () => {
    insumosMock.mockReturnValue({ data: [{ id: 1, nome: 'Gaze' }] })
    fornecedoresMock.mockReturnValue({ data: [] })
    movimentacoesMock.mockReturnValue({ data: [], isLoading: false })
    const user = userEvent.setup()
    render(<MovimentacoesPage />)

    await user.click(screen.getByRole('button', { name: /nova movimentação/i }))
    await user.selectOptions(screen.getByRole('combobox', { name: /^tipo$/i }), 'SAIDA')
    expect(screen.queryByRole('combobox', { name: /origem/i })).not.toBeInTheDocument()
  })
})
