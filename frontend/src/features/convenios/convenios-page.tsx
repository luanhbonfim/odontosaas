import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { BadgeCheck, Pencil, Plus, Trash2 } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { CabecalhoDrawer, Campo, CorpoDrawer, LinhaToggle } from '@/components/common/form-kit'
import { StatusBadge } from '@/components/common/status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { ErroApi } from '@/lib/api/client'

import {
  type Convenio,
  type ConvenioEntrada,
  useAtualizarConvenio,
  useConvenios,
  useCriarConvenio,
  useRemoverConvenio,
} from './use-convenios'

export function ConveniosPage() {
  const { data, isLoading, isError } = useConvenios()
  const remover = useRemoverConvenio()

  async function excluir(convenio: Convenio) {
    try {
      await remover.mutateAsync(convenio.id)
      toast.success('Convênio excluído.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível excluir o convênio.')
    }
  }

  // Ações do convênio (editar + excluir). Compartilhadas entre a coluna (desktop)
  // e o card do mobile.
  const acoesConvenio = (convenio: Convenio) => (
    <div className="flex items-center justify-end gap-1">
      <ConvenioFormDrawer
        convenio={convenio}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            title="Editar convênio"
            aria-label={`Editar ${convenio.nome}`}
          >
            <Pencil />
          </Button>
        }
      />
      <ConfirmDialog
        titulo="Excluir convênio?"
        descricao={`Remove ${convenio.nome}. Convênios com planos vinculados não podem ser excluídos.`}
        rotuloConfirmar="Excluir"
        destrutivo
        onConfirmar={() => excluir(convenio)}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            title="Excluir convênio"
            aria-label={`Excluir ${convenio.nome}`}
          >
            <Trash2 className="text-destructive" />
          </Button>
        }
      />
    </div>
  )

  const colunas: ColumnDef<Convenio, unknown>[] = [
    { accessorKey: 'nome', header: 'Nome' },
    {
      accessorKey: 'pacientes',
      header: 'Pacientes',
      cell: ({ row }) => <span className="tabular-nums">{row.original.pacientes ?? 0}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.ativo ? (
          <StatusBadge variante="sucesso">Ativo</StatusBadge>
        ) : (
          <StatusBadge variante="neutro">Inativo</StatusBadge>
        ),
    },
    {
      id: 'acoes',
      header: '',
      cell: ({ row }) => acoesConvenio(row.original),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Convênios"
        descricao="Planos/operadoras que a clínica atende. Reutilizados no cadastro dos pacientes."
        acoes={
          <ConvenioFormDrawer
            trigger={
              <Button>
                <Plus /> Adicionar convênio
              </Button>
            }
          />
        }
      />

      {isError ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Não foi possível carregar os convênios. Tente novamente.
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={colunas}
          data={data ?? []}
          carregando={isLoading}
          vazio="Nenhum convênio cadastrado."
          cardMobile={(convenio) => (
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold break-words">{convenio.nome}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {convenio.pacientes ?? 0} paciente{(convenio.pacientes ?? 0) === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">{acoesConvenio(convenio)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {convenio.ativo ? (
                  <StatusBadge variante="sucesso">Ativo</StatusBadge>
                ) : (
                  <StatusBadge variante="neutro">Inativo</StatusBadge>
                )}
              </div>
            </div>
          )}
        />
      )}
    </div>
  )
}

const schema = z.object({
  nome: z.string().min(1, 'Informe o nome do convênio'),
  ativo: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function valoresIniciais(convenio?: Convenio): FormValues {
  return { nome: convenio?.nome ?? '', ativo: convenio?.ativo ?? true }
}

/** Cadastro/edição de convênio num drawer lateral (igual ao de usuário). */
function ConvenioFormDrawer({ trigger, convenio }: { trigger: ReactNode; convenio?: Convenio }) {
  const [aberto, setAberto] = useState(false)
  const criar = useCriarConvenio()
  const atualizar = useAtualizarConvenio()
  const edicao = Boolean(convenio)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresIniciais(convenio),
  })

  useEffect(() => {
    if (aberto) reset(valoresIniciais(convenio))
  }, [aberto, convenio, reset])

  async function onSubmit(valores: FormValues) {
    const dados: ConvenioEntrada = { nome: valores.nome, ativo: valores.ativo }
    try {
      if (edicao && convenio) await atualizar.mutateAsync({ id: convenio.id, dados })
      else await criar.mutateAsync(dados)
      toast.success(edicao ? 'Convênio atualizado.' : 'Convênio adicionado.')
      setAberto(false)
    } catch (excecao) {
      const erro = excecao as ErroApi
      if (erro.campos?.nome) setError('nome', { message: erro.campos.nome[0] })
      else toast.error(erro.mensagem ?? 'Não foi possível salvar o convênio.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <CabecalhoDrawer
          icone={BadgeCheck}
          titulo={edicao ? 'Editar convênio' : 'Novo convênio'}
          descricao="Plano/operadora que a clínica atende — reutilizado nos planos dos pacientes."
        />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4">
          <CorpoDrawer>
            <Campo id="nome" label="Nome" obrigatorio erro={errors.nome?.message}>
              <Input
                id="nome"
                placeholder="ex.: Amil Dental, Uniodonto…"
                aria-required="true"
                aria-invalid={errors.nome ? true : undefined}
                {...register('nome')}
              />
            </Campo>

            <LinhaToggle
              titulo="Convênio ativo"
              ajuda="Convênios inativos não aparecem para novos planos."
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
