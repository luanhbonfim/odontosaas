import type { ComponentType } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type KpiCardProps = {
  titulo: string
  valor: string
  icone: ComponentType<{ className?: string }>
  variacao?: number
  legenda?: string
  /** Quando true, uma variação negativa é "boa" (ex.: custos, contas a pagar). */
  inverterCor?: boolean
}

/** Cartão de indicador (KPI) com valor, ícone e variação opcional. */
export function KpiCard({
  titulo,
  valor,
  icone: Icone,
  variacao,
  legenda,
  inverterCor = false,
}: KpiCardProps) {
  const subiu = (variacao ?? 0) >= 0
  const bom = inverterCor ? !subiu : subiu
  const IconeTendencia = subiu ? TrendingUp : TrendingDown

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{titulo}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{valor}</p>
          {variacao !== undefined ? (
            <p
              className={cn(
                'mt-1 flex items-center gap-1 text-xs font-medium',
                bom ? 'text-success' : 'text-destructive',
              )}
            >
              <IconeTendencia className="size-3.5" />
              {subiu ? '+' : ''}
              {variacao}%
              {legenda ? <span className="text-muted-foreground"> {legenda}</span> : null}
            </p>
          ) : legenda ? (
            <p className="mt-1 text-xs text-muted-foreground">{legenda}</p>
          ) : null}
        </div>
        <span className="rounded-lg bg-accent p-2 text-accent-foreground">
          <Icone className="size-5" />
        </span>
      </CardContent>
    </Card>
  )
}
