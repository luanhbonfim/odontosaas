import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDownCircle, ArrowUpCircle, Plus } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { DataTable } from '@/components/common/data-table'
import { CabecalhoDrawer, Campo, classeCampoSelect, CorpoDrawer } from '@/components/common/form-kit'
import { DateTime } from '@/components/common/formato'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetTrigger } from '@/components/ui/sheet'
import type { ErroApi } from '@/lib/api/client'

import {
  type MovimentacaoEntrada,
  type MovimentacaoEstoque,
  useCriarMovimentacao,
  useInsumos,
  useMovimentacoesEstoque,
} from './use-estoque'

const traco = <span className="text-muted-foreground">—</span>

type Tipo = 'ENTRADA' | 'SAIDA'

const CONFIG: Record<
  Tipo,
  { titulo: string; botao: string; drawerTitulo: string; drawerDescricao: string; vazio: string }
> = {
  ENTRADA: {
    titulo: 'Lançamentos',
    botao: 'Novo lançamento',
    drawerTitulo: 'Novo lançamento',
    drawerDescricao: 'Entrada de estoque — compra, reposição, doação.',
    vazio: 'Nenhum lançamento registrado.',
  },
  SAIDA: {
    titulo: 'Baixas',
    botao: 'Nova baixa',
    drawerTitulo: 'Nova baixa manual',
    drawerDescricao: 'Saída manual de estoque — perda, quebra, vencimento, ajuste.',
    vazio: 'Nenhuma baixa registrada.',
  },
}

/** Origem da baixa: automática (gerada pelo consumo numa consulta) ou manual. */
function BadgeOrigem({ movimentacao }: { movimentacao: MovimentacaoEstoque }) {
  return movimentacao.consulta ? (
    <StatusBadge variante="info">Automática (consulta)</StatusBadge>
  ) : (
    <StatusBadge variante="neutro">Manual</StatusBadge>
  )
}

/** Lista + registro de movimentações de um único tipo (Lançamentos = ENTRADA, Baixas = SAIDA). */
function AbaMovimentacoesPorTipo({ tipo }: { tipo: Tipo }) {
  const { data, isLoading } = useMovimentacoesEstoque(tipo)
  const cfg = CONFIG[tipo]

  const colunas: ColumnDef<MovimentacaoEstoque, unknown>[] = [
    { id: 'insumo', header: 'Insumo', cell: ({ row }) => row.original.insumo_nome },
    {
      id: 'quantidade',
      header: 'Quantidade',
      cell: ({ row }) => <span className="tabular-nums">{row.original.quantidade}</span>,
    },
    ...(tipo === 'SAIDA'
      ? [
          {
            id: 'origem',
            header: 'Origem',
            cell: ({ row }: { row: { original: MovimentacaoEstoque } }) => (
              <BadgeOrigem movimentacao={row.original} />
            ),
          } satisfies ColumnDef<MovimentacaoEstoque, unknown>,
        ]
      : []),
    {
      id: 'observacao',
      header: 'Observação',
      cell: ({ row }) => row.original.observacao || traco,
    },
    {
      id: 'data',
      header: 'Data',
      cell: ({ row }) => <DateTime iso={row.original.criado_em} />,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex">
        <MovimentacaoFormDrawer
          tipo={tipo}
          trigger={
            <Button size="sm" className="w-full sm:ml-auto sm:w-auto">
              <Plus /> {cfg.botao}
            </Button>
          }
        />
      </div>

      <DataTable
        columns={colunas}
        data={data ?? []}
        carregando={isLoading}
        vazio={cfg.vazio}
        cardMobile={(m) => (
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 font-semibold break-words">{m.insumo_nome}</p>
              <span className="shrink-0 text-sm tabular-nums">{m.quantidade}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              <DateTime iso={m.criado_em} />
            </p>
            {tipo === 'SAIDA' && (
              <div className="flex flex-wrap items-center gap-1.5">
                <BadgeOrigem movimentacao={m} />
              </div>
            )}
            {m.observacao && <p className="text-xs text-muted-foreground">{m.observacao}</p>}
          </div>
        )}
      />
    </div>
  )
}

export function AbaLancamentos() {
  return <AbaMovimentacoesPorTipo tipo="ENTRADA" />
}

export function AbaBaixas() {
  return <AbaMovimentacoesPorTipo tipo="SAIDA" />
}

const schema = z.object({
  insumo: z.string().min(1, 'Selecione um insumo'),
  quantidade: z.string().min(1, 'Informe a quantidade'),
  observacao: z.string(),
})

type FormValues = z.infer<typeof schema>

const VALORES_INICIAIS: FormValues = { insumo: '', quantidade: '', observacao: '' }

function MovimentacaoFormDrawer({ tipo, trigger }: { tipo: Tipo; trigger: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const criar = useCriarMovimentacao()
  const { data: insumos } = useInsumos()
  const cfg = CONFIG[tipo]
  const Icone = tipo === 'ENTRADA' ? ArrowDownCircle : ArrowUpCircle

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
    const dados: MovimentacaoEntrada = {
      insumo: Number(valores.insumo),
      tipo,
      quantidade: valores.quantidade,
      observacao: valores.observacao,
    }
    try {
      await criar.mutateAsync(dados)
      toast.success(tipo === 'ENTRADA' ? 'Lançamento registrado.' : 'Baixa registrada.')
      setAberto(false)
    } catch (excecao) {
      const erro = excecao as ErroApi
      if (erro.campos?.quantidade) toast.error(erro.campos.quantidade[0])
      else toast.error(erro.mensagem ?? 'Não foi possível registrar.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <CabecalhoDrawer icone={Icone} titulo={cfg.drawerTitulo} descricao={cfg.drawerDescricao} />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4">
          <CorpoDrawer>
            <Campo id="insumo" label="Insumo" obrigatorio erro={errors.insumo?.message}>
              <select
                id="insumo"
                className={classeCampoSelect}
                aria-invalid={!!errors.insumo}
                {...register('insumo')}
              >
                <option value="">Selecione…</option>
                {(insumos ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo id="quantidade" label="Quantidade" obrigatorio erro={errors.quantidade?.message}>
              <Input
                id="quantidade"
                inputMode="decimal"
                aria-invalid={!!errors.quantidade}
                {...register('quantidade')}
              />
            </Campo>

            <Campo id="observacao" label="Observação">
              <Input id="observacao" placeholder="Opcional" {...register('observacao')} />
            </Campo>
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
