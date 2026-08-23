import {
  Bot,
  CalendarClock,
  ClipboardList,
  MessageSquareText,
  Package,
  Send,
  ShieldCheck,
  Sparkles,
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
    icon: Bot,
    categoria: 'Inteligência Artificial',
    titulo: 'Assistente com IA para o dentista',
    descricao:
      'Pergunte em linguagem natural e receba na hora: "Quanto faturei este mês?", "Quais insumos estão acabando?", "Quantas consultas tenho amanhã?". Sua clínica inteira na palma da mão.',
  },
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
    titulo: 'Automação de WhatsApp',
    descricao:
      'Lembretes automáticos 24h/2h antes, confirmação interativa (SIM/NÃO) e mensagens de reforço — sem taxa por mensagem.',
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
    titulo: 'Seus dados seguros e em conformidade com a LGPD',
    descricao:
      'Backup automático diário e total privacidade dos dados dos seus pacientes — sem dor de cabeça, sem risco.',
  },
]

export function RecursosSection() {
  return (
    <section
      id="recursos"
      aria-labelledby="recursos-titulo"
      className="border-b border-border bg-background scroll-mt-24"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Tudo em uma plataforma
          </p>
          <h2
            id="recursos-titulo"
            className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
          >
            Módulos & recursos que trabalham por você
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Do primeiro agendamento à quitação da consulta: gestão clínica, financeira e de
            relacionamento, sem retrabalho.
          </p>
        </div>

        {/* Destaque: Assistente com IA + mini-mockup de chat */}
        <div className="mt-12 grid grid-cols-1 items-center gap-8 overflow-hidden rounded-3xl border border-primary/25 bg-card/70 p-6 shadow-lg shadow-primary/10 ring-1 ring-primary/10 backdrop-blur-md sm:p-8 lg:grid-cols-2 lg:gap-10">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Novo diferencial
            </span>
            <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              A sua clínica inteira, a um comando de distância
            </h3>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Pergunte em conversa natural e a Inteligência Artificial responde na hora, com os
              dados reais do seu consultório: faturamento, estoque, agenda e desempenho. Menos
              planilhas, mais decisões rápidas — direto do seu celular.
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {[
                'Faturamento em tempo real',
                'Alertas de estoque',
                'Resumo da agenda do dia',
                'Insights do consultório',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Mini-mockup: o DENTISTA perguntando dados da clínica à IA */}
          <div className="relative mx-auto w-full max-w-md">
            <div
              aria-hidden="true"
              className="absolute -inset-4 -z-10 rounded-3xl bg-primary/10 blur-2xl"
            />
            <div className="rounded-2xl border border-border bg-background/80 p-4 shadow-xl shadow-primary/10 ring-1 ring-primary/10 backdrop-blur-md">
              <div className="mb-3 flex items-center gap-2.5 border-b border-border pb-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
                  <Bot className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground">Assistente PróClínica</p>
                  <p className="inline-flex items-center gap-1 text-[10px] font-medium text-success">
                    <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                    online • IA
                  </p>
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-secondary px-3 py-2 text-xs leading-relaxed text-foreground">
                    Quanto faturei em agosto?
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Bot className="size-3.5" aria-hidden="true" />
                  </span>
                  <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-primary/10 px-3 py-2 text-xs leading-relaxed text-foreground ring-1 ring-primary/20">
                    Em agosto você faturou <strong>R$ 42.300</strong> — 12% acima de julho. 👏
                  </p>
                </div>
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-secondary px-3 py-2 text-xs leading-relaxed text-foreground">
                    Quais insumos estão acabando?
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Bot className="size-3.5" aria-hidden="true" />
                  </span>
                  <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-primary/10 px-3 py-2 text-xs leading-relaxed text-foreground ring-1 ring-primary/20">
                    3 itens abaixo do mínimo: <strong>anestésico</strong>, <strong>luvas M</strong> e
                    <strong> sugador</strong>. Quer que eu gere a lista de compra?
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2">
                <span className="flex-1 text-xs text-muted-foreground">Pergunte algo sobre a sua clínica…</span>
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Send className="size-3.5" aria-hidden="true" />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map(({ icon: Icon, categoria, titulo, descricao }) => (
            <article
              key={titulo}
              className="group rounded-2xl border border-border bg-card/70 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/10"
            >
              <span className="flex size-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 ring-1 ring-primary/10 transition-colors group-hover:bg-primary/15">
                <Icon className="size-6 text-primary" aria-hidden="true" />
              </span>
              <span className="mt-4 inline-block rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {categoria}
              </span>
              <h3 className="mt-3 text-lg font-bold text-foreground">{titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{descricao}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
