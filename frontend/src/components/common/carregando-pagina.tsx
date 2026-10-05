import { Skeleton } from '@/components/ui/skeleton'

/** Fallback padrão enquanto o chunk de uma página carrega (Suspense de rota): título +
 * blocos em skeleton, anunciado como "Carregando" para leitores de tela. */
export function CarregandoPagina() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
      <span className="sr-only">Carregando…</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[92px] w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
