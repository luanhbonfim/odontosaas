/* eslint-disable react-refresh/only-export-components -- kit compartilhado: componentes + util de classe */
import type { ComponentType, ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

/** Classe padrão dos <select> nativos dos formulários (mesmo visual dos inputs). */
export const classeCampoSelect = cn(
  'h-9 w-full cursor-pointer rounded-md border bg-transparent px-3 text-sm',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
)

/** Cabeçalho do drawer com ícone em círculo + título + descrição. */
export function CabecalhoDrawer({
  icone: Icone,
  titulo,
  descricao,
}: {
  icone: ComponentType<{ className?: string }>
  titulo: string
  descricao?: ReactNode
}) {
  return (
    <SheetHeader className="gap-0 space-y-0">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icone className="size-5" />
        </span>
        <SheetTitle>{titulo}</SheetTitle>
      </div>
      {descricao && <SheetDescription className="mt-2">{descricao}</SheetDescription>}
    </SheetHeader>
  )
}

/** Corpo rolável do drawer (para formulários longos não estourarem a altura). */
export function CorpoDrawer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('-mx-6 flex-1 overflow-y-auto px-6 py-1', className)}>
      <div className="space-y-5">{children}</div>
    </div>
  )
}

/** Seção com título (agrupa campos relacionados). */
export function SecaoForm({
  titulo,
  icone: Icone,
  children,
}: {
  titulo: string
  icone?: ComponentType<{ className?: string }>
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {Icone && <Icone className="size-3.5" />}
        {titulo}
      </h3>
      {children}
    </section>
  )
}

/** Campo: label (+ obrigatório) + controle + ajuda/erro, com espaçamento padrão. */
export function Campo({
  id,
  label,
  obrigatorio,
  ajuda,
  erro,
  children,
  className,
}: {
  id?: string
  label?: ReactNode
  obrigatorio?: boolean
  ajuda?: ReactNode
  erro?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {obrigatorio && (
            <span aria-hidden="true" className="text-destructive">
              {' '}
              *
            </span>
          )}
        </Label>
      )}
      {children}
      {erro ? (
        <p className="text-xs text-destructive">{erro}</p>
      ) : ajuda ? (
        <p className="text-xs text-muted-foreground">{ajuda}</p>
      ) : null}
    </div>
  )
}

/** Linha de toggle (checkbox estilizado) com título + ajuda — mais amigável. */
export function LinhaToggle({
  titulo,
  ajuda,
  className,
  ...props
}: {
  titulo: ReactNode
  ajuda?: ReactNode
  className?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3',
        'has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5',
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{titulo}</span>
        {ajuda && <span className="mt-0.5 block text-xs text-muted-foreground">{ajuda}</span>}
      </span>
      <input type="checkbox" className="size-5 shrink-0 cursor-pointer accent-primary" {...props} />
    </label>
  )
}
