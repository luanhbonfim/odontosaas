import type { ReactNode } from 'react'

type PageHeaderProps = {
  titulo: string
  descricao?: string
  acoes?: ReactNode
}

export function PageHeader({ titulo, descricao, acoes }: PageHeaderProps) {
  return (
    // Mobile: título/descrição em cima e ações embaixo (empilhado, sem colar).
    // sm+: lado a lado com o título à esquerda e as ações à direita.
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight sm:text-2xl">{titulo}</h1>
        {descricao && <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{descricao}</p>}
      </div>
      {/* Mobile: ações ocupam 100% da largura (full-width). sm+: voltam ao tamanho natural. */}
      {acoes && (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
          {acoes}
        </div>
      )}
    </div>
  )
}
