import type { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/common/data-table'
import { StatusBadge } from '@/components/common/status-badge'
import { Card, CardContent } from '@/components/ui/card'

import { type Insumo, useInsumosAlertas } from './use-estoque'

const traco = <span className="text-muted-foreground">—</span>

export function AbaAlertas() {
  const { data, isLoading } = useInsumosAlertas()
  const insumos = data ?? []

  const colunas: ColumnDef<Insumo, unknown>[] = [
    { accessorKey: 'nome', header: 'Nome' },
    {
      id: 'categoria',
      header: 'Categoria',
      cell: ({ row }) => row.original.categoria_nome || traco,
    },
    {
      id: 'saldo',
      header: 'Saldo',
      cell: ({ row }) => <span className="tabular-nums">{row.original.saldo}</span>,
    },
    {
      id: 'minimo',
      header: 'Mínimo',
      cell: ({ row }) => <span className="tabular-nums">{row.original.estoque_minimo}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: () => <StatusBadge variante="erro">Estoque baixo</StatusBadge>,
    },
  ]

  if (!isLoading && insumos.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Nenhum insumo abaixo do estoque mínimo no momento.
        </CardContent>
      </Card>
    )
  }

  return (
    <DataTable
      columns={colunas}
      data={insumos}
      carregando={isLoading}
      vazio="Nenhum insumo abaixo do estoque mínimo."
      cardMobile={(insumo) => (
        <div className="space-y-2.5">
          <p className="font-semibold">{insumo.nome}</p>
          <p className="text-xs text-muted-foreground">{insumo.categoria_nome || 'Sem categoria'}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm tabular-nums">
              {insumo.saldo} / {insumo.estoque_minimo}
            </span>
            <StatusBadge variante="erro">Estoque baixo</StatusBadge>
          </div>
        </div>
      )}
    />
  )
}
