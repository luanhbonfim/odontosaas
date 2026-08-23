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

type Feature = { label: string; ativo: boolean; emBreve?: boolean }

function featuresDoPlano(plano: PlanoPublico): Feature[] {
  return [
    { label: formatarLimite(plano.limite_dentistas, 'dentistas'), ativo: true },
    { label: formatarLimite(plano.limite_usuarios, 'usuários'), ativo: true },
    { label: formatarLimite(plano.limite_pacientes_ativos, 'pacientes ativos'), ativo: true },
    { label: formatarArmazenamento(plano.limite_armazenamento_mb), ativo: true, emBreve: true },
    { label: 'Sincronização com Google Calendar', ativo: plano.sync_google_ativo },
    { label: 'Automação de WhatsApp', ativo: plano.whatsapp_waha_ativo },
    { label: 'Módulo Financeiro & Convênios', ativo: plano.modulo_financeiro_ativo },
    { label: 'Controle de Estoque', ativo: plano.modulo_estoque_ativo },
    // IA disponível a partir do Profissional (Essencial não inclui). Usa o módulo
    // financeiro como proxy de tier — Essencial é o único sem ele.
    { label: 'IA que responde sobre a sua clínica', ativo: plano.modulo_financeiro_ativo, emBreve: true },
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
      className={`relative flex flex-col rounded-2xl border p-7 shadow-sm backdrop-blur-md transition-all duration-300 ${
        popular
          ? 'border-primary bg-card shadow-2xl shadow-primary/15 ring-1 ring-primary/40 lg:-translate-y-2'
          : 'border-border bg-card/70 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10'
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-md shadow-primary/30">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Mais popular
        </span>
      )}

      <h3 className="text-xl font-bold text-foreground">{plano.nome}</h3>

      <div className="mt-4 flex items-end gap-1">
        {valorPrincipal != null ? (
          <>
            <span className="text-4xl font-extrabold tracking-tight text-foreground">
              {formatarBRL(valorPrincipal)}
            </span>
            <span className="mb-1 text-sm font-medium text-muted-foreground">{sufixo}</span>
          </>
        ) : (
          <span className="text-2xl font-bold text-foreground">Sob consulta</span>
        )}
      </div>

      <div className="mt-1 h-5">
        {mostrarAnual && economia != null && (
          <span className="inline-flex items-center rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
            Economize {economia}% no anual
          </span>
        )}
      </div>

      <a
        href={gerarLinkWhatsApp(plano.nome, frequencia)}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-6 inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
          popular
            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/40 hover:brightness-105 focus-visible:outline-primary'
            : 'border border-border bg-background/60 text-foreground hover:border-[#25D366] hover:text-[#128C4A] focus-visible:outline-[#25D366]'
        }`}
      >
        Contratar {plano.nome}
      </a>

      <ul className="mt-6 space-y-3">
        {featuresDoPlano(plano).map((f) => (
          <li
            key={f.label}
            className={`flex items-start gap-2.5 text-sm ${f.ativo ? 'text-foreground' : 'text-muted-foreground/60'}`}
          >
            {f.ativo ? (
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            )}
            <span className={f.ativo ? '' : 'line-through'}>
              {f.label}
              {f.emBreve && f.ativo && (
                <span className="ml-1.5 inline-block rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-primary">
                  em breve
                </span>
              )}
            </span>
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
    <section id="planos" aria-labelledby="planos-titulo" className="border-b border-border bg-secondary/30 scroll-mt-24">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Planos & Preços
          </p>
          <h2
            id="planos-titulo"
            className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
          >
            Um plano para cada fase da sua clínica
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Sem fidelidade nos planos mensais. Cancele quando quiser. Importação de pacientes
            assistida e sem custo.
          </p>
        </div>

        {/* Toggle de periodicidade */}
        <div className="mt-8 flex justify-center">
          <div
            role="group"
            aria-label="Periodicidade do plano"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card/70 p-1 shadow-sm backdrop-blur-md"
          >
            <button
              type="button"
              aria-pressed={frequencia === 'MENSAL'}
              onClick={() => setFrequencia('MENSAL')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300 ${
                frequencia === 'MENSAL'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              aria-pressed={frequencia === 'ANUAL'}
              onClick={() => setFrequencia('ANUAL')}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300 ${
                frequencia === 'ANUAL'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Anual
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  frequencia === 'ANUAL'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-success/15 text-success'
                }`}
              >
                -20%
              </span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-12 flex items-center justify-center gap-2 text-muted-foreground" role="status">
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
