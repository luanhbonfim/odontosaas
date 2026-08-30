import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EstoquePage } from './estoque-page'

const {
  categoriasMock,
  criarCategoriaMock,
  insumosMock,
  criarInsumoMock,
  alertasMock,
  movimentacoesMock,
  criarMovimentacaoMock,
} = vi.hoisted(() => ({
  categoriasMock: vi.fn(),
  criarCategoriaMock: vi.fn(),
  insumosMock: vi.fn(),
  criarInsumoMock: vi.fn(),
  alertasMock: vi.fn(),
  movimentacoesMock: vi.fn(),
  criarMovimentacaoMock: vi.fn(),
}))

vi.mock('./use-estoque', () => ({
  useCategoriasInsumo: categoriasMock,
  useCriarCategoriaInsumo: () => ({ mutateAsync: criarCategoriaMock }),
  useAtualizarCategoriaInsumo: () => ({ mutateAsync: vi.fn() }),
  useRemoverCategoriaInsumo: () => ({ mutateAsync: vi.fn() }),
  useInsumos: insumosMock,
  useCriarInsumo: () => ({ mutateAsync: criarInsumoMock }),
  useAtualizarInsumo: () => ({ mutateAsync: vi.fn() }),
  useRemoverInsumo: () => ({ mutateAsync: vi.fn() }),
  useInsumosAlertas: alertasMock,
  useMovimentacoesEstoque: movimentacoesMock,
  useCriarMovimentacao: () => ({ mutateAsync: criarMovimentacaoMock }),
}))

const INSUMO_OK = {
  id: 1,
  nome: 'Gaze',
  categoria: null,
  categoria_nome: null,
  unidade: 'PC',
  estoque_minimo: '5.00',
  saldo: '20.00',
  estoque_baixo: false,
  ativo: true,
}
const INSUMO_BAIXO = {
  id: 2,
  nome: 'Resina A2',
  categoria: 1,
  categoria_nome: 'Restauradores',
  unidade: 'UN',
  estoque_minimo: '8.00',
  saldo: '2.00',
  estoque_baixo: true,
  ativo: true,
}
const LANCAMENTO = {
  id: 1,
  insumo: 1,
  insumo_nome: 'Gaze',
  tipo: 'ENTRADA',
  quantidade: '20.00',
  observacao: '',
  consulta: null,
  criado_em: '2026-08-01T12:00:00Z',
}
const BAIXA_MANUAL = {
  id: 2,
  insumo: 1,
  insumo_nome: 'Gaze',
  tipo: 'SAIDA',
  quantidade: '5.00',
  observacao: 'Quebra',
  consulta: null,
  criado_em: '2026-08-02T12:00:00Z',
}
const BAIXA_AUTOMATICA = {
  id: 3,
  insumo: 2,
  insumo_nome: 'Resina A2',
  tipo: 'SAIDA',
  quantidade: '1.00',
  observacao: 'Baixa automática — consulta #9',
  consulta: 9,
  criado_em: '2026-08-03T12:00:00Z',
}

function mockarPadrao() {
  categoriasMock.mockReturnValue({ data: [{ id: 1, nome: 'Restauradores', ativo: true }], isLoading: false })
  insumosMock.mockReturnValue({ data: [INSUMO_OK, INSUMO_BAIXO], isLoading: false })
  alertasMock.mockReturnValue({ data: [INSUMO_BAIXO], isLoading: false })
  movimentacoesMock.mockImplementation((tipo?: string) => {
    if (tipo === 'ENTRADA') return { data: [LANCAMENTO], isLoading: false }
    if (tipo === 'SAIDA') return { data: [BAIXA_MANUAL, BAIXA_AUTOMATICA], isLoading: false }
    return { data: [], isLoading: false }
  })
}

describe('EstoquePage', () => {
  afterEach(() => vi.clearAllMocks())

  it('aba Insumos: lista com saldo e badge de estoque baixo', () => {
    mockarPadrao()
    render(<EstoquePage />)
    expect(screen.getByText('Gaze')).toBeInTheDocument()
    expect(screen.getByText('Resina A2')).toBeInTheDocument()
    expect(screen.getByText('Estoque baixo')).toBeInTheDocument()
  })

  it('aba Insumos: cria um insumo novo', async () => {
    mockarPadrao()
    criarInsumoMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<EstoquePage />)

    await user.click(screen.getByRole('button', { name: /novo insumo/i }))
    await user.type(screen.getByLabelText(/nome/i), 'Anestésico Lidocaína')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(criarInsumoMock).toHaveBeenCalled())
    expect(criarInsumoMock).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'Anestésico Lidocaína', unidade: 'UN' }),
    )
  })

  it('aba Categorias: lista e cria uma categoria', async () => {
    mockarPadrao()
    criarCategoriaMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<EstoquePage />)

    await user.click(screen.getByRole('tab', { name: 'Categorias' }))
    expect(await screen.findByText('Restauradores')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /nova categoria/i }))
    await user.type(screen.getByLabelText(/nome/i), 'Anestésicos')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() =>
      expect(criarCategoriaMock).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Anestésicos' })),
    )
  })

  it('aba Lançamentos: lista só entradas e registra uma nova', async () => {
    mockarPadrao()
    criarMovimentacaoMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<EstoquePage />)

    await user.click(screen.getByRole('tab', { name: 'Lançamentos' }))
    const tabela = await screen.findByRole('table')
    expect(within(tabela).getByText('Gaze')).toBeInTheDocument()
    // Sem coluna "Tipo"/"Origem" em Lançamentos.
    expect(within(tabela).queryByText('Manual')).toBeNull()

    await user.click(screen.getByRole('button', { name: /novo lançamento/i }))
    await user.selectOptions(screen.getByRole('combobox', { name: /insumo/i }), '1')
    await user.type(screen.getByRole('textbox', { name: /quantidade/i }), '15')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(criarMovimentacaoMock).toHaveBeenCalled())
    expect(criarMovimentacaoMock).toHaveBeenCalledWith(
      expect.objectContaining({ insumo: 1, tipo: 'ENTRADA', quantidade: '15' }),
    )
  })

  it('aba Baixas: lista saídas com origem manual/automática e registra uma baixa manual', async () => {
    mockarPadrao()
    criarMovimentacaoMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<EstoquePage />)

    await user.click(screen.getByRole('tab', { name: 'Baixas' }))
    const tabela = await screen.findByRole('table')
    expect(within(tabela).getByText('Manual')).toBeInTheDocument()
    expect(within(tabela).getByText('Automática (consulta)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /nova baixa/i }))
    await user.selectOptions(screen.getByRole('combobox', { name: /insumo/i }), '2')
    await user.type(screen.getByRole('textbox', { name: /quantidade/i }), '1')
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(criarMovimentacaoMock).toHaveBeenCalled())
    expect(criarMovimentacaoMock).toHaveBeenCalledWith(
      expect.objectContaining({ insumo: 2, tipo: 'SAIDA', quantidade: '1' }),
    )
  })

  it('aba Alertas: só mostra insumos abaixo do mínimo', async () => {
    mockarPadrao()
    const user = userEvent.setup()
    render(<EstoquePage />)

    await user.click(screen.getByRole('tab', { name: 'Alertas' }))
    const tabela = await screen.findByRole('table')
    expect(within(tabela).getByText('Resina A2')).toBeInTheDocument()
    expect(within(tabela).queryByText('Gaze')).toBeNull()
  })
})
