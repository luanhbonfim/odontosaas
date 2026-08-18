import { ArrowLeft } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { DateTime } from '@/components/common/formato'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import type { ErroApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import { Odontograma, type ProcedimentoDente } from './odontograma'
import { BadgeCobranca, BadgeStatus } from './status'
import { useConsulta, useSalvarFichaConsulta } from './use-paciente-detalhe'

const classeTextarea = cn(
  'min-h-28 w-full rounded-md border bg-transparent px-3 py-2 text-sm',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
)

/**
 * Página da ficha da consulta: odontograma (dentes tratados) + anotações do
 * dentista sobre o que foi feito. Abre a partir da aba Consultas do paciente.
 */
export function ConsultaPage() {
  const { pacienteId: pacienteParam, consultaId: consultaParam } = useParams()
  const pacienteId = Number(pacienteParam)
  const consultaId = Number(consultaParam)
  const navigate = useNavigate()

  const { data: consulta, isLoading } = useConsulta(consultaId)
  const salvar = useSalvarFichaConsulta(pacienteId)
  // Canceladas/faltou não têm ficha para preencher.
  const bloqueada = ['CANCELADA', 'FALTOU'].includes(consulta?.status ?? '')

  const [procedimentos, setProcedimentos] = useState<ProcedimentoDente[]>([])
  const [anotacoes, setAnotacoes] = useState('')

  // Ao carregar a consulta, preenche o odontograma e as anotações.
  useEffect(() => {
    if (consulta) {
      setProcedimentos((consulta.dentes as ProcedimentoDente[] | undefined) ?? [])
      setAnotacoes(consulta.anotacoes ?? '')
    }
  }, [consulta])

  async function onSalvar() {
    if (!consulta) return
    const dentes = procedimentos.filter((p) => p.dente > 0)
    try {
      await salvar.mutateAsync({ id: consulta.id, dados: { dentes, anotacoes } })
      toast.success('Ficha da consulta salva.')
      navigate(`/pacientes/${pacienteId}`)
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível salvar a ficha.')
    }
  }

  const resumo: [string, ReactNode][] = consulta
    ? [
        ['Paciente', consulta.paciente_nome],
        ['Dentista', consulta.dentista_nome],
        ['Início', <DateTime iso={consulta.inicio} />],
        ['Cobrança', <BadgeCobranca convenioNome={consulta.convenio_nome} />],
        ['Status', <BadgeStatus status={consulta.status} />],
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to={`/pacientes/${pacienteId}`}>
            <ArrowLeft /> Voltar ao paciente
          </Link>
        </Button>
        <PageHeader
          titulo="Ficha da consulta"
          descricao="Registre os dentes tratados (odontograma) e as anotações do atendimento."
        />
      </div>

      <Card>
        <CardContent className="space-y-5 p-6">
          {isLoading || !consulta ? (
            <Skeleton className="h-40 w-full" />
          ) : bloqueada ? (
            <div className="space-y-4">
              <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {resumo.map(([rotulo, valor]) => (
                  <div key={rotulo} className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">{rotulo}</span>
                    <span className="text-sm font-medium">{valor}</span>
                  </div>
                ))}
              </div>
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Esta consulta está {consulta.status === 'FALTOU' ? 'como falta' : 'cancelada'} — não
                há ficha para preencher.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {resumo.map(([rotulo, valor]) => (
                  <div key={rotulo} className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">{rotulo}</span>
                    <span className="text-sm font-medium">{valor}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label>Dentes tratados (odontograma)</Label>
                <Odontograma value={procedimentos} onChange={setProcedimentos} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="anotacoes">Anotações</Label>
                <textarea
                  id="anotacoes"
                  className={classeTextarea}
                  placeholder="Anote tudo o que foi feito no atendimento, por dente."
                  value={anotacoes}
                  onChange={(e) => setAnotacoes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button asChild variant="outline">
                  <Link to={`/pacientes/${pacienteId}`}>Cancelar</Link>
                </Button>
                <Button onClick={onSalvar} disabled={salvar.isPending}>
                  {salvar.isPending ? 'Salvando…' : 'Salvar ficha'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
