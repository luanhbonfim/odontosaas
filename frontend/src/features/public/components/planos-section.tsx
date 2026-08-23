import { useState } from 'react'
import { Check, Loader2, Sparkles, X } from 'lucide-react'

import { gerarLinkWhatsApp } from '../whatsapp'
import { PLANOS_FALLBACK, usePlanosPublicos, type PlanoPublico } from '../use-planos-publicos'

type Frequencia = 'MENSAL' | 'ANUAL'

function paraNumero(valor: string | null): number | null {
  if (valor == null) return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

function formatarBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function formatarLimite(valor: number | null, sufixo: string): string {
  if (valor == null) return `${sufixo} ilimitados`
  return `Até ${valor} ${sufixo}`
}

function formatarArmazenamento(mb: number): string {
  if (mb >= 1024) return `${Math.round(mb / 1024)} GB de armazenamento`
  return `${mb} MB de armazenamento`
}

type Feature = { label: string; ativo: boolean }

function featuresDoPlano(plano: PlanoPublico): Feature[] {
  return [
    { label: formatarLimite(plano.limite_dentistas, 'dentistas'), ativo: true },
    { label: formatarLimite(plano.limite_usuarios, 'usuários'), ativo: true },
    { label: formatarLimite(plano.limite_pacientes_ativos, 'pacientes ativos'), ativo: true },
    { label: formatarArmazenamento(plano.limite_armazenamento_mb), ativo: true },
    { label: 'Sincronização com Google Calendar', ativo: plano.sync_google_ativo },
    { label: 'WhatsApp automatizado (WAHA)', ativo: plano.whatsapp_waha_ativo },
    { label: 'Módulo Financeiro & TISS', ativo: plano.modulo_financeiro_ativo },
    { label: 'Controle de Estoque', ativo: plano.modulo_estoque_ativo },
  ]
}

/** % de economia do plano anual vs. 12x o mensal (null se não houver base). */
function calcularEconomia(plano: PlanoPublico): number | null {
  const mensal = paraNumero(plano.preco_mensal)
  const anual = paraNumero(plano.preco_anual)
  if (mensal == null || anual == null || mensal <= 0) return null
  const totalMensalizado = mensal * 12
  if (anual >= totalMensalizado) return null
  return Math.round((1 - anual / totalMensalizado) * 100)
}

function CardPlano({
  plano,
  frequencia,
  popular,
}: {
  plano: PlanoPublico
  frequencia: Frequencia
  popular: boolean
}) {
  const mensal = paraNumero(plano.preco_mensal)
  const anual = paraNumero(plano.preco_anual)
  const economia = calcularEconomia(plano)

  const mostrarAnual = frequencia === 'ANUAL' && anual != null
  const valorPrincipal = mostrarAnual ? anual : mensal
  const sufixo = mostrarAnual ? '/ano' : '/mês'

  return (
    <article
      className={`relative flex flex-col rounded-2xl border p-7 backdrop-blur-md transition-colors ${
        popular
          ? 'border-[#D4AF37] bg-[#111D3B] shadow-2xl shadow-[#D4AF37]/10 ring-1 ring-[#D4AF37]/40'
          : 'border-[#1E2D56] bg-[#111D3B]/70 hover:border-[#D4AF37]/40'
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#D4AF37] px-3 py-1 text-xs font-bold text-[#0B132B] shadow-md">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Mais popular
        </span>
      )}

      <h3 className="text-xl font-bold text-slate-100">{plano.nome}</h3>

      <div className="mt-4 flex items-end gap-1">
        {valorPrincipal != null ? (
          <>
            <span className="text-4xl font-extrabold tracking-tight text-slate-100">
              {formatarBRL(valorPrincipal)}
            </span>
            <span className="mb-1 text-sm font-medium text-slate-400">{sufixo}</span>
          </>
        ) : (
          <span className="text-2xl font-bold text-slate-100">Sob consulta</span>
        )}
      </div>

      <div className="mt-1 h-5">
        {mostrarAnual && economia != null && (
          <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
            Economize {economia}% no anual
          </span>
        )}
      </div>

      <a
        href={gerarLinkWhatsApp(plano.nome, frequencia)}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-6 inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
          popular
            ? 'bg-[#D4AF37] text-[#0B132B] hover:bg-[#C29D26] focus-visible:outline-[#D4AF37]'
            : 'border border-[#1E2D56] bg-[#0B132B]/60 text-slate-100 hover:border-[#25D366] hover:text-[#25D366] focus-visible:outline-[#25D366]'
        }`}
      >
        Contratar {plano.nome}
      </a>

      <ul className="mt-6 space-y-3">
        {featuresDoPlano(plano).map((f) => (
          <li
            key={f.label}
            className={`flex items-start gap-2.5 text-sm ${f.ativo ? 'text-slate-300' : 'text-slate-500'}`}
          >
            {f.ativo ? (
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
            ) : (
              <X className="mt-0.5 size-4 shrink-0 text-slate-600" aria-hidden="true" />
            )}
            <span className={f.ativo ? '' : 'line-through'}>{f.label}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

export function PlanosSection() {
  const [frequencia, setFrequencia] = useState<Frequencia>('MENSAL')
  const { data, isLoading, isError } = usePlanosPublicos()

  const planos = isError || !data || data.length === 0 ? PLANOS_FALLBACK : data
  const idxPopular = planos.length >= 2 ? 1 : -1

  return (
    <section id="planos" aria-labelledby="planos-titulo" className="border-b border-[#1E2D56] bg-[#0B132B] scroll-mt-20">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#D4AF37]">
            Planos & Preços
          </p>
          <h2
            id="planos-titulo"
            className="mt-3 text-3xl font-extrabold tracking-tight text-slate-100 sm:text-4xl"
          >
            Um plano para cada fase da sua clínica
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Sem fidelidade nos planos mensais. Cancele quando quiser. Importação de pacientes
            assistida e sem custo.
          </p>
        </div>

        {/* Toggle de periodicidade */}
        <div className="mt-8 flex justify-center">
          <div
            role="group"
            aria-label="Periodicidade do plano"
            className="inline-flex items-center gap-1 rounded-full border border-[#1E2D56] bg-[#111D3B]/70 p-1 backdrop-blur-md"
          >
            <button
              type="button"
              aria-pressed={frequencia === 'MENSAL'}
              onClick={() => setFrequencia('MENSAL')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                frequencia === 'MENSAL'
                  ? 'bg-[#D4AF37] text-[#0B132B]'
                  : 'text-slate-300 hover:text-slate-100'
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              aria-pressed={frequencia === 'ANUAL'}
              onClick={() => setFrequencia('ANUAL')}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                frequencia === 'ANUAL'
                  ? 'bg-[#D4AF37] text-[#0B132B]'
                  : 'text-slate-300 hover:text-slate-100'
              }`}
            >
              Anual
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  frequencia === 'ANUAL'
                    ? 'bg-[#0B132B]/20 text-[#0B132B]'
                    : 'bg-emerald-400/15 text-emerald-400'
                }`}
              >
                -20%
              </span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-12 flex items-center justify-center gap-2 text-slate-400" role="status">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            Carregando planos...
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
            {planos.map((plano, i) => (
              <CardPlano
                key={plano.id}
                plano={plano}
                frequencia={frequencia}
                popular={i === idxPopular}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
