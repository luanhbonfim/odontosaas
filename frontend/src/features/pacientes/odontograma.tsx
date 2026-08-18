import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { DENTES, QUADRANTES } from './dentes-svg'

// viewBox do layout (900x150) com folga em cima/embaixo para a numeração.
const VIEWBOX_COM_NUMEROS = '0 -18 900 186'

export type ProcedimentoDente = { dente: number; procedimento: string }

// Notação FDI (permanente) — ordem para o seletor da lista de procedimentos.
const TODOS = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28, 48, 47, 46, 45, 44, 43, 42, 41,
  31, 32, 33, 34, 35, 36, 37, 38,
]

const classeSelectDente = cn(
  'h-9 w-20 shrink-0 cursor-pointer rounded-md border bg-transparent px-2 text-sm',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
)

/**
 * Odontograma: arcada completa (silhueta anatômica idêntica ao layout "square"
 * da biblioteca react-odontogram, MIT) + lista de procedimentos por dente. Cada
 * dente é clicável — clicar adiciona/remove um procedimento e destaca o dente.
 * O botão "Adicionar procedimento" cria uma linha em branco (dente no seletor).
 */
export function Odontograma({
  value,
  onChange,
}: {
  value: ProcedimentoDente[]
  onChange: (procedimentos: ProcedimentoDente[]) => void
}) {
  const comProcedimento = new Set(value.filter((v) => v.dente > 0).map((v) => v.dente))

  const adicionar = (dente: number) => onChange([...value, { dente, procedimento: '' }])
  // Clicar no dente alterna: se já está selecionado, remove; senão, adiciona.
  const alternarDente = (dente: number) =>
    comProcedimento.has(dente) ? onChange(value.filter((v) => v.dente !== dente)) : adicionar(dente)
  const atualizar = (indice: number, campos: Partial<ProcedimentoDente>) =>
    onChange(value.map((v, i) => (i === indice ? { ...v, ...campos } : v)))
  const remover = (indice: number) => onChange(value.filter((_, i) => i !== indice))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border bg-muted/30 p-3">
        <svg
          viewBox={VIEWBOX_COM_NUMEROS}
          className="mx-auto h-auto w-full min-w-[520px] max-w-2xl"
          role="group"
          aria-label="Odontograma"
        >
          {/* Numeração FDI — fora dos grupos espelhados (senão o texto inverteria). */}
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
                const ativo = comProcedimento.has(fdi)
                return (
                  <g
                    key={fdi}
                    role="button"
                    tabIndex={0}
                    aria-label={`Dente ${fdi}`}
                    aria-pressed={ativo}
                    onClick={() => alternarDente(fdi)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        alternarDente(fdi)
                      }
                    }}
                    className="group cursor-pointer outline-none"
                  >
                    <title>{`Dente ${fdi}`}</title>
                    <path
                      d={d.outline}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn(
                        'transition-colors',
                        ativo
                          ? 'fill-primary stroke-primary'
                          : 'fill-background stroke-foreground group-hover:fill-accent',
                      )}
                    />
                    {d.linhas.map((ln, i) => (
                      <path
                        key={i}
                        d={ln}
                        fill="none"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={ativo ? 'stroke-primary-foreground' : 'stroke-foreground'}
                      />
                    ))}
                  </g>
                )
              })}
            </g>
          ))}
        </svg>
        <p className="pt-1 text-center text-xs text-muted-foreground">
          Clique num dente para adicionar um procedimento.
        </p>
      </div>

      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              aria-label={`Dente do procedimento ${i + 1}`}
              className={classeSelectDente}
              value={item.dente ? String(item.dente) : ''}
              onChange={(e) => atualizar(i, { dente: Number(e.target.value) })}
            >
              <option value="">Dente</option>
              {TODOS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <Input
              aria-label={`Procedimento ${i + 1}`}
              placeholder="Procedimento realizado neste dente"
              value={item.procedimento}
              onChange={(e) => atualizar(i, { procedimento: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover procedimento ${i + 1}`}
              onClick={() => remover(i)}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => adicionar(0)}>
          <Plus /> Adicionar procedimento
        </Button>
      </div>
    </div>
  )
}
