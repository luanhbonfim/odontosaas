import { ArrowRight, CalendarCheck, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react'

import { linkWhatsApp, MSG_DEMONSTRACAO } from '../whatsapp'

const BADGES = [
  { icon: MessageCircle, label: 'WhatsApp automatizado' },
  { icon: CalendarCheck, label: 'Sync Google Calendar' },
  { icon: ShieldCheck, label: 'LGPD & dados isolados' },
]

export function HeroSection() {
  return (
    <section
      id="topo"
      className="relative overflow-hidden border-b border-[#1E2D56]"
      aria-labelledby="hero-titulo"
    >
      {/* Mesh de gradiente sutil ao fundo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(50rem 40rem at 15% -10%, rgba(212,175,55,0.12), transparent 60%), radial-gradient(45rem 35rem at 100% 10%, rgba(59,130,246,0.10), transparent 55%)',
        }}
      />

      <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-8 lg:px-8 lg:py-24">
        {/* Coluna de texto */}
        <div className="flex flex-col items-start">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#1E2D56] bg-[#111D3B]/70 px-3.5 py-1.5 text-xs font-medium text-slate-200 backdrop-blur-md">
            <Sparkles className="size-3.5 text-[#D4AF37]" aria-hidden="true" />
            Software Odontológico de Próxima Geração • Multi-Tenant &amp; IA
          </span>

          <h1
            id="hero-titulo"
            className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-slate-100 sm:text-5xl"
          >
            A gestão completa da sua clínica odontológica,{' '}
            <span className="text-[#D4AF37]">simplificada e inteligente.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Elimine faltas de pacientes com confirmações automáticas por WhatsApp, sincronize sua
            agenda em tempo real com o Google Calendar e tenha controle financeiro e clínico total em
            uma única plataforma na nuvem.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <a
              href="#planos"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#D4AF37] px-6 py-3.5 text-base font-semibold text-[#0B132B] shadow-lg shadow-[#D4AF37]/20 transition-colors hover:bg-[#C29D26] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37] sm:w-auto"
            >
              Ver Planos &amp; Começar
              <ArrowRight className="size-5" aria-hidden="true" />
            </a>
            <a
              href={linkWhatsApp(MSG_DEMONSTRACAO)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#1E2D56] bg-[#111D3B]/60 px-6 py-3.5 text-base font-semibold text-slate-100 backdrop-blur-md transition-colors hover:border-[#25D366] hover:text-[#25D366] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366] sm:w-auto"
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              Agendar Demonstração
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            {BADGES.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-2 text-sm text-slate-400">
                <Icon className="size-4 text-emerald-400" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Mockup do dashboard */}
        <div className="relative">
          <div className="rounded-2xl border border-[#1E2D56] bg-[#111D3B]/70 p-4 shadow-2xl shadow-black/40 backdrop-blur-md">
            <div className="mb-4 flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-red-400/70" />
              <span className="size-3 rounded-full bg-amber-400/70" />
              <span className="size-3 rounded-full bg-emerald-400/70" />
              <span className="ml-3 text-xs font-medium text-slate-400">
                sua-clinica.proclinica.cloud
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { titulo: 'Consultas Hoje', valor: '18' },
                { titulo: 'Confirmadas', valor: '15' },
                { titulo: 'Faturamento', valor: 'R$ 9,2k' },
              ].map((kpi) => (
                <div key={kpi.titulo} className="rounded-xl border border-[#1E2D56] bg-[#0B132B]/80 p-3">
                  <p className="text-[11px] font-medium text-slate-400">{kpi.titulo}</p>
                  <p className="mt-1 text-lg font-bold text-slate-100">{kpi.valor}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              {[
                { hora: '09:00', paciente: 'Ana Souza', cor: 'bg-[#D4AF37]' },
                { hora: '10:30', paciente: 'Carlos Lima', cor: 'bg-blue-400' },
                { hora: '14:00', paciente: 'Marina Reis', cor: 'bg-emerald-400' },
              ].map((ag) => (
                <div
                  key={ag.hora}
                  className="flex items-center gap-3 rounded-lg border border-[#1E2D56] bg-[#0B132B]/60 px-3 py-2.5"
                >
                  <span className={`h-8 w-1 rounded-full ${ag.cor}`} aria-hidden="true" />
                  <span className="text-xs font-semibold text-slate-300">{ag.hora}</span>
                  <span className="text-sm text-slate-200">{ag.paciente}</span>
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                    <CalendarCheck className="size-3.5" aria-hidden="true" />
                    Confirmada
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div
            aria-hidden="true"
            className="absolute -inset-4 -z-10 rounded-3xl bg-[#D4AF37]/5 blur-2xl"
          />
        </div>
      </div>
    </section>
  )
}
