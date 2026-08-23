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
    titulo: 'Uptime garantido',
    descricao: 'Alta disponibilidade com isolamento total de dados por clínica.',
  },
]

export function MetricasSection() {
  return (
    <section aria-labelledby="metricas-titulo" className="border-b border-[#1E2D56] bg-[#0B132B]">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <h2 id="metricas-titulo" className="sr-only">
          Resultados comprovados
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {METRICAS.map(({ icon: Icon, valor, titulo, descricao }) => (
            <div
              key={titulo}
              className="rounded-2xl border border-[#1E2D56] bg-[#111D3B]/70 p-6 backdrop-blur-md transition-colors hover:border-[#D4AF37]/50"
            >
              <span className="flex size-11 items-center justify-center rounded-xl border border-[#1E2D56] bg-[#0B132B]">
                <Icon className="size-5 text-[#D4AF37]" aria-hidden="true" />
              </span>
              <p className="mt-4 text-3xl font-extrabold tracking-tight text-slate-100">{valor}</p>
              <p className="mt-1 text-sm font-semibold text-slate-200">{titulo}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{descricao}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
