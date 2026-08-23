import { ArrowRight, CalendarCheck, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react'

import { linkWhatsApp, MSG_DEMONSTRACAO } from '../whatsapp'

const BADGES = [
  { icon: MessageCircle, label: 'WhatsApp automatizado' },
  { icon: CalendarCheck, label: 'Sync Google Calendar' },
  { icon: ShieldCheck, label: 'Dados seguros (LGPD)' },
]

export function HeroSection() {
  return (
    <section
      id="topo"
      className="relative overflow-hidden border-b border-border scroll-mt-24"
      aria-labelledby="hero-titulo"
    >
      {/* Mesh de gradiente sutil (rosa + dourado) ao fundo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(48rem 38rem at 12% -8%, oklch(0.74 0.13 85 / 0.16), transparent 60%), radial-gradient(42rem 34rem at 105% 8%, oklch(0.7 0.13 350 / 0.16), transparent 55%), radial-gradient(36rem 30rem at 50% 120%, oklch(0.74 0.13 85 / 0.08), transparent 60%)',
        }}
      />
      {/* Grade futurista bem sutil */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(60rem_40rem_at_50%_0%,black,transparent)]"
        style={{
          backgroundImage:
            'linear-gradient(to right, oklch(0.74 0.13 85 / 0.12) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.74 0.13 85 / 0.12) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-8 lg:px-8 lg:py-24">
        {/* Coluna de texto */}
        <div className="flex flex-col items-start">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-card/70 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm shadow-primary/10 ring-1 ring-primary/10 backdrop-blur-md">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            Software Odontológico de Próxima Geração • Inteligência Artificial integrada
          </span>

          <h1
            id="hero-titulo"
            className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl"
          >
            A gestão completa da sua clínica odontológica,{' '}
            <span className="bg-gradient-to-r from-primary to-[oklch(0.68_0.14_40)] bg-clip-text text-transparent">
              simplificada e inteligente.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Elimine faltas de pacientes com confirmações automáticas por WhatsApp, sincronize sua
            agenda em tempo real com o Google Calendar e tenha controle financeiro e clínico total em
            uma única plataforma na nuvem.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <a
              href="#planos"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
            >
              Ver Planos &amp; Começar
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </a>
            <a
              href={linkWhatsApp(MSG_DEMONSTRACAO)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card/70 px-6 py-3.5 text-base font-semibold text-foreground shadow-sm backdrop-blur-md transition-all hover:border-[#25D366] hover:text-[#128C4A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366] sm:w-auto"
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              Agendar Demonstração
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            {BADGES.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4 text-success" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Mockup do dashboard */}
        <div className="relative">
          <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-2xl shadow-primary/10 ring-1 ring-primary/10 backdrop-blur-md transition-transform duration-500 hover:-translate-y-1">
            <div className="mb-4 flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-destructive/60" />
              <span className="size-3 rounded-full bg-warning/70" />
              <span className="size-3 rounded-full bg-success/70" />
              <span className="ml-3 text-xs font-medium text-muted-foreground">
                sua-clinica.proclinica.cloud
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { titulo: 'Consultas Hoje', valor: '18' },
                { titulo: 'Confirmadas', valor: '15' },
                { titulo: 'Faturamento', valor: 'R$ 9,2k' },
              ].map((kpi) => (
                <div key={kpi.titulo} className="rounded-xl border border-border bg-background/70 p-3">
                  <p className="text-[11px] font-medium text-muted-foreground">{kpi.titulo}</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{kpi.valor}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              {[
                { hora: '09:00', paciente: 'Ana Souza', cor: 'bg-primary' },
                { hora: '10:30', paciente: 'Carlos Lima', cor: 'bg-[oklch(0.7_0.13_350)]' },
                { hora: '14:00', paciente: 'Marina Reis', cor: 'bg-success' },
              ].map((ag) => (
                <div
                  key={ag.hora}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background/60 px-3 py-2.5"
                >
                  <span className={`h-8 w-1 rounded-full ${ag.cor}`} aria-hidden="true" />
                  <span className="text-xs font-semibold text-muted-foreground">{ag.hora}</span>
                  <span className="text-sm text-foreground">{ag.paciente}</span>
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-success">
                    <CalendarCheck className="size-3.5" aria-hidden="true" />
                    Confirmada
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div
            aria-hidden="true"
            className="absolute -inset-4 -z-10 rounded-3xl bg-primary/10 blur-2xl"
          />
        </div>
      </div>
    </section>
  )
}
