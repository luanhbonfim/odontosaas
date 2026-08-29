import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type VarianteStatus = 'sucesso' | 'pendente' | 'erro' | 'info' | 'neutro' | 'faltou'

// Fonte única das cores de status (espelham a agenda). Cor NUNCA sozinha:
// sempre acompanha o rótulo (acessibilidade / daltonismo).
const cores: Record<VarianteStatus, string> = {
  sucesso: 'bg-success',
  pendente: 'bg-warning',
  erro: 'bg-destructive', // vermelho (cancelada)
  info: 'bg-info',
  neutro: 'bg-muted-foreground',
  faltou: 'bg-red-900 dark:bg-red-700', // vermelho escuro (tom distinto do cancelado)
}

export function StatusBadge({
  variante,
  children,
  className,
}: {
  variante: VarianteStatus
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-0.5 text-xs font-medium',
        className,
      )}
    >
      <span className={cn('size-2 rounded-full', cores[variante])} aria-hidden="true" />
      {children}
    </span>
  )
}
