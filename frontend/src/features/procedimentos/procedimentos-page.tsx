import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetTrigger } from '@/components/ui/sheet'
import type { ErroApi } from '@/lib/api/client'

import {
  type Procedimento,
  type ProcedimentoEntrada,
  useAtualizarProcedimento,
  useCriarProcedimento,
  useProcedimentos,
  useRemoverProcedimento,
} from './use-procedimentos'

export function ProcedimentosPage() {
  const { data, isLoading, isError } = useProcedimentos()
  const remover = useRemoverProcedimento()

  async function excluir(procedimento: Procedimento) {
    try {
      await remover.mutateAsync(procedimento.id)
      toast.success('Procedimento excluído.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível excluir o procedimento.')
    }
  }

  // Ações do procedimento (editar + excluir). Compartilhadas entre a coluna
  // (desktop) e o card do mobile.
  const acoesProcedimento = (procedimento: Procedimento) => (
    <div className="flex items-center justify-end gap-1">
      <ProcedimentoFormDrawer
        procedimento={procedimento}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            title="Editar procedimento"
            aria-label={`Editar ${procedimento.nome}`}
          >
            <Pencil />
          </Button>
        }
      />
      <ConfirmDialog
        titulo="Excluir procedimento?"
        descricao={`Remove ${procedimento.nome}. Procedimentos usados em consultas não podem ser excluídos.`}
        rotuloConfirmar="Excluir"
        destrutivo
        onConfirmar={() => excluir(procedimento)}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            title="Excluir procedimento"
            aria-label={`Excluir ${procedimento.nome}`}
          >
            <Trash2 className="text-destructive" />
          </Button>
        }
      />
    </div>
  )

  const colunas: ColumnDef<Procedimento, unknown>[] = [
    { accessorKey: 'nome', header: 'Nome' },
    {
      id: 'valor',
      header: 'Valor',
      cell: ({ row }) => <span className="tabular-nums">{row.original.valor}</span>,
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
      cell: ({ row }) => acoesProcedimento(row.original),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Procedimentos"
        descricao="Catálogo de procedimentos da clínica. Usados no agendamento e nas regras de lembrete."
        acoes={
          <ProcedimentoFormDrawer
            trigger={
              <Button>
                <Plus /> Adicionar procedimento
              </Button>
            }
          />
        }
      />

      {isError ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Não foi possível carregar os procedimentos. Tente novamente.
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={colunas}
          data={data ?? []}
          carregando={isLoading}
          vazio="Nenhum procedimento cadastrado."
          cardMobile={(procedimento) => (
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-semibold break-words">{procedimento.nome}</p>
                <div className="flex shrink-0 items-center gap-1">
                  {acoesProcedimento(procedimento)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm tabular-nums">Valor: {procedimento.valor}</span>
                {procedimento.ativo ? (
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
  nome: z.string().min(1, 'Informe o nome do procedimento'),
  valor: z.string(),
  ativo: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function valoresIniciais(procedimento?: Procedimento): FormValues {
  return {
    nome: procedimento?.nome ?? '',
    valor: procedimento?.valor ?? '0',
    ativo: procedimento?.ativo ?? true,
  }
}

/** Cadastro/edição de procedimento num drawer lateral. */
function ProcedimentoFormDrawer({
  trigger,
  procedimento,
}: {
  trigger: ReactNode
  procedimento?: Procedimento
}) {
  const [aberto, setAberto] = useState(false)
  const criar = useCriarProcedimento()
  const atualizar = useAtualizarProcedimento()
  const edicao = Boolean(procedimento)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresIniciais(procedimento),
  })

  useEffect(() => {
    if (aberto) reset(valoresIniciais(procedimento))
  }, [aberto, procedimento, reset])

  async function onSubmit(valores: FormValues) {
    const dados: ProcedimentoEntrada = {
      nome: valores.nome,
      valor: valores.valor || '0',
      ativo: valores.ativo,
    }
    try {
      if (edicao && procedimento) await atualizar.mutateAsync({ id: procedimento.id, dados })
      else await criar.mutateAsync(dados)
      toast.success(edicao ? 'Procedimento atualizado.' : 'Procedimento adicionado.')
      setAberto(false)
    } catch (excecao) {
      const erro = excecao as ErroApi
      if (erro.campos?.nome) setError('nome', { message: erro.campos.nome[0] })
      else toast.error(erro.mensagem ?? 'Não foi possível salvar o procedimento.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <CabecalhoDrawer
          icone={ClipboardList}
          titulo={edicao ? 'Editar procedimento' : 'Novo procedimento'}
          descricao="Procedimento do catálogo — usado no agendamento e nas regras de lembrete."
        />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4">
          <CorpoDrawer>
            <Campo id="nome" label="Nome" obrigatorio erro={errors.nome?.message}>
              <Input
                id="nome"
                placeholder="ex.: Limpeza, Restauração, Canal…"
                aria-required="true"
                aria-invalid={errors.nome ? true : undefined}
                {...register('nome')}
              />
            </Campo>

            <Campo id="valor" label="Valor padrão" ajuda="Sugerido ao agendar; pode ser alterado na consulta.">
              <Input id="valor" inputMode="decimal" {...register('valor')} />
            </Campo>

            <LinhaToggle
              titulo="Procedimento ativo"
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
