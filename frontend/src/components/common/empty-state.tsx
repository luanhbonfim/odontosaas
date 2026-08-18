import type { ComponentType, ReactNode } from 'react'

type EmptyStateProps = {
  icone?: ComponentType<{ className?: string }>
  titulo: string
  descricao?: string
  acao?: ReactNode
}

export function EmptyState({ icone: Icone, titulo, descricao, acao }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
      {Icone && <Icone className="mb-3 size-10 text-muted-foreground" />}
      <h3 className="text-sm font-medium">{titulo}</h3>
      {descricao && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}
