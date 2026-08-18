import { AlertTriangle } from 'lucide-react'

import { cn } from '@/lib/utils'

import { estoqueBaixo } from './dados-demo'

/** Lista de insumos abaixo do estoque mínimo, com barra de nível. */
export function EstoqueBaixoLista() {
  return (
    <ul className="space-y-4">
      {estoqueBaixo.map((item) => {
        const razao = Math.min(1, item.atual / item.minimo)
        const critico = item.atual < item.minimo / 2
        return (
          <li key={item.item} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                {critico && <AlertTriangle className="size-3.5 text-destructive" />}
                {item.item}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {item.atual}/{item.minimo}
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
