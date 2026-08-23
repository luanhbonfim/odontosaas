import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export type ItemSegmento = { id: string; rotulo: string; icone: LucideIcon }

/**
 * Segmentador de seções fixo no rodapé (SÓ mobile, `< md`). Serve para páginas
 * densas (ex.: Dashboard, Notificações): em vez de rolar seções empilhadas, o
 * usuário troca de seção por ícones no rodapé. No desktop fica escondido (as
 * seções aparecem normalmente / abas no topo).
 *
 * Controlado: o pai mantém o `ativo` e troca via `aoMudar`. Lembre de dar um
 * padding-bottom (ex.: `pb-20 md:pb-0`) no conteúdo para ele não ficar atrás da barra.
 */
export function SegmentadorRodape({
  itens,
  ativo,
  aoMudar,
}: {
  itens: ItemSegmento[]
  ativo: string
  aoMudar: (id: string) => void
}) {
  if (itens.length < 2) return null
  return (
    <nav
      aria-label="Seções da página"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {itens.map((it) => {
        const ativoItem = it.id === ativo
        return (
          <button
            key={it.id}
            type="button"
            aria-current={ativoItem ? 'page' : undefined}
            onClick={() => aoMudar(it.id)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
              ativoItem ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <it.icone className="size-5" />
            <span className="max-w-full truncate px-1">{it.rotulo}</span>
          </button>
        )
      })}
    </nav>
  )
}
