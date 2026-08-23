import type { ColumnDef } from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DataTable } from './data-table'

// DataTable decide "tabela x cards" por `useEhTelaLarga` (>= lg): true = tabela, false = cards.
const { ehDesktopMock } = vi.hoisted(() => ({ ehDesktopMock: vi.fn(() => true) }))
vi.mock('@/stores/ui', () => ({ useEhTelaLarga: ehDesktopMock }))

type Linha = { nome: string; telefone: string }

const columns: ColumnDef<Linha, unknown>[] = [
  { accessorKey: 'nome', header: 'Nome' },
  { accessorKey: 'telefone', header: 'Telefone' },
]

describe('DataTable', () => {
  beforeEach(() => ehDesktopMock.mockReturnValue(true))

  it('renderiza cabeçalhos e linhas (desktop)', () => {
    render(<DataTable columns={columns} data={[{ nome: 'Maria', telefone: '(18) 99799-9509' }]} />)
    expect(screen.getByText('Nome')).toBeInTheDocument()
    expect(screen.getByText('Maria')).toBeInTheDocument()
    expect(screen.getByText('(18) 99799-9509')).toBeInTheDocument()
  })

  it('mostra estado vazio personalizado', () => {
    render(<DataTable columns={columns} data={[]} vazio="Sem pacientes" />)
    expect(screen.getByText('Sem pacientes')).toBeInTheDocument()
  })

  it('mostra skeletons durante o carregamento', () => {
    const { container } = render(<DataTable columns={columns} data={[]} carregando />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('no mobile, renderiza os dados como cards empilhados', () => {
    ehDesktopMock.mockReturnValue(false)
    render(<DataTable columns={columns} data={[{ nome: 'Maria', telefone: '(18) 99799-9509' }]} />)
    // rótulo (cabeçalho) + valor aparecem no card
    expect(screen.getByText('Maria')).toBeInTheDocument()
    expect(screen.getByText('(18) 99799-9509')).toBeInTheDocument()
  })
})
