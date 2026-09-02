import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Boxes, Pencil, Plus, Trash2 } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import {
  CabecalhoDrawer,
  Campo,
  classeCampoSelect,
  CorpoDrawer,
  LinhaToggle,
} from '@/components/common/form-kit'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetTrigger } from '@/components/ui/sheet'
import type { ErroApi } from '@/lib/api/client'

import {
  type Insumo,
  type InsumoEntrada,
  useAtualizarInsumo,
  useCategoriasInsumo,
  useCriarInsumo,
  useInsumos,
  useRemoverInsumo,
} from './use-estoque'

const traco = <span className="text-muted-foreground">—</span>

const UNIDADES: { valor: string; rotulo: string }[] = [
  { valor: 'UN', rotulo: 'Unidade' },
  { valor: 'CX', rotulo: 'Caixa' },
  { valor: 'FR', rotulo: 'Frasco' },
  { valor: 'PC', rotulo: 'Pacote' },
  { valor: 'ML', rotulo: 'Mililitro' },
  { valor: 'G', rotulo: 'Grama' },
]

export function AbaInsumos() {
  const { data, isLoading } = useInsumos()
  const remover = useRemoverInsumo()

  async function excluir(insumo: Insumo) {
    try {
      await remover.mutateAsync(insumo.id)
      toast.success('Insumo excluído.')
    } catch (excecao) {
      toast.error(
        (excecao as ErroApi).mensagem ??
          'Não foi possível excluir. Se houver movimentações vinculadas, inative o insumo.',
      )
    }
  }

  const acoesInsumo = (insumo: Insumo) => (
    <div className="flex items-center justify-end gap-1">
      <InsumoFormDrawer
        insumo={insumo}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            title="Editar insumo"
            aria-label={`Editar ${insumo.nome}`}
          >
            <Pencil />
          </Button>
        }
      />
      <ConfirmDialog
        titulo="Excluir insumo?"
        descricao={`Remove ${insumo.nome}. Insumos com movimentações/consumos vinculados não podem ser excluídos.`}
        rotuloConfirmar="Excluir"
        destrutivo
        onConfirmar={() => excluir(insumo)}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            title="Excluir insumo"
            aria-label={`Excluir ${insumo.nome}`}
          >
            <Trash2 className="text-destructive" />
          </Button>
        }
      />
    </div>
  )

  const colunas: ColumnDef<Insumo, unknown>[] = [
    {
      accessorKey: 'nome',
      header: 'Nome',
      cell: ({ row }) => (
        <Link to={`/estoque/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.nome}
        </Link>
      ),
    },
    {
      id: 'categoria',
      header: 'Categoria',
      cell: ({ row }) => row.original.categoria_nome || traco,
    },
    {
      id: 'unidade',
      header: 'Unidade',
      cell: ({ row }) => UNIDADES.find((u) => u.valor === row.original.unidade)?.rotulo ?? row.original.unidade,
    },
    {
      id: 'saldo',
      header: 'Saldo',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="tabular-nums">{row.original.saldo}</span>
          {row.original.estoque_baixo && <StatusBadge variante="erro">Estoque baixo</StatusBadge>}
        </div>
      ),
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
      cell: ({ row }) => acoesInsumo(row.original),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex">
        <InsumoFormDrawer
          trigger={
            <Button size="sm" className="w-full sm:ml-auto sm:w-auto">
              <Plus /> Novo insumo
            </Button>
          }
        />
      </div>

      <DataTable
        columns={colunas}
        data={data ?? []}
        carregando={isLoading}
        vazio="Nenhum insumo cadastrado."
        cardMobile={(insumo) => (
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to={`/estoque/${insumo.id}`}
                  className="font-semibold text-primary break-words hover:underline"
                >
                  {insumo.nome}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {insumo.categoria_nome || 'Sem categoria'}
                  {' · '}
                  {UNIDADES.find((u) => u.valor === insumo.unidade)?.rotulo ?? insumo.unidade}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">{acoesInsumo(insumo)}</div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm tabular-nums">Saldo: {insumo.saldo}</span>
              {insumo.estoque_baixo && <StatusBadge variante="erro">Estoque baixo</StatusBadge>}
              {insumo.ativo ? (
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
  nome: z.string().min(1, 'Informe o nome do insumo'),
  descricao: z.string(),
  categoria: z.string(),
  unidade: z.string().min(1, 'Selecione a unidade'),
  estoque_minimo: z.string(),
  ativo: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function valoresIniciais(insumo?: Insumo): FormValues {
  return {
    nome: insumo?.nome ?? '',
    descricao: insumo?.descricao ?? '',
    categoria: insumo?.categoria ? String(insumo.categoria) : '',
    unidade: insumo?.unidade ?? 'UN',
    estoque_minimo: insumo?.estoque_minimo ?? '0',
    ativo: insumo?.ativo ?? true,
  }
}

export function InsumoFormDrawer({ trigger, insumo }: { trigger: ReactNode; insumo?: Insumo }) {
  const [aberto, setAberto] = useState(false)
  const criar = useCriarInsumo()
  const atualizar = useAtualizarInsumo()
  const { data: categorias } = useCategoriasInsumo()
  const edicao = Boolean(insumo)
  const categoriaAtual = insumo?.categoria ?? null
  const categoriasDisponiveis = (categorias ?? []).filter(
    (c) => c.ativo || c.id === categoriaAtual,
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresIniciais(insumo),
  })

  useEffect(() => {
    if (aberto) reset(valoresIniciais(insumo))
  }, [aberto, insumo, reset])

  async function onSubmit(valores: FormValues) {
    const dados: InsumoEntrada = {
      nome: valores.nome,
      descricao: valores.descricao,
      categoria: valores.categoria ? Number(valores.categoria) : null,
      unidade: valores.unidade,
      estoque_minimo: valores.estoque_minimo || '0',
      ativo: valores.ativo,
    }
    try {
      if (edicao && insumo) await atualizar.mutateAsync({ id: insumo.id, dados })
      else await criar.mutateAsync(dados)
      toast.success(edicao ? 'Insumo atualizado.' : 'Insumo adicionado.')
      setAberto(false)
    } catch (excecao) {
      const erro = excecao as ErroApi
      if (erro.campos?.nome) toast.error(erro.campos.nome[0])
      else toast.error(erro.mensagem ?? 'Não foi possível salvar o insumo.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <CabecalhoDrawer
          icone={Boxes}
          titulo={edicao ? 'Editar insumo' : 'Novo insumo'}
          descricao="Item de estoque da clínica (material de consumo, EPI, etc.)."
        />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4">
          <CorpoDrawer>
            <Campo id="nome" label="Nome" obrigatorio erro={errors.nome?.message}>
              <Input
                id="nome"
                placeholder="ex.: Luva de procedimento M, Anestésico…"
                aria-required="true"
                aria-invalid={errors.nome ? true : undefined}
                {...register('nome')}
              />
            </Campo>

            <Campo id="categoria" label="Categoria">
              <select id="categoria" className={classeCampoSelect} {...register('categoria')}>
                <option value="">Sem categoria</option>
                {categoriasDisponiveis.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="unidade" label="Unidade" obrigatorio erro={errors.unidade?.message}>
                <select
                  id="unidade"
                  className={classeCampoSelect}
                  aria-invalid={!!errors.unidade}
                  {...register('unidade')}
                >
                  {UNIDADES.map((u) => (
                    <option key={u.valor} value={u.valor}>
                      {u.rotulo}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo
                id="estoque_minimo"
                label="Estoque mínimo"
                ajuda="0 = sem alerta de reposição."
              >
                <Input
                  id="estoque_minimo"
                  inputMode="decimal"
                  {...register('estoque_minimo')}
                />
              </Campo>
            </div>

            <Campo id="descricao" label="Descrição">
              <Input id="descricao" placeholder="Opcional" {...register('descricao')} />
            </Campo>

            <LinhaToggle
              titulo="Insumo ativo"
              ajuda="Inativos não aparecem para novas movimentações/consumos."
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
