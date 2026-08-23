import {
  ArrowLeftRight,
  BellRing,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Layers,
  Link2,
  Lock,
  MessageCircle,
  Sparkles,
  Stethoscope,
  User,
  Ban,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Bolha =
  | { de: 'clinica'; texto: string; hora: string; etiqueta?: string }
  | { de: 'paciente'; texto: string; hora: string }
  | { de: 'digitando' }

// Roteiro de exemplo cobrindo TODAS as automações de WhatsApp da plataforma.
const CONVERSA: Bolha[] = [
  {
    de: 'clinica',
    etiqueta: 'Confirmação',
    texto:
      'Olá Maria! Você tem consulta amanhã às 09:00 com a Dra. Ana. Confirme respondendo SIM/NÃO ou pelo link seguro: proclinica.app/c/9f2a ✅',
    hora: '18:02',
  },
  { de: 'paciente', texto: 'Talvez, não sei ainda', hora: '18:05' },
  {
    de: 'clinica',
    etiqueta: 'Reforço',
    texto: 'Por favor, responda apenas com SIM ou NÃO 🙏',
    hora: '18:05',
  },
  { de: 'paciente', texto: 'SIM', hora: '18:06' },
  {
    de: 'clinica',
    etiqueta: 'Agradecimento',
    texto: 'Perfeito! Sua consulta está confirmada. Até lá! 😄',
    hora: '18:06',
  },
  {
    de: 'clinica',
    etiqueta: 'Lembrete',
    texto: 'Bom dia, Maria! Passando para lembrar da sua consulta hoje às 09:00. Te esperamos! 🦷',
    hora: '07:00',
  },
  {
    de: 'clinica',
    etiqueta: 'Reagendamento',
    texto: 'Sua consulta foi remarcada para quinta, 12/09 às 14:30. Qualquer dúvida, é só chamar!',
    hora: '11:20',
  },
  {
    de: 'clinica',
    etiqueta: 'Cancelamento',
    texto: 'Sua consulta de 09:00 foi cancelada. Quer reagendar? Responda com o melhor dia para você.',
    hora: '11:22',
  },
  { de: 'digitando' },
]

const DIFERENCIAIS: { icon: LucideIcon; titulo: string; descricao: string }[] = [
  {
    icon: Sparkles,
    titulo: 'Sem taxa por mensagem',
    descricao: 'Infraestrutura própria, sem cobrança por disparo — diferente de SMS e APIs pagas.',
  },
  {
    icon: CheckCheck,
    titulo: 'Confirmação por SIM/NÃO ou link',
    descricao: 'O paciente responde SIM/NÃO ou confirma num link seguro — e a agenda se atualiza sozinha.',
  },
  {
    icon: Layers,
    titulo: 'Fila anti-bloqueio',
    descricao: 'Envios espaçados e inteligentes para proteger o número da clínica de bloqueios.',
  },
  {
    icon: BellRing,
    titulo: '“Digitando...” humanizado',
    descricao: 'Mensagens com ritmo natural, como se a recepção estivesse respondendo.',
  },
]

const ETIQUETA_ICON: Record<string, LucideIcon> = {
  Confirmação: CheckCheck,
  Reforço: MessageCircle,
  Agradecimento: Check,
  Lembrete: BellRing,
  Reagendamento: CalendarClock,
  Cancelamento: Ban,
}

function BolhaClinica({ texto, hora, etiqueta }: { texto: string; hora: string; etiqueta?: string }) {
  const Icone = etiqueta ? ETIQUETA_ICON[etiqueta] : undefined
  return (
    <div className="flex flex-col items-start">
      {etiqueta && (
        <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
          {Icone && <Icone className="size-3" aria-hidden="true" />}
          {etiqueta}
        </span>
      )}
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-xs leading-relaxed text-foreground shadow-sm ring-1 ring-border">
        {texto}
        <span className="mt-1 block text-right text-[9px] text-muted-foreground">{hora}</span>
      </div>
    </div>
  )
}

function BolhaPaciente({ texto, hora }: { texto: string; hora: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#25D366]/20 px-3 py-2 text-xs leading-relaxed text-foreground shadow-sm ring-1 ring-[#25D366]/30">
        {texto}
        <span className="mt-1 flex items-center justify-end gap-1 text-[9px] text-muted-foreground">
          {hora}
          <CheckCheck className="size-3 text-[#128C4A]" aria-hidden="true" />
        </span>
      </div>
    </div>
  )
}

function Digitando() {
  return (
    <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-card px-3 py-2.5 shadow-sm ring-1 ring-border w-fit">
      <span className="sr-only">Digitando</span>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          aria-hidden="true"
          className="size-1.5 rounded-full bg-muted-foreground/70 motion-safe:animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

/**
 * Print de demonstração da CONFIRMAÇÃO POR LINK: janela de navegador mostrando
 * a página segura que o paciente abre ao tocar no link do WhatsApp.
 */
function LinkConfirmacaoMockup() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-primary/10 blur-2xl"
      />
      {/* Janela de navegador */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/15 ring-1 ring-border">
        {/* Barra do navegador */}
        <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-3 py-2.5">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-muted-foreground/30" />
            <span className="size-2.5 rounded-full bg-muted-foreground/30" />
            <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          </span>
          <div className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1">
            <Lock className="size-3 shrink-0 text-success" aria-hidden="true" />
            <span className="truncate text-[11px] text-muted-foreground">proclinica.app/c/9f2a</span>
          </div>
        </div>

        {/* Página de confirmação */}
        <div className="px-5 py-6 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
            <CalendarCheck className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-bold text-foreground">Clínica Sorriso</p>
          <h4 className="mt-1 text-base font-extrabold tracking-tight text-foreground">
            Confirme sua consulta
          </h4>

          {/* Detalhes do agendamento */}
          <div className="mt-4 space-y-2.5 rounded-xl border border-border bg-background/70 p-4 text-left">
            <div className="flex items-center gap-2.5 text-xs text-foreground">
              <User className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">Maria Silva</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-foreground">
              <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">Amanhã, 24/08 às 09:00</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-foreground">
              <Stethoscope className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">Dra. Ana Paula</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-foreground">
              <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">Duração ~50 min</span>
            </div>
          </div>

          {/* Botões */}
          <div className="mt-4 space-y-2">
            <span className="flex w-full items-center justify-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-success/25">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Confirmar presença
            </span>
            <span className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground">
              <CalendarClock className="size-4" aria-hidden="true" />
              Preciso remarcar
            </span>
          </div>

          <p className="mt-3 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Lock className="size-3" aria-hidden="true" />
            Link exclusivo e seguro • a agenda atualiza sozinha
          </p>
        </div>
      </div>
    </div>
  )
}

export function IntegracoesShowcase() {
  return (
    <section
      id="integracoes"
      aria-labelledby="integracoes-titulo"
      className="border-b border-border bg-background scroll-mt-24"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Integrações nativas
          </p>
          <h2
            id="integracoes-titulo"
            className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
          >
            Conectado às ferramentas que você já usa
          </h2>
        </div>

        {/* Google Calendar */}
        <div className="mt-12">
          <article className="mx-auto max-w-3xl rounded-2xl border border-border bg-card/70 p-7 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-secondary/60">
                <CalendarCheck className="size-5 text-blue-600" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-bold text-foreground">Google Calendar</h3>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Sincronização <strong className="text-foreground">bidirecional em tempo real</strong>:
              o que muda na clínica aparece no celular do dentista, e vice-versa.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3 rounded-xl border border-border bg-background/70 p-4">
              <span className="text-sm font-semibold text-foreground">PróClínica</span>
              <ArrowLeftRight className="size-5 text-blue-600" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">Google Agenda</span>
            </div>
            <ul className="mt-5 grid gap-2 sm:grid-cols-3">
              {['Cores espelhadas por dentista', 'Cancelou aqui, some lá', 'Sem retrabalho de digitação'].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </article>
        </div>

        {/* Integração com WhatsApp — mockup + automações */}
        <div className="mt-16 grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
          {/* Coluna: mockup de celular */}
          <div className="relative mx-auto w-full max-w-[340px]">
            <div
              aria-hidden="true"
              className="absolute -inset-6 -z-10 rounded-[3rem] bg-[#25D366]/10 blur-2xl"
            />
            <div className="overflow-hidden rounded-[2.25rem] border-[6px] border-foreground/10 bg-card shadow-2xl shadow-primary/15 ring-1 ring-border">
              {/* Barra do topo do WhatsApp */}
              <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
                <span className="flex size-9 items-center justify-center rounded-full bg-white/20">
                  <MessageCircle className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Clínica Sorriso</p>
                  <p className="text-[10px] text-white/80">digitando...</p>
                </div>
              </div>
              {/* Corpo da conversa */}
              <div
                className="max-h-[26rem] space-y-3 overflow-y-auto px-3 py-4"
                style={{
                  background:
                    'radial-gradient(30rem 20rem at 50% 0%, oklch(0.7 0.13 350 / 0.08), transparent 70%)',
                }}
              >
                {CONVERSA.map((b, i) => {
                  if (b.de === 'digitando') return <Digitando key={i} />
                  if (b.de === 'paciente')
                    return <BolhaPaciente key={i} texto={b.texto} hora={b.hora} />
                  return (
                    <BolhaClinica key={i} texto={b.texto} hora={b.hora} etiqueta={b.etiqueta} />
                  )
                })}
              </div>
            </div>
          </div>

          {/* Coluna: texto + diferenciais */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#128C4A]">
              <MessageCircle className="size-3.5" aria-hidden="true" />
              Automação de WhatsApp
            </span>
            <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Confirmações que o paciente realmente lê e responde
            </h3>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Confirmação, reforço, agradecimento, lembrete, reagendamento e cancelamento — tudo
              automático, direto no WhatsApp que o paciente já usa. Menos faltas, sem esforço da
              recepção.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {DIFERENCIAIS.map(({ icon: Icon, titulo, descricao }) => (
                <div
                  key={titulo}
                  className="rounded-xl border border-border bg-card/70 p-4 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/10"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-bold text-foreground">{titulo}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{descricao}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Destaque: Confirmação por link (print de demonstração) */}
        <div className="mt-16 grid grid-cols-1 items-center gap-10 rounded-3xl border border-primary/20 bg-card/60 p-6 shadow-lg shadow-primary/10 backdrop-blur-md sm:p-8 lg:grid-cols-2 lg:gap-12">
          <div className="order-2 lg:order-1">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Link2 className="size-3.5" aria-hidden="true" />
              Confirmação por link
            </span>
            <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Um toque no link e a presença está confirmada
            </h3>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Além do SIM/NÃO, cada consulta gera um <strong className="text-foreground">link
              exclusivo e seguro</strong>. O paciente abre, vê os detalhes do agendamento e confirma
              (ou pede para remarcar) com um único toque — e a sua agenda se atualiza sozinha, sem a
              recepção precisar digitar nada.
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {[
                'Link único por consulta',
                'Página segura e simples',
                'Confirma ou remarca em 1 toque',
                'Agenda atualizada na hora',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 lg:order-2">
            <LinkConfirmacaoMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
