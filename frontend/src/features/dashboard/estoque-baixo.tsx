import { AlertTriangle } from 'lucide-react'

import { cn } from '@/lib/utils'

export type ItemEstoqueBaixo = { item: string; unidade: string; atual: number; minimo: number }

/** Lista de insumos abaixo do estoque mínimo, com barra de nível. */
export function EstoqueBaixoLista({ itens }: { itens: ItemEstoqueBaixo[] }) {
  if (itens.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum insumo abaixo do mínimo.</p>
  }
  return (
    <ul className="space-y-4">
      {itens.map((item) => {
        // Saldo pode ser negativo (estoque negativo é permitido) — a barra não passa de 0.
        const razao = Math.max(0, Math.min(1, item.atual / item.minimo))
        const critico = item.atual < item.minimo / 2
        return (
          <li key={item.item} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                {critico && <AlertTriangle className="size-3.5 text-destructive" />}
                {item.item}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {item.atual}/{item.minimo} {item.unidade}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full', critico ? 'bg-destructive' : 'bg-warning')}
                style={{ width: `${razao * 100}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
