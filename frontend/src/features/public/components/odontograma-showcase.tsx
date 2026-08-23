import { Check, Sparkles, Stethoscope } from 'lucide-react'

import { DENTES, QUADRANTES } from '@/features/pacientes/dentes-svg'

// Mesmo viewBox usado pelo Odontograma real, com folga para a numeração FDI.
const VIEWBOX_COM_NUMEROS = '0 -18 900 186'

// Alguns dentes "com procedimento" destacados em dourado (notação FDI), só para
// a vitrine — este componente é READ-ONLY (não importa o Odontograma interativo).
const DESTAQUES = new Set([16, 24, 11, 36, 46, 27])

const LEGENDA = [
  'Registro visual por dente (notação FDI)',
  'Histórico de procedimentos e evolução',
  'Anexos de exames e segurança jurídica LGPD',
]

/**
 * Vitrine (showcase) do prontuário com odontograma visual. Renderiza apenas a
 * arcada dentária, reaproveitando os paths de `dentes-svg` (DENTES/QUADRANTES),
 * com alguns dentes destacados em dourado. Não há inputs nem interação.
 */
export function OdontogramaShowcase() {
  return (
    <section aria-labelledby="odontograma-titulo" className="relative overflow-hidden border-b border-border bg-secondary/30">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(40rem 28rem at 85% 0%, oklch(0.74 0.13 85 / 0.12), transparent 60%), radial-gradient(36rem 26rem at 0% 100%, oklch(0.7 0.13 350 / 0.12), transparent 60%)',
        }}
      />
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:px-8 lg:py-20">
        {/* Texto */}
        <div className="order-2 lg:order-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-card/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary shadow-sm shadow-primary/10 ring-1 ring-primary/10 backdrop-blur-md">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Diferencial clínico
          </span>
          <h2
            id="odontograma-titulo"
            className="mt-5 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
          >
            Prontuário com Odontograma Visual
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Marque procedimentos direto na arcada e acompanhe a evolução de cada dente. O mesmo
            odontograma que a sua equipe usa no dia a dia — rápido, visual e sem papel.
          </p>
          <ul className="mt-6 space-y-3">
            {LEGENDA.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-card/70 px-3.5 py-2 text-xs font-medium text-muted-foreground backdrop-blur-md">
            <Stethoscope className="size-4 text-primary" aria-hidden="true" />
            <span>
              <span className="font-semibold text-primary">Em dourado</span>: dentes com
              procedimentos registrados.
            </span>
          </p>
        </div>

        {/* Card com a arcada */}
        <div className="relative order-1 lg:order-2">
          <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-2xl shadow-primary/10 ring-1 ring-primary/10 backdrop-blur-md sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">Odontograma — Maria Silva</p>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                6 procedimentos
              </span>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-2 sm:p-3">
              <svg
                viewBox={VIEWBOX_COM_NUMEROS}
                className="mx-auto h-auto w-full max-w-2xl"
                role="img"
                aria-label="Arcada dentária de exemplo com seis dentes destacados por procedimentos registrados"
              >
                {/* Numeração FDI (fora dos grupos espelhados para não inverter o texto) */}
                {QUADRANTES.map((q) =>
                  DENTES.map((d) => {
                    const fdi = q.prefixo + d.pos
                    const x = q.espelhaX ? 895 - d.cx : d.cx
                    const y = q.espelhaY ? 166 : -7
                    return (
                      <text
                        key={fdi}
                        x={x}
                        y={y}
                        textAnchor="middle"
                        fontSize={9}
                        className="pointer-events-none fill-muted-foreground tabular-nums"
                      >
                        {fdi}
                      </text>
                    )
                  }),
                )}
                {QUADRANTES.map((q) => (
                  <g key={q.prefixo} transform={q.transform || undefined}>
                    {DENTES.map((d) => {
                      const fdi = q.prefixo + d.pos
                      const ativo = DESTAQUES.has(fdi)
                      return (
                        <g key={fdi}>
                          <path
                            d={d.outline}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={
                              ativo
                                ? 'fill-primary stroke-primary'
                                : 'fill-background stroke-foreground/70'
                            }
                          />
                          {d.linhas.map((ln, i) => (
                            <path
                              key={i}
                              d={ln}
                              fill="none"
                              strokeWidth={1.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={ativo ? 'stroke-primary-foreground' : 'stroke-foreground/70'}
                            />
                          ))}
                        </g>
                      )
                    })}
                  </g>
                ))}
              </svg>
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
