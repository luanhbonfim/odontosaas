import { CalendarCheck, Clock, ShieldCheck, TrendingDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Metrica = {
  icon: LucideIcon
  valor: string
  titulo: string
  descricao: string
}

const METRICAS: Metrica[] = [
  {
    icon: TrendingDown,
    valor: '-45%',
    titulo: 'Redução de faltas',
    descricao: 'Menos no-shows com confirmações automáticas por WhatsApp.',
  },
  {
    icon: CalendarCheck,
    valor: '100%',
    titulo: 'Sincronização em tempo real',
    descricao: 'Sua agenda no Google Calendar, direto no celular do dentista.',
  },
  {
    icon: Clock,
    valor: '+3h/dia',
    titulo: 'Economia da recepção',
    descricao: 'Fim das confirmações manuais e das planilhas paralelas.',
  },
  {
    icon: ShieldCheck,
    valor: '99.9%',
    titulo: 'Sempre no ar',
    descricao: 'Sua clínica funcionando quando você precisar, com os dados sempre protegidos.',
  },
]

export function MetricasSection() {
  return (
    <section aria-labelledby="metricas-titulo" className="border-b border-border bg-secondary/30">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <h2 id="metricas-titulo" className="sr-only">
          Resultados comprovados
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {METRICAS.map(({ icon: Icon, valor, titulo, descricao }) => (
            <div
              key={titulo}
              className="group rounded-2xl border border-border bg-card/70 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
            >
              <span className="flex size-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 ring-1 ring-primary/10 transition-colors group-hover:bg-primary/15">
                <Icon className="size-5 text-primary" aria-hidden="true" />
              </span>
              <p className="mt-4 text-3xl font-extrabold tracking-tight text-foreground">{valor}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{titulo}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{descricao}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
