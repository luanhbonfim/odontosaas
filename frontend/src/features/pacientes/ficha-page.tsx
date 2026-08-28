import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import type { ErroApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { formatarDataHora } from '@/lib/utils/format'

import { Odontograma, type ProcedimentoDente } from './odontograma'
import {
  type FichaEntrada,
  useAtualizarFicha,
  useConsultasDoPaciente,
  useCriarFicha,
  useFicha,
  useFichasDoPaciente,
} from './use-paciente-detalhe'

const classeTextarea = cn(
  'min-h-28 w-full rounded-md border bg-transparent px-3 py-2 text-sm',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
)

const classeSelect = cn(
  'h-9 w-full cursor-pointer rounded-md border bg-transparent px-3 text-sm',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
)

/**
 * Página da ficha clínica (adicionar/editar) — odontograma (dentes tratados)
 * + anotações, com vínculo opcional a uma consulta do paciente ainda sem
 * ficha. Acessível a partir da aba Fichas do paciente.
 */
export function FichaPage() {
  const { pacienteId: pacienteParam, fichaId: fichaParam } = useParams()
  const pacienteId = Number(pacienteParam)
  const fichaId = Number(fichaParam)
  const edicao = Number.isFinite(fichaId) && fichaId > 0
  const navigate = useNavigate()

  const { data: ficha, isLoading } = useFicha(edicao ? fichaId : 0)
  const { data: fichas } = useFichasDoPaciente(pacienteId)
  const { data: consultas } = useConsultasDoPaciente(pacienteId)
  const criar = useCriarFicha(pacienteId)
  const atualizar = useAtualizarFicha(pacienteId)
  const salvando = criar.isPending || atualizar.isPending

  const [consultaId, setConsultaId] = useState('')
  const [procedimentos, setProcedimentos] = useState<ProcedimentoDente[]>([])
  const [anotacoes, setAnotacoes] = useState('')

  // Ao carregar a ficha (edição), preenche o formulário.
  useEffect(() => {
    if (ficha) {
      setConsultaId(ficha.consulta ? String(ficha.consulta) : '')
      setProcedimentos((ficha.dentes as ProcedimentoDente[] | undefined) ?? [])
      setAnotacoes(ficha.anotacoes ?? '')
    }
  }, [ficha])

  // Só consultas do paciente que ainda não têm ficha (exceto a própria, em edição).
  const consultasDisponiveis = useMemo(() => {
    const vinculadas = new Set(
      (fichas ?? [])
        .filter((f) => f.consulta && f.id !== ficha?.id)
        .map((f) => f.consulta as number),
    )
    return (consultas ?? []).filter((c) => !vinculadas.has(c.id))
  }, [consultas, fichas, ficha])

  function voltar() {
    navigate(`/pacientes/${pacienteId}`)
  }

  async function onSalvar() {
    const dados: FichaEntrada = {
      paciente: pacienteId,
      consulta: consultaId ? Number(consultaId) : null,
      dentes: procedimentos.filter((p) => p.dente > 0),
      anotacoes,
    }
    try {
      if (edicao && ficha) await atualizar.mutateAsync({ id: ficha.id, dados })
      else await criar.mutateAsync(dados)
      toast.success(edicao ? 'Ficha atualizada.' : 'Ficha registrada.')
      voltar()
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível salvar a ficha.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to={`/pacientes/${pacienteId}`}>
            <ArrowLeft /> Voltar ao paciente
          </Link>
        </Button>
        <PageHeader
          titulo={edicao ? 'Editar ficha' : 'Nova ficha'}
          descricao="Registre os dentes tratados (odontograma) e as anotações do atendimento."
        />
      </div>

      <Card>
        <CardContent className="space-y-5 p-6">
          {edicao && isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="consulta">Consulta vinculada (opcional)</Label>
                <select
                  id="consulta"
                  className={classeSelect}
                  value={consultaId}
                  onChange={(e) => setConsultaId(e.target.value)}
                >
                  <option value="">Nenhuma — ficha avulsa</option>
                  {consultasDisponiveis.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatarDataHora(c.inicio)} —{' '}
                      {c.procedimento_catalogo_nome || c.procedimento || 'Consulta'}
                    </option>
                  ))}
                </select>
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
                <Button variant="outline" onClick={voltar} type="button">
                  Cancelar
                </Button>
                <Button onClick={onSalvar} disabled={salvando}>
                  {salvando ? 'Salvando…' : 'Salvar ficha'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
