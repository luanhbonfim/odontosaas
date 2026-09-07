import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PermissoesPage } from './permissoes-page'

const { gradeMock, salvarMock } = vi.hoisted(() => ({
  gradeMock: vi.fn(),
  salvarMock: vi.fn(),
}))
vi.mock('./use-permissoes', () => ({
  usePermissoesModulo: gradeMock,
  useSalvarPermissoesModulo: () => ({ mutateAsync: salvarMock, isPending: false }),
}))

function celula(papel: 'RECEPCAO' | 'DENTISTA', modulo: string, overrides = {}) {
  return { papel, modulo, ver: false, criar: false, editar: false, excluir: false, ...overrides }
}

const MODULOS = [
  'agenda',
  'pacientes',
  'convenios',
  'dentistas',
  'procedimentos',
  'estoque',
  'financeiro',
  'notificacoes',
  'usuarios',
]

function gradeVazia() {
  const grade = []
  for (const papel of ['RECEPCAO', 'DENTISTA'] as const) {
    for (const modulo of MODULOS) grade.push(celula(papel, modulo))
  }
  return grade
}

describe('PermissoesPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('acesso restrito: mostra o EmptyState quando a API retorna erro (403)', () => {
    gradeMock.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<PermissoesPage />)
    expect(screen.getByText('Acesso restrito')).toBeInTheDocument()
  })

  it('lista as duas tabelas (Recepção e Dentista) com os módulos', () => {
    gradeMock.mockReturnValue({ data: gradeVazia(), isLoading: false, isError: false })
    render(<PermissoesPage />)
    expect(screen.getByText('Recepção')).toBeInTheDocument()
    expect(screen.getByText('Dentista')).toBeInTheDocument()
    expect(screen.getAllByText('Financeiro')).toHaveLength(2)
  })

  it('cada tela começa recolhida: só o toggle "Ver" aparece até expandir', () => {
    const grade = gradeVazia().map((c) =>
      c.papel === 'RECEPCAO' && c.modulo === 'agenda'
        ? { ...c, ver: true, criar: true, editar: true, excluir: true }
        : c,
    )
    gradeMock.mockReturnValue({ data: grade, isLoading: false, isError: false })
    render(<PermissoesPage />)

    expect(screen.getByLabelText('Recepção — Agenda — Ver')).toBeInTheDocument()
    expect(screen.queryByLabelText('Recepção — Agenda — Criar')).toBeNull()
  })

  it('expandir uma tela mostra as permissões descritivas de criar/editar/excluir', async () => {
    const grade = gradeVazia().map((c) =>
      c.papel === 'RECEPCAO' && c.modulo === 'agenda'
        ? { ...c, ver: true, criar: true, editar: true, excluir: true }
        : c,
    )
    gradeMock.mockReturnValue({ data: grade, isLoading: false, isError: false })
    const user = userEvent.setup()
    render(<PermissoesPage />)

    // Recepção e Dentista têm cada um seu próprio card "Agenda" -> pega o 1º (Recepção).
    await user.click(screen.getAllByRole('button', { name: 'Expandir permissões de Agenda' })[0])

    expect(screen.getByText('Permite cadastrar nova consulta')).toBeInTheDocument()
    expect(screen.getByText('Permite editar a consulta')).toBeInTheDocument()
    expect(screen.getByText('Permite excluir a consulta')).toBeInTheDocument()
  })

  it('desmarcar "Ver" desabilita e desmarca Criar/Editar/Excluir da mesma linha', async () => {
    const grade = gradeVazia().map((c) =>
      c.papel === 'RECEPCAO' && c.modulo === 'agenda'
        ? { ...c, ver: true, criar: true, editar: true, excluir: true }
        : c,
    )
    gradeMock.mockReturnValue({ data: grade, isLoading: false, isError: false })
    const user = userEvent.setup()
    render(<PermissoesPage />)

    // Recepção e Dentista têm cada um seu próprio card "Agenda" -> pega o 1º (Recepção).
    await user.click(screen.getAllByRole('button', { name: 'Expandir permissões de Agenda' })[0])

    const verAgendaRecepcao = screen.getByLabelText('Recepção — Agenda — Ver')
    const criarAgendaRecepcao = screen.getByLabelText('Recepção — Agenda — Criar') as HTMLInputElement
    expect(criarAgendaRecepcao).toBeChecked()
    expect(criarAgendaRecepcao).not.toBeDisabled()

    await user.click(verAgendaRecepcao)

    expect(criarAgendaRecepcao).not.toBeChecked()
    expect(criarAgendaRecepcao).toBeDisabled()
  })

  it('Salvar chama a mutation com a grade editada', async () => {
    const grade = gradeVazia()
    gradeMock.mockReturnValue({ data: grade, isLoading: false, isError: false })
    salvarMock.mockResolvedValue(grade)
    const user = userEvent.setup()
    render(<PermissoesPage />)

    await user.click(screen.getByLabelText('Recepção — Convênios — Ver'))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(salvarMock).toHaveBeenCalled())
    const gradeEnviada = salvarMock.mock.calls[0][0]
    const linha = gradeEnviada.find(
      (c: { papel: string; modulo: string }) => c.papel === 'RECEPCAO' && c.modulo === 'convenios',
    )
    expect(linha.ver).toBe(true)
  })
})
