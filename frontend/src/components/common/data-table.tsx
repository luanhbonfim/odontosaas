import {
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useEhDesktop } from '@/stores/ui'

/** Paginação controlada pelo servidor (1-based). Quando ausente, a `DataTable`
 * pagina no cliente. */
export type PaginacaoManual = {
  pagina: number
  totalPaginas: number
  aoMudarPagina: (pagina: number) => void
}

/** Ordenação controlada pelo servidor. `valor` é o campo (ex.: 'nome_completo' ou
 * '-nome_completo' p/ desc); vazio = ordenação padrão. Colunas ordenáveis usam o
 * `id` = campo aceito pelo backend (`?ordering=`). */
export type OrdenacaoManual = {
  valor: string
  aoMudar: (valor: string) => void
}

type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  carregando?: boolean
  vazio?: ReactNode
  paginacaoManual?: PaginacaoManual
  ordenacaoManual?: OrdenacaoManual
}

export function DataTable<T>({
  columns,
  data,
  carregando = false,
  vazio,
  paginacaoManual,
  ordenacaoManual,
}: DataTableProps<T>) {
  const [sortingCliente, setSortingCliente] = useState<SortingState>([])
  const desktop = useEhDesktop()
  const manual = paginacaoManual != null
  // No modo paginado só há ordenação se controlada pelo servidor (senão ordenaria
  // apenas a página visível, o que enganaria).
  const podeOrdenar = !manual || ordenacaoManual != null

  const sortingManual: SortingState = ordenacaoManual?.valor
    ? [
        {
          id: ordenacaoManual.valor.replace(/^-/, ''),
          desc: ordenacaoManual.valor.startsWith('-'),
        },
      ]
    : []
  const sorting = manual ? sortingManual : sortingCliente

  const aoMudarSorting: OnChangeFn<SortingState> = (updater) => {
    if (manual && ordenacaoManual) {
      const novo = typeof updater === 'function' ? updater(sortingManual) : updater
      const s = novo[0]
      ordenacaoManual.aoMudar(s ? (s.desc ? `-${s.id}` : s.id) : '')
    } else {
      setSortingCliente(updater)
    }
  }

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: aoMudarSorting,
    enableSorting: podeOrdenar,
    enableMultiSort: false,
    manualSorting: manual,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(manual ? { manualPagination: true } : { getPaginationRowModel: getPaginationRowModel() }),
  })

  const linhas = table.getRowModel().rows
  const textoVazio = vazio ?? 'Nenhum registro encontrado.'

  return (
    <div className="space-y-3">
      {desktop ? (
        // Desktop/tablet largo: tabela
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((grupo) => (
                <TableRow key={grupo.id}>
                  {grupo.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-50" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {carregando ? (
                [...Array(5).keys()].map((linha) => (
                  <TableRow key={linha}>
                    {[...Array(columns.length).keys()].map((coluna) => (
                      <TableCell key={coluna}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : linhas.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    {textoVazio}
                  </TableCell>
                </TableRow>
              ) : (
                linhas.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        // Mobile/tablet estreito: cada linha vira um card empilhado (rótulo: valor)
        <div className="space-y-3">
          {carregando ? (
            [...Array(3).keys()].map((linha) => (
              <div key={linha} className="rounded-lg border bg-card p-4">
                <Skeleton className="h-16 w-full" />
              </div>
            ))
          ) : linhas.length === 0 ? (
            <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
              {textoVazio}
            </div>
          ) : (
            linhas.map((row) => (
              <div key={row.id} className="space-y-1.5 rounded-lg border bg-card p-4">
                {row.getVisibleCells().map((cell) => {
                  const cabecalho = cell.column.columnDef.header
                  const rotulo = typeof cabecalho === 'string' ? cabecalho : ''
                  return (
                    <div key={cell.id} className="flex items-start justify-between gap-3 text-sm">
                      {rotulo && <span className="text-muted-foreground">{rotulo}</span>}
                      <span className={rotulo ? 'text-right font-medium' : 'ml-auto'}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}

      {(() => {
        const pagina = manual ? paginacaoManual.pagina : table.getState().pagination.pageIndex + 1
        const totalPaginas = manual ? paginacaoManual.totalPaginas : table.getPageCount()
        if (totalPaginas <= 1) return null
        const irPara = (p: number) =>
          manual ? paginacaoManual.aoMudarPagina(p) : table.setPageIndex(p - 1)
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => irPara(pagina - 1)}
              disabled={pagina <= 1}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {pagina} de {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => irPara(pagina + 1)}
              disabled={pagina >= totalPaginas}
            >
              Próxima
            </Button>
          </div>
        )
      })()}
    </div>
  )
}
