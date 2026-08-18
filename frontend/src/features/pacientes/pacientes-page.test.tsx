import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PacientesPage } from './pacientes-page'

// A célula "Nome" usa <Link>, então precisa de contexto de rota.
const renderRota = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

const { pacientesMock } = vi.hoisted(() => ({ pacientesMock: vi.fn() }))
// Mantém TAMANHO_PAGINA real; troca o hook de dados e o de exclusão (evita o
// useQueryClient real, que exigiria um QueryClientProvider no teste).
vi.mock('./use-pacientes', async (importOriginal) => {
  const real = await importOriginal<typeof import('./use-pacientes')>()
  return {
    ...real,
    usePacientes: pacientesMock,
    useExcluirPaciente: () => ({ mutateAsync: vi.fn() }),
  }
})
// Debounce identidade: a busca reflete imediatamente no teste.
vi.mock('@/lib/hooks/use-debounce', () => ({ useDebounce: (valor: unknown) => valor }))
vi.mock('@/features/dentistas/use-dentistas', () => ({
  useDentistas: () => ({ data: [{ id: 3, nome_completo: 'Dra. Ana' }] }),
}))
// Sem usuário no contexto -> sem coluna de exclusão (não afeta as asserções base).
vi.mock('@/features/auth/use-sessao', () => ({ useSessao: () => ({ usuario: null }) }))

const AMOSTRA = [
  {
    id: 1,
    nome_completo: 'João da Silva',
    cpf: '11122233344',
    telefone_whatsapp: '5518997999509',
    email: 'joao@ex.com',
    dentista_responsavel_nome: 'Dr. Responsável',
    ativo: true,
  },
  {
    id: 2,
    nome_completo: 'Maria Souza',
    cpf: null,
    telefone_whatsapp: '',
    email: '',
    dentista_responsavel_nome: null,
    ativo: false,
  },
]

function preparar({ count = 2, results = AMOSTRA as unknown[], ...extra } = {}) {
  pacientesMock.mockReturnValue({
    data: { count, results },
    isLoading: false,
    isError: false,
    ...extra,
  })
}

describe('PacientesPage', () => {
  afterEach(() => pacientesMock.mockReset())

  it('lista com nome, CPF, telefone, dentista responsável e status', () => {
    preparar()
    renderRota(<PacientesPage />)
    expect(screen.getByRole('link', { name: 'João da Silva' })).toHaveAttribute(
      'href',
      '/pacientes/1',
    )
    expect(screen.getByText('111.222.333-44')).toBeInTheDocument()
    expect(screen.getByText('(18) 99799-9509')).toBeInTheDocument()
    expect(screen.getByText('Dr. Responsável')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Inativo')).toBeInTheDocument()
  })

  it('link "Novo paciente" aponta para a página de cadastro', () => {
    preparar()
    renderRota(<PacientesPage />)
    expect(screen.getByRole('link', { name: /novo paciente/i })).toHaveAttribute(
      'href',
      '/pacientes/novo',
    )
  })

  it('busca no servidor: passa o termo ao hook', async () => {
    preparar()
    const user = userEvent.setup()
    renderRota(<PacientesPage />)
    await user.type(screen.getByPlaceholderText(/buscar por nome ou cpf/i), 'maria')
    expect(pacientesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ pagina: 1, busca: 'maria' }),
    )
  })

  it('filtros enviam os params ao hook', async () => {
    preparar()
    const user = userEvent.setup()
    renderRota(<PacientesPage />)
    await user.selectOptions(screen.getByLabelText('Filtrar por status'), 'false')
    expect(pacientesMock).toHaveBeenLastCalledWith(expect.objectContaining({ ativo: 'false' }))
    await user.selectOptions(screen.getByLabelText('Filtrar por dentista responsável'), '3')
    expect(pacientesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ dentistaResponsavel: '3' }),
    )
  })

  it('ordena clicando no cabeçalho da coluna', async () => {
    preparar()
    const user = userEvent.setup()
    renderRota(<PacientesPage />)
    // Padrão é nome ascendente; clicar em "Nome" inverte para descendente.
    await user.click(screen.getByRole('button', { name: 'Nome' }))
    expect(pacientesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ ordenacao: '-nome_completo' }),
    )
  })

  it('paginação: "Próxima" pede a página seguinte ao hook', async () => {
    preparar({ count: 40 }) // 2 páginas de 20
    const user = userEvent.setup()
    renderRota(<PacientesPage />)
    await user.click(screen.getByRole('button', { name: /próxima/i }))
    expect(pacientesMock).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 2 }))
  })

  it('mostra estado vazio', () => {
    preparar({ count: 0, results: [] })
    renderRota(<PacientesPage />)
    expect(screen.getByText('Nenhum paciente encontrado.')).toBeInTheDocument()
  })

  it('mostra erro', () => {
    preparar({ count: 0, results: [], isError: true })
    renderRota(<PacientesPage />)
    expect(screen.getByText('Não foi possível carregar os pacientes')).toBeInTheDocument()
  })
})
