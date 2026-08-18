import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { DateText } from '@/components/common/formato'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import type { ErroApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import {
  type AnamneseEntrada,
  useAnamnesesDoPaciente,
  useCriarAnamnese,
} from './use-paciente-detalhe'

const classeTextarea = cn(
  'min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
)

export function AbaAnamneses({ pacienteId }: { pacienteId: number }) {
  const { data, isLoading } = useAnamnesesDoPaciente(pacienteId)
  const anamneses = data ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AnamneseFormDrawer
          pacienteId={pacienteId}
          trigger={
            <Button size="sm">
              <Plus /> Nova anamnese
            </Button>
          }
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : anamneses.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma anamnese registrada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {anamneses.map((a) => (
            <Card key={a.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    <DateText iso={a.criado_em} />
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {a.fumante && <StatusBadge variante="pendente">Fumante</StatusBadge>}
                    {a.diabetico && <StatusBadge variante="pendente">Diabético(a)</StatusBadge>}
                    {a.gestante && <StatusBadge variante="info">Gestante</StatusBadge>}
                  </div>
                </div>
                <p className="text-sm">{a.queixa_principal || 'Sem queixa registrada.'}</p>
                {a.pressao_arterial && (
                  <p className="text-xs text-muted-foreground">PA: {a.pressao_arterial}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

const schema = z.object({
  queixa_principal: z.string().min(1, 'Informe a queixa principal'),
  pressao_arterial: z.string(),
  fumante: z.boolean(),
  diabetico: z.boolean(),
  gestante: z.boolean(),
})
type FormValues = z.infer<typeof schema>

const VALORES_INICIAIS: FormValues = {
  queixa_principal: '',
  pressao_arterial: '',
  fumante: false,
  diabetico: false,
  gestante: false,
}

/** Registra uma anamnese num drawer lateral (padrão da Equipe/Planos). */
function AnamneseFormDrawer({ pacienteId, trigger }: { pacienteId: number; trigger: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const criar = useCriarAnamnese(pacienteId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: VALORES_INICIAIS,
  })

  useEffect(() => {
    if (aberto) reset(VALORES_INICIAIS)
  }, [aberto, reset])

  async function onSubmit(valores: FormValues) {
    const dados: AnamneseEntrada = { paciente: pacienteId, ...valores }
    try {
      await criar.mutateAsync(dados)
      toast.success('Anamnese registrada.')
      setAberto(false)
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível registrar a anamnese.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nova anamnese</SheetTitle>
          <SheetDescription>
            Queixa e histórico de saúde do paciente. Campos com{' '}
            <span className="text-destructive">*</span> são obrigatórios.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="queixa_principal">
              Queixa principal{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <textarea
              id="queixa_principal"
              className={classeTextarea}
              aria-invalid={errors.queixa_principal ? true : undefined}
              {...register('queixa_principal')}
            />
            {errors.queixa_principal && (
              <p className="text-xs text-destructive">{errors.queixa_principal.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pressao_arterial">Pressão arterial</Label>
            <Input
              id="pressao_arterial"
              placeholder="ex.: 120/80"
              {...register('pressao_arterial')}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Fatores de risco</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 cursor-pointer accent-primary"
                {...register('fumante')}
              />
              Fumante
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 cursor-pointer accent-primary"
                {...register('diabetico')}
              />
              Diabético(a)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 cursor-pointer accent-primary"
                {...register('gestante')}
              />
              Gestante
            </label>
          </fieldset>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </SheetClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
