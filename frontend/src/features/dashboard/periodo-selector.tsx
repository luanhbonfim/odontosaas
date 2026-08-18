import { cn } from '@/lib/utils'

import { type Periodo, periodos } from './dados-demo'

type PeriodoSelectorProps = {
  valor: Periodo
  aoMudar: (periodo: Periodo) => void
}

/** Segmented control para escolher o período exibido no dashboard. */
export function PeriodoSelector({ valor, aoMudar }: PeriodoSelectorProps) {
  return (
    <div
      role="tablist"
      aria-label="Período do dashboard"
      className="inline-flex rounded-lg border bg-card p-1"
    >
      {periodos.map((opcao) => {
        const ativo = opcao.valor === valor
        return (
          <button
            key={opcao.valor}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => aoMudar(opcao.valor)}
            className={cn(
              'cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              ativo
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opcao.rotulo}
          </button>
        )
      })}
    </div>
  )
}
