import { zodResolver } from '@hookform/resolvers/zod'
import { Stethoscope } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  CabecalhoDrawer,
  Campo,
  CorpoDrawer,
  LinhaToggle,
  SecaoForm,
} from '@/components/common/form-kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetTrigger } from '@/components/ui/sheet'
import type { ErroApi } from '@/lib/api/client'

import {
  type Dentista,
  useAtualizarDentista,
  useCriarDentista,
  useEspecialidades,
} from './use-dentistas'

const schema = z.object({
  nome_completo: z.string().min(1, 'Informe o nome'),
  cro: z.string().min(1, 'Informe o CRO'),
  telefone: z.string(),
  email: z.string().email('E-mail inválido').or(z.literal('')),
  especialidades: z.array(z.number()),
  ativo: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function valoresIniciais(dentista?: Dentista): FormValues {
  return {
    nome_completo: dentista?.nome_completo ?? '',
    cro: dentista?.cro ?? '',
    telefone: dentista?.telefone ?? '',
    email: dentista?.email ?? '',
    especialidades: dentista?.especialidades ?? [],
    ativo: dentista?.ativo ?? true,
  }
}

type Props = {
  trigger: ReactNode
  /** Presente = edição; ausente = criação. */
  dentista?: Dentista
}

export function DentistaFormDrawer({ trigger, dentista }: Props) {
  const [aberto, setAberto] = useState(false)
  const { data: especialidades } = useEspecialidades()
  const criar = useCriarDentista()
  const atualizar = useAtualizarDentista()
  const edicao = Boolean(dentista)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresIniciais(dentista),
  })

  // Ao abrir, (re)carrega os valores do dentista (ou zera, na criação).
  useEffect(() => {
    if (aberto) reset(valoresIniciais(dentista))
  }, [aberto, dentista, reset])

  async function onSubmit(valores: FormValues) {
    try {
      if (edicao && dentista) {
        await atualizar.mutateAsync({ id: dentista.id, dados: valores })
      } else {
        await criar.mutateAsync(valores)
      }
      toast.success(edicao ? 'Dentista atualizado.' : 'Dentista criado.')
      setAberto(false)
    } catch (excecao) {
      const erro = excecao as ErroApi
      if (erro.campos?.cro) {
        setError('cro', { message: erro.campos.cro[0] })
      } else {
        toast.error(erro.mensagem ?? 'Não foi possível salvar.')
      }
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <CabecalhoDrawer
          icone={Stethoscope}
          titulo={edicao ? 'Editar dentista' : 'Novo dentista'}
          descricao="Cadastro do profissional que atende na clínica."
        />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4">
          <CorpoDrawer>
            <SecaoForm titulo="Dados">
              <Campo id="nome_completo" label="Nome" obrigatorio erro={errors.nome_completo?.message}>
                <Input
                  id="nome_completo"
                  placeholder="Nome completo"
                  aria-required="true"
                  aria-invalid={!!errors.nome_completo}
                  {...register('nome_completo')}
                />
              </Campo>
              <Campo id="cro" label="CRO" obrigatorio erro={errors.cro?.message}>
                <Input
                  id="cro"
                  placeholder="ex.: CRO-SP 12345"
                  aria-required="true"
                  aria-invalid={!!errors.cro}
                  {...register('cro')}
                />
              </Campo>
            </SecaoForm>

            <SecaoForm titulo="Contato">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo id="telefone" label="Telefone">
                  <Input id="telefone" placeholder="(11) 99999-9999" {...register('telefone')} />
                </Campo>
                <Campo id="email" label="E-mail" erro={errors.email?.message}>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com"
                    aria-invalid={!!errors.email}
                    {...register('email')}
                  />
                </Campo>
              </div>
            </SecaoForm>

            <SecaoForm titulo="Especialidades">
              <Controller
                control={control}
                name="especialidades"
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-1.5">
                    {(especialidades ?? []).map((esp) => (
                      <label key={esp.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 cursor-pointer accent-primary"
                          checked={field.value.includes(esp.id)}
                          onChange={(evento) =>
                            field.onChange(
                              evento.target.checked
                                ? [...field.value, esp.id]
                                : field.value.filter((id) => id !== esp.id),
                            )
                          }
                        />
                        {esp.nome}
                      </label>
                    ))}
                    {(especialidades ?? []).length === 0 && (
                      <p className="col-span-2 text-xs text-muted-foreground">
                        Nenhuma especialidade cadastrada.
                      </p>
                    )}
                  </div>
                )}
              />
            </SecaoForm>

            <LinhaToggle
              titulo="Dentista ativo"
              ajuda="Inativos não aparecem para novos agendamentos."
              {...register('ativo')}
            />
          </CorpoDrawer>

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
