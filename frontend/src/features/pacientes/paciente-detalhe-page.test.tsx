import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { PacienteDetalhePage } from './paciente-detalhe-page'

const { pacienteMock, criarMock, atualizarMock } = vi.hoisted(() => ({
  pacienteMock: vi.fn(),
  criarMock: vi.fn(),
  atualizarMock: vi.fn(),
}))

const PACIENTE = {
  id: 5,
  nome_completo: 'João da Silva',
  cpf: '11122233344',
  data_nascimento: null,
  telefone_whatsapp: '',
  email: '',
  endereco: '',
  ativo: true,
}
const PLANO = {
  id: 1,
  convenio: 1,
  convenio_nome: 'Amil',
  numero_carteirinha: '',
  validade: null,
  status: 'ATIVO',
}
const CONSULTA = {
  id: 1,
  inicio: '2026-07-24T12:00:00Z',
  dentista: 3,
  procedimento: 'Limpeza',
  status: 'AGENDADA',
  status_confirmacao: 'PENDENTE',
}
const CONSULTA_CANCELADA = {
  id: 2,
  inicio: '2026-07-25T12:00:00Z',
  dentista: 3,
  procedimento: 'Canal',
  status: 'CANCELADA',
  status_confirmacao: 'RECUSADA',
}

vi.mock('./use-paciente-detalhe', () => ({
  usePaciente: pacienteMock,
  usePlanosDoPaciente: () => ({ data: [PLANO], isLoading: false }),
  useGuiasDoPaciente: () => ({ data: [], isLoading: false }),
  useConsultasDoPaciente: () => ({ data: [CONSULTA, CONSULTA_CANCELADA], isLoading: false }),
  useAnamnesesDoPaciente: () => ({ data: [], isLoading: false }),
  useCriarAnamnese: () => ({ mutateAsync: vi.fn() }),
  useCriarPlano: () => ({ mutateAsync: vi.fn() }),
  useAtualizarPlano: () => ({ mutateAsync: vi.fn() }),
  useRemoverPlano: () => ({ mutateAsync: vi.fn() }),
  useCriarGuia: () => ({ mutateAsync: vi.fn() }),
  useAtualizarGuia: () => ({ mutateAsync: vi.fn() }),
  useRemoverGuia: () => ({ mutateAsync: vi.fn() }),
}))
// AbaDados usa estes hooks para salvar.
vi.mock('./use-pacientes', () => ({
  useCriarPaciente: () => ({ mutateAsync: criarMock }),
  useAtualizarPaciente: () => ({ mutateAsync: atualizarMock }),
}))
vi.mock('@/features/dentistas/use-dentistas', () => ({
  useDentistas: () => ({ data: [{ id: 3, nome_completo: 'Dra. Ana' }] }),
}))
vi.mock('@/features/auth/use-sessao', () => ({
  useSessao: () => ({ usuario: { papel: 'ADMIN' } }),
}))
// AbaPlanos monta o drawer de plano (usa o catálogo de convênios).
vi.mock('@/features/convenios/use-convenios', () => ({
  useConvenios: () => ({ data: [{ id: 1, nome: 'Amil', ativo: true }] }),
}))

function renderRota(entrada: string, path: string) {
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path={path} element={<PacienteDetalhePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PacienteDetalhePage', () => {
  it('exibe os dados (read-only) e alterna para edição inline', async () => {
    pacienteMock.mockReturnValue({ data: PACIENTE, isLoading: false, isError: false })
    renderRota('/pacientes/5', '/pacientes/:id')

    expect(screen.getByRole('heading', { name: 'João da Silva' })).toBeInTheDocument()
    expect(screen.getByText('111.222.333-44')).toBeInTheDocument()

    // Editar -> formulário inline com os valores carregados.
    await userEvent.setup().click(screen.getByRole('button', { name: /editar/i }))
    expect(screen.getByLabelText(/nome/i)).toHaveValue('João da Silva')
  })

  it('modo criação: mostra o formulário vazio de Dados', () => {
    pacienteMock.mockReturnValue({ data: undefined, isLoading: false, isError: false })
    renderRota('/pacientes/novo', '/pacientes/novo')

    expect(screen.getByRole('heading', { name: 'Novo paciente' })).toBeInTheDocument()
    expect(screen.getByLabelText(/nome/i)).toHaveValue('')
    expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument()
  })

  it('modo criação: abas de relações pedem para salvar primeiro', async () => {
    pacienteMock.mockReturnValue({ data: undefined, isLoading: false, isError: false })
    renderRota('/pacientes/novo', '/pacientes/novo')
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Planos' }))
    expect(await screen.findByText(/salve o paciente primeiro/i)).toBeInTheDocument()
  })

  it('aba Planos lista os planos do paciente', async () => {
    pacienteMock.mockReturnValue({ data: PACIENTE, isLoading: false, isError: false })
    renderRota('/pacientes/5', '/pacientes/:id')
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Planos' }))
    expect(await screen.findByText('Amil')).toBeInTheDocument()
  })

  it('aba Consultas: dentista, cobrança, aviso de ficha e link para a ficha', async () => {
    pacienteMock.mockReturnValue({ data: PACIENTE, isLoading: false, isError: false })
    renderRota('/pacientes/5', '/pacientes/:id')
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Consultas' }))

    expect(await screen.findAllByText('Dra. Ana')).not.toHaveLength(0)
    // Sem convênio -> Particular; sem dentes -> ficha não preenchida (na tabela;
    // "Particular" também existe como opção de filtro, por isso escopamos à tabela).
    const tabela = screen.getByRole('table')
    expect(within(tabela).getAllByText('Particular').length).toBeGreaterThan(0)
    expect(within(tabela).getAllByText('Ficha não preenchida').length).toBeGreaterThan(0)
    // AGENDADA é link para a ficha; CANCELADA (id 2) NÃO é clicável.
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(links).toContain('/pacientes/5/consultas/1')
    expect(links).not.toContain('/pacientes/5/consultas/2')
  })
})
