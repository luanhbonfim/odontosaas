/* eslint-disable react-refresh/only-export-components -- kit do tema vendor: componentes + tokens */
/**
 * Kit de UI do Vendor Admin — tema Dark Navy/Gold compartilhado.
 *
 * Centraliza cores e componentes repetidos em várias telas do painel, para eliminar
 * o "drift" (hovers de gold divergentes, bordas slate-700 vs #1E2D56, headers
 * remontados à mão). Use estes tokens/componentes em vez de classes cruas.
 */
import { forwardRef, type ComponentProps, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Tokens de cor do tema vendor (classe Tailwind arbitrária). Fonte única. */
export const VENDOR = {
  fundo: '#0B132B', // fundo base do painel
  card: '#111D3B', // superfície de card/modal
  elevado: '#0F1B38', // superfície elevada (headers de modal)
  borda: '#1E2D56', // borda padrão
  gold: '#D4AF37', // marca
  goldHover: '#c49f2e', // hover do botão primário (único)
  hoverSup: '#152345', // hover de superfície/nav
  hoverSup2: '#1A2A4E', // hover de botão secundário
  ativo: '#19294F', // item ativo do menu
} as const

// IMPORTANTE: classes Tailwind precisam ser strings LITERAIS (o JIT não gera classes
// montadas por interpolação). Por isso os tokens hex acima servem só para estilo inline;
// as classes abaixo são escritas por extenso.

/** Card padrão do vendor (superfície + borda + texto claro). */
export const cardVendorCls = 'border border-[#1E2D56] bg-[#111D3B] text-slate-100 shadow-md'

/** Select nativo no tema do vendor (mesma altura/rounded/focus dos inputs). */
export const selectVendorCls =
  'h-9 w-full cursor-pointer rounded-md bg-[#0B132B]/80 border border-[#1E2D56] px-3 text-xs text-white focus:outline-none focus:border-[#D4AF37]'

/** Botão primário dourado — hover e cor de texto padronizados. */
export const BotaoVendorPrimario = forwardRef<HTMLButtonElement, ComponentProps<typeof Button>>(
  function BotaoVendorPrimario({ className, children, ...props }, ref) {
    return (
      <Button
        ref={ref}
        className={cn(
          'bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 font-bold shadow-md',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      >
        {children}
      </Button>
    )
  },
)

/** Botão secundário (outline navy) — para Cancelar/ações neutras. */
export const BotaoVendorSecundario = forwardRef<HTMLButtonElement, ComponentProps<typeof Button>>(
  function BotaoVendorSecundario({ className, children, ...props }, ref) {
    return (
      <Button
        ref={ref}
        variant="outline"
        className={cn(
          'border-[#1E2D56] bg-transparent text-slate-300 hover:bg-[#1A2A4E] hover:text-white',
          className,
        )}
        {...props}
      >
        {children}
      </Button>
    )
  },
)

/** Cabeçalho de página padrão do vendor: ícone (opcional) + título + descrição + ações. */
export function VendorPageHeader({
  icone: Icone,
  titulo,
  descricao,
  acoes,
}: {
  icone?: LucideIcon
  titulo: string
  descricao?: ReactNode
  acoes?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {Icone && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#D4AF37]">
            <Icone className="size-5" />
          </span>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{titulo}</h1>
          {descricao && <p className="text-xs text-slate-400">{descricao}</p>}
        </div>
      </div>
      {acoes && <div className="flex items-center gap-2">{acoes}</div>}
    </div>
  )
}
