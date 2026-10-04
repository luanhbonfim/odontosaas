import type { ColumnDef } from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShieldAlert } from 'lucide-react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { DataTable } from '@/components/common/data-table'
import { EmptyState } from '@/components/common/empty-state'
import { BuscaGlobal } from '@/features/busca/busca-global'

import { violacoesAxe } from './axe'

vi.mock('@/features/busca/use-busca', () => ({
  MIN_CARACTERES_BUSCA: 2,
  useBusca: () => ({
    data: {
      pacientes: [
        { id: 1, nome_completo: 'Ana', cpf: '11122233344', ativo: true, telefone_whatsapp: '' },
      ],
      consultas: [],
    },
    isFetching: false,
    isError: false,
  }),
}))
vi.mock('@/lib/hooks/use-debounce', () => ({ useDebounce: (v: string) => v }))
// Ambiente de teste = desktop (tabela, não cards).
vi.mock('@/stores/ui', () => ({ useEhDesktop: () => true, useEhTelaLarga: () => true }))

type Linha = { id: number; nome: string }
const COLUNAS: ColumnDef<Linha, unknown>[] = [
  { accessorKey: 'nome', header: 'Nome' },
  // Coluna só de ações: cabeçalho vazio (regressão: `empty-table-header`).
  { id: 'acoes', header: '', enableSorting: false, cell: () => <button type="button">Editar</button> },
]

describe('acessibilidade (axe, WCAG 2.1 AA)', () => {
  it('DataTable com coluna de ações não tem violações e nomeia o cabeçalho vazio', async () => {
    const { container } = render(
      <DataTable columns={COLUNAS} data={[{ id: 1, nome: 'Ana' }]} vazio="Nada." />,
    )
    expect(screen.getByRole('columnheader', { name: 'Ações' })).toBeInTheDocument()
    expect(await violacoesAxe(container)).toEqual([])
  })

  it('EmptyState usa h2 (sem pular nível depois do h1 da página)', async () => {
    const { container } = render(
      <main>
        <h1>Página</h1>
        <EmptyState icone={ShieldAlert} titulo="Sem dados" descricao="Nada por aqui." />
      </main>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Sem dados' })).toBeInTheDocument()
    expect(await violacoesAxe(container)).toEqual([])
  })

  it('busca global (combobox + listbox) aberta não tem violações', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <BuscaGlobal />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Buscar paciente ou consulta' }))
    await user.type(screen.getByRole('combobox'), 'ana')
    expect(await violacoesAxe(screen.getByRole('dialog'))).toEqual([])
  })
})
