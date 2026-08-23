import {
  CalendarClock,
  ClipboardList,
  MessageSquareText,
  Package,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Recurso = {
  icon: LucideIcon
  categoria: string
  titulo: string
  descricao: string
}

const RECURSOS: Recurso[] = [
  {
    icon: CalendarClock,
    categoria: 'Agenda',
    titulo: 'Agenda Inteligente & Google Calendar',
    descricao:
      'Sincronização bidirecional, múltiplos dentistas e cadeiras, bloqueio de conflitos e visão Dia/Semana/Mês.',
  },
  {
    icon: MessageSquareText,
    categoria: 'Automação',
    titulo: 'WhatsApp Automatizado (WAHA)',
    descricao:
      'Lembretes automáticos 24h/2h antes, confirmação interativa com link seguro e mensagens de reforço.',
  },
  {
    icon: ClipboardList,
    categoria: 'Clínico',
    titulo: 'Prontuário Eletrônico & Anamnese',
    descricao:
      'Histórico completo de tratamentos, odontograma visual, anexos de exames e segurança jurídica LGPD.',
  },
  {
    icon: Wallet,
    categoria: 'Financeiro',
    titulo: 'Financeiro Odontológico & TISS',
    descricao:
      'Contas a pagar/receber, emissão de guias de convênios, fluxo de caixa em tempo real e quitação facilitada.',
  },
  {
    icon: Package,
    categoria: 'Estoque',
    titulo: 'Controle de Estoque & Insumos',
    descricao:
      'Alertas de estoque mínimo e baixa automática de materiais vinculada aos procedimentos realizados.',
  },
  {
    icon: ShieldCheck,
    categoria: 'Segurança',
    titulo: 'Segurança de Nível Bancário',
    descricao:
      'Schema isolado por clínica no PostgreSQL, trilha de auditoria para a LGPD e criptografia HTTPS/TLS.',
  },
]

export function RecursosSection() {
  return (
    <section id="recursos" aria-labelledby="recursos-titulo" className="border-b border-[#1E2D56] bg-[#0B132B] scroll-mt-20">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#D4AF37]">
            Tudo em uma plataforma
          </p>
          <h2
            id="recursos-titulo"
            className="mt-3 text-3xl font-extrabold tracking-tight text-slate-100 sm:text-4xl"
          >
            Módulos & recursos que trabalham por você
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Do primeiro agendamento à quitação da consulta: gestão clínica, financeira e de
            relacionamento, sem retrabalho.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map(({ icon: Icon, categoria, titulo, descricao }) => (
            <article
              key={titulo}
              className="group rounded-2xl border border-[#1E2D56] bg-[#111D3B]/70 p-6 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-[#D4AF37]/60 hover:shadow-xl hover:shadow-[#D4AF37]/5"
            >
              <span className="flex size-12 items-center justify-center rounded-xl border border-[#1E2D56] bg-[#0B132B] transition-colors group-hover:border-[#D4AF37]/50">
                <Icon className="size-6 text-[#D4AF37]" aria-hidden="true" />
              </span>
              <span className="mt-4 inline-block rounded-full border border-[#1E2D56] bg-[#0B132B]/60 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {categoria}
              </span>
              <h3 className="mt-3 text-lg font-bold text-slate-100">{titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{descricao}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
