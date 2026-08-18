import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ErroApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import { Odontograma, type ProcedimentoDente } from './odontograma'
import {
  type GuiaEntrada,
  useAtualizarGuia,
  useCriarGuia,
  useGuia,
  usePlanosDoPaciente,
} from './use-paciente-detalhe'

const classeSelect = cn(
  'h-9 w-full cursor-pointer rounded-md border bg-transparent px-3 text-sm',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
)

const schema = z.object({
  plano: z.string().min(1, 'Selecione um plano'),
  numero_guia: z.string().min(1, 'Informe o número'),
  valor: z.string().min(1, 'Informe o valor'),
})
type FormValues = z.infer<typeof schema>

/** Página dedicada da guia (adicionar/editar) — como a ficha do paciente. */
export function GuiaPage() {
  const { pacienteId: pacienteParam, guiaId: guiaParam } = useParams()
  const pacienteId = Number(pacienteParam)
  const guiaId = Number(guiaParam)
  const edicao = Number.isFinite(guiaId) && guiaId > 0
  const navigate = useNavigate()

  const { data: planos } = usePlanosDoPaciente(pacienteId)
  const { data: guia } = useGuia(edicao ? guiaId : 0)
  const criar = useCriarGuia(pacienteId)
  const atualizar = useAtualizarGuia(pacienteId)

  const [procedimentos, setProcedimentos] = useState<ProcedimentoDente[]>([])
  const [erroDentes, setErroDentes] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { plano: '', numero_guia: '', valor: '' },
  })

  // Ao carregar a guia (edição), preenche o formulário e o odontograma.
  useEffect(() => {
    if (guia) {
      reset({
        plano: guia.plano ? String(guia.plano) : '',
        numero_guia: guia.numero_guia ?? '',
        valor: guia.valor ?? '',
      })
      setProcedimentos((guia.dentes as ProcedimentoDente[] | undefined) ?? [])
    }
  }, [guia, reset])

  function voltar() {
    navigate(`/pacientes/${pacienteId}`)
  }

  async function onSubmit(valores: FormValues) {
    const itens = procedimentos.filter((p) => p.dente > 0)
    if (itens.length === 0) {
      setErroDentes('Selecione ao menos um dente no odontograma.')
      return
    }
    setErroDentes('')
    const dados: GuiaEntrada = {
      plano: Number(valores.plano),
      numero_guia: valores.numero_guia,
      valor: valores.valor,
      // O procedimento da guia é resumido a partir dos dentes (o detalhe fica por dente).
      procedimento: itens
        .map((p) => `Dente ${p.dente}${p.procedimento ? `: ${p.procedimento}` : ''}`)
        .join('; '),
      dentes: itens,
    }
    try {
      if (edicao && guia) await atualizar.mutateAsync({ id: guia.id, dados })
      else await criar.mutateAsync(dados)
      toast.success(edicao ? 'Guia atualizada.' : 'Guia adicionada.')
      voltar()
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível salvar a guia.')
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
          titulo={edicao ? 'Editar guia' : 'Nova guia'}
          descricao="Dados da guia e os dentes trabalhados (odontograma)."
        />
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="plano">
                Plano <span className="text-destructive">*</span>
              </Label>
              <select
                id="plano"
                className={classeSelect}
                aria-invalid={!!errors.plano}
                {...register('plano')}
              >
                <option value="">Selecione…</option>
                {(planos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.convenio_nome}
                    {p.numero_carteirinha ? ` — ${p.numero_carteirinha}` : ''}
                  </option>
                ))}
              </select>
              {errors.plano && <p className="text-xs text-destructive">{errors.plano.message}</p>}
              {(planos ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Cadastre um plano na aba Planos do paciente antes de emitir guias.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="numero_guia">
                  Número <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="numero_guia"
                  aria-invalid={!!errors.numero_guia}
                  {...register('numero_guia')}
                />
                {errors.numero_guia && (
                  <p className="text-xs text-destructive">{errors.numero_guia.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="valor">
                  Valor (R$) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="valor"
                  inputMode="decimal"
                  aria-invalid={!!errors.valor}
                  {...register('valor')}
                />
                {errors.valor && <p className="text-xs text-destructive">{errors.valor.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                Procedimentos por dente (odontograma){' '}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </Label>
              <Odontograma value={procedimentos} onChange={setProcedimentos} />
              {erroDentes && <p className="text-xs text-destructive">{erroDentes}</p>}
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando…' : 'Salvar'}
              </Button>
              <Button type="button" variant="outline" onClick={voltar}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
