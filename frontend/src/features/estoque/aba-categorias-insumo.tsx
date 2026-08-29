import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { CabecalhoDrawer, Campo, CorpoDrawer, LinhaToggle } from '@/components/common/form-kit'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetTrigger } from '@/components/ui/sheet'
import type { ErroApi } from '@/lib/api/client'

import {
  type CategoriaInsumo,
  type CategoriaInsumoEntrada,
  useAtualizarCategoriaInsumo,
  useCategoriasInsumo,
  useCriarCategoriaInsumo,
  useRemoverCategoriaInsumo,
} from './use-estoque'

export function AbaCategoriasInsumo() {
  const { data, isLoading } = useCategoriasInsumo()
  const remover = useRemoverCategoriaInsumo()

  async function excluir(categoria: CategoriaInsumo) {
    try {
      await remover.mutateAsync(categoria.id)
      toast.success('Categoria excluída.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível excluir a categoria.')
    }
  }

  const acoesCategoria = (categoria: CategoriaInsumo) => (
    <div className="flex items-center justify-end gap-1">
      <CategoriaFormDrawer
        categoria={categoria}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            title="Editar categoria"
            aria-label={`Editar ${categoria.nome}`}
          >
            <Pencil />
          </Button>
        }
      />
      <ConfirmDialog
        titulo="Excluir categoria?"
        descricao={`Remove ${categoria.nome}. Insumos vinculados ficam sem categoria.`}
        rotuloConfirmar="Excluir"
        destrutivo
        onConfirmar={() => excluir(categoria)}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            title="Excluir categoria"
            aria-label={`Excluir ${categoria.nome}`}
          >
            <Trash2 className="text-destructive" />
          </Button>
        }
      />
    </div>
  )

  const colunas: ColumnDef<CategoriaInsumo, unknown>[] = [
    { accessorKey: 'nome', header: 'Nome' },
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
      cell: ({ row }) => acoesCategoria(row.original),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex">
        <CategoriaFormDrawer
          trigger={
            <Button size="sm" className="w-full sm:ml-auto sm:w-auto">
              <Plus /> Nova categoria
            </Button>
          }
        />
      </div>

      <DataTable
        columns={colunas}
        data={data ?? []}
        carregando={isLoading}
        vazio="Nenhuma categoria cadastrada."
        cardMobile={(categoria) => (
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 font-semibold break-words">{categoria.nome}</p>
              <div className="flex shrink-0 items-center gap-1">{acoesCategoria(categoria)}</div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {categoria.ativo ? (
                <StatusBadge variante="sucesso">Ativo</StatusBadge>
              ) : (
                <StatusBadge variante="neutro">Inativo</StatusBadge>
              )}
            </div>
          </div>
        )}
      />
    </div>
  )
}

const schema = z.object({
  nome: z.string().min(1, 'Informe o nome da categoria'),
  descricao: z.string(),
  ativo: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function valoresIniciais(categoria?: CategoriaInsumo): FormValues {
  return {
    nome: categoria?.nome ?? '',
    descricao: categoria?.descricao ?? '',
    ativo: categoria?.ativo ?? true,
  }
}

function CategoriaFormDrawer({
  trigger,
  categoria,
}: {
  trigger: ReactNode
  categoria?: CategoriaInsumo
}) {
  const [aberto, setAberto] = useState(false)
  const criar = useCriarCategoriaInsumo()
  const atualizar = useAtualizarCategoriaInsumo()
  const edicao = Boolean(categoria)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresIniciais(categoria),
  })

  useEffect(() => {
    if (aberto) reset(valoresIniciais(categoria))
  }, [aberto, categoria, reset])

  async function onSubmit(valores: FormValues) {
    const dados: CategoriaInsumoEntrada = {
      nome: valores.nome,
      descricao: valores.descricao,
      ativo: valores.ativo,
    }
    try {
      if (edicao && categoria) await atualizar.mutateAsync({ id: categoria.id, dados })
      else await criar.mutateAsync(dados)
      toast.success(edicao ? 'Categoria atualizada.' : 'Categoria adicionada.')
      setAberto(false)
    } catch (excecao) {
      const erro = excecao as ErroApi
      if (erro.campos?.nome) toast.error(erro.campos.nome[0])
      else toast.error(erro.mensagem ?? 'Não foi possível salvar a categoria.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <CabecalhoDrawer
          icone={Layers}
          titulo={edicao ? 'Editar categoria' : 'Nova categoria'}
          descricao="Agrupamento de insumos (ex.: Descartáveis, Anestésicos)."
        />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4">
          <CorpoDrawer>
            <Campo id="nome" label="Nome" obrigatorio erro={errors.nome?.message}>
              <Input
                id="nome"
                placeholder="ex.: Descartáveis, Anestésicos…"
                aria-required="true"
                aria-invalid={errors.nome ? true : undefined}
                {...register('nome')}
              />
            </Campo>

            <Campo id="descricao" label="Descrição">
              <Input id="descricao" placeholder="Opcional" {...register('descricao')} />
            </Campo>

            <LinhaToggle
              titulo="Categoria ativa"
              ajuda="Inativas não aparecem para novos insumos."
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
