import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuditoriaPage } from './auditoria-page'

const { auditoriaMock, sessaoMock } = vi.hoisted(() => ({
  auditoriaMock: vi.fn(),
  sessaoMock: vi.fn(),
}))
vi.mock('./use-auditoria', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./use-auditoria')>()),
  useAuditoria: auditoriaMock,
}))
vi.mock('@/features/auth/use-sessao', () => ({ useSessao: sessaoMock }))
vi.mock('@/features/usuarios/use-usuarios', () => ({
  useUsuarios: () => ({
    data: [
      { id: 1, email: 'adm@c.com', nome_completo: 'Admin Silva' },
      { id: 2, email: 'ger@c.com', nome_completo: '' },
    ],
  }),
}))
vi.mock('@/lib/hooks/use-debounce', () => ({ useDebounce: (v: string) => v }))
// Ambiente de teste = desktop (tabela, não cards).
vi.mock('@/stores/ui', () => ({ useEhDesktop: () => true, useEhTelaLarga: () => true }))

const REGISTROS = [
  {
    id: 1,
    acao: 'CRIACAO',
    acao_rotulo: 'Criação',
    modelo: 'Paciente',
    objeto_id: '7',
    objeto_repr: 'Ana Beatriz',
    usuario: 1,
    usuario_nome: 'Admin Silva',
    criado_em: '2026-10-07T12:00:00Z',
  },
  {
    id: 2,
    acao: 'EXCLUSAO',
    acao_rotulo: 'Exclusão',
    modelo: 'LancamentoFinanceiro',
    objeto_id: '9',
    objeto_repr: 'Aluguel',
    usuario: null,
    usuario_nome: '',
    criado_em: '2026-10-06T12:00:00Z',
  },
]

function pagina(results = REGISTROS, count = results.length) {
  return { data: { count, next: null, previous: null, results }, isLoading: false, isError: false }
}

describe('AuditoriaPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista os registros com rótulos amigáveis e "Sistema" quando sem usuário', () => {
    sessaoMock.mockReturnValue({ usuario: { papel: 'ADMIN' } })
    auditoriaMock.mockReturnValue(pagina())
    render(<AuditoriaPage />)
    expect(screen.getByRole('heading', { name: 'Auditoria' })).toBeInTheDocument()
    expect(screen.getAllByText('Criação').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Exclusão').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Lançamento financeiro').length).toBeGreaterThan(0)
    expect(screen.getByText(/Ana Beatriz/)).toBeInTheDocument()
    const tabela = within(screen.getByRole('table'))
    expect(tabela.getByText('Admin Silva')).toBeInTheDocument()
    expect(tabela.getByText('Sistema')).toBeInTheDocument()
  })

  it('Gerente também acessa; Recepção/Dentista veem acesso restrito', () => {
    sessaoMock.mockReturnValue({ usuario: { papel: 'DENTISTA_GERENTE' } })
    auditoriaMock.mockReturnValue(pagina())
    const { unmount } = render(<AuditoriaPage />)
    expect(screen.getAllByText('Criação').length).toBeGreaterThan(0)
    unmount()

    sessaoMock.mockReturnValue({ usuario: { papel: 'RECEPCAO' } })
    render(<AuditoriaPage />)
    expect(screen.getByText('Acesso restrito')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('filtros chegam ao hook (modelo, ação, usuário, período) e voltam à página 1', async () => {
    sessaoMock.mockReturnValue({ usuario: { papel: 'ADMIN' } })
    auditoriaMock.mockReturnValue(pagina())
    const user = userEvent.setup()
    render(<AuditoriaPage />)

    await user.selectOptions(screen.getByLabelText('Filtrar por tipo de registro'), 'Guia')
    await user.selectOptions(screen.getByLabelText('Filtrar por ação'), 'EXCLUSAO')
    await user.selectOptions(screen.getByLabelText('Filtrar por usuário'), '2')
    await user.type(screen.getByLabelText('Data inicial'), '2026-10-01')
    await user.type(screen.getByLabelText('Buscar na auditoria'), 'g-9')

    expect(auditoriaMock).toHaveBeenLastCalledWith({
      pagina: 1,
      busca: 'g-9',
      modelo: 'Guia',
      acao: 'EXCLUSAO',
      usuario: '2',
      de: '2026-10-01',
      ate: '',
    })
    // Usuário sem nome cai no e-mail no seletor.
    expect(screen.getByRole('option', { name: 'ger@c.com' })).toBeInTheDocument()
  })

  it('vazio e erro', () => {
    sessaoMock.mockReturnValue({ usuario: { papel: 'ADMIN' } })
    auditoriaMock.mockReturnValue(pagina([], 0))
    const { unmount } = render(<AuditoriaPage />)
    expect(screen.getByText('Nenhum registro encontrado.')).toBeInTheDocument()
    unmount()

    auditoriaMock.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<AuditoriaPage />)
    expect(screen.getByText('Não foi possível carregar a trilha')).toBeInTheDocument()
  })
})
