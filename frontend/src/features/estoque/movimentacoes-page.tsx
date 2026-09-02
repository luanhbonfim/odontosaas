import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftRight, Plus } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { DataTable } from '@/components/common/data-table'
import { CabecalhoDrawer, Campo, classeCampoSelect, CorpoDrawer } from '@/components/common/form-kit'
import { DateTime } from '@/components/common/formato'
import { StatusBadge, type VarianteStatus } from '@/components/common/status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { ErroApi } from '@/lib/api/client'

import {
  type FormaPagamento,
  type MovimentacaoEntrada,
  type MovimentacaoEstoque,
  useCriarMovimentacao,
  useInsumos,
  useMovimentacoesEstoque,
} from './use-estoque'
import { useFornecedores } from './use-fornecedores'

const traco = <span className="text-muted-foreground">—</span>

const FORMAS_PAGAMENTO: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: 'PIX', rotulo: 'Pix' },
  { valor: 'BOLETO', rotulo: 'Boleto' },
  { valor: 'CARTAO', rotulo: 'Cartão' },
  { valor: 'DINHEIRO', rotulo: 'Dinheiro' },
  { valor: 'TRANSFERENCIA', rotulo: 'Transferência' },
]

/** Origem de uma movimentação: quem/o que a gerou. */
function origemDaMovimentacao(m: MovimentacaoEstoque): { rotulo: string; variante: VarianteStatus } {
  if (m.tipo === 'SAIDA') {
    return m.consulta
      ? { rotulo: 'Automática (consulta)', variante: 'info' }
      : { rotulo: 'Manual', variante: 'neutro' }
  }
  return m.subtipo === 'COMPRA'
    ? { rotulo: 'Compra', variante: 'sucesso' }
    : { rotulo: 'Ajuste', variante: 'neutro' }
}

function BadgeOrigem({ movimentacao }: { movimentacao: MovimentacaoEstoque }) {
  const { rotulo, variante } = origemDaMovimentacao(movimentacao)
  return <StatusBadge variante={variante}>{rotulo}</StatusBadge>
}

/** Movimentações ordenadas cronologicamente (mais antiga primeiro) + saldo corrente. */
function comSaldoAcumulado(movimentacoes: MovimentacaoEstoque[]) {
  const ordenadas = [...movimentacoes].sort(
    (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime(),
  )
  let saldo = 0
  return ordenadas.map((m) => {
    saldo += m.tipo === 'ENTRADA' ? Number(m.quantidade) : -Number(m.quantidade)
    return { ...m, saldoApos: saldo }
  })
}

/** Tabela de movimentações reaproveitada pela lista geral e pelo extrato do insumo. */
export function TabelaMovimentacoes({
  movimentacoes,
  carregando,
  mostrarInsumo = true,
  mostrarSaldoAcumulado = false,
  vazio = 'Nenhuma movimentação registrada.',
}: {
  movimentacoes: MovimentacaoEstoque[]
  carregando?: boolean
  mostrarInsumo?: boolean
  mostrarSaldoAcumulado?: boolean
  vazio?: string
}) {
  const linhas = useMemo(
    () => (mostrarSaldoAcumulado ? comSaldoAcumulado(movimentacoes) : movimentacoes),
    [movimentacoes, mostrarSaldoAcumulado],
  )

  const colunas: ColumnDef<(typeof linhas)[number], unknown>[] = [
    ...(mostrarInsumo
      ? [{ id: 'insumo', header: 'Insumo', cell: ({ row }) => row.original.insumo_nome } satisfies ColumnDef<(typeof linhas)[number], unknown>]
      : []),
    {
      id: 'tipo',
      header: 'Tipo',
      cell: ({ row }) => (
        <StatusBadge variante={row.original.tipo === 'ENTRADA' ? 'sucesso' : 'erro'}>
          {row.original.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}
        </StatusBadge>
      ),
    },
    {
      id: 'origem',
      header: 'Origem',
      cell: ({ row }) => <BadgeOrigem movimentacao={row.original} />,
    },
    {
      id: 'quantidade',
      header: 'Quantidade',
      cell: ({ row }) => <span className="tabular-nums">{row.original.quantidade}</span>,
    },
    {
      id: 'fornecedor',
      header: 'Fornecedor',
      cell: ({ row }) => row.original.lancamento_financeiro_detalhe?.fornecedor_nome || traco,
    },
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
    ...(mostrarSaldoAcumulado
      ? [
          {
            id: 'saldoApos',
            header: 'Saldo após',
            cell: ({ row }) => (
              <span className="tabular-nums">
                {(row.original as MovimentacaoEstoque & { saldoApos: number }).saldoApos}
              </span>
            ),
          } satisfies ColumnDef<(typeof linhas)[number], unknown>,
        ]
      : []),
  ]

  return (
    <DataTable
      columns={colunas}
      data={linhas}
      carregando={carregando}
      vazio={vazio}
      cardMobile={(m) => (
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 font-semibold break-words">
              {mostrarInsumo ? m.insumo_nome : (m.observacao || (m.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'))}
            </p>
            <span className="shrink-0 text-sm tabular-nums">{m.quantidade}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            <DateTime iso={m.criado_em} />
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge variante={m.tipo === 'ENTRADA' ? 'sucesso' : 'erro'}>
              {m.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}
            </StatusBadge>
            <BadgeOrigem movimentacao={m} />
          </div>
          {m.lancamento_financeiro_detalhe?.fornecedor_nome && (
            <p className="text-xs text-muted-foreground">{m.lancamento_financeiro_detalhe.fornecedor_nome}</p>
          )}
          {m.observacao && mostrarInsumo && <p className="text-xs text-muted-foreground">{m.observacao}</p>}
          {'saldoApos' in m && (
            <p className="text-xs font-medium">Saldo após: {(m as { saldoApos: number }).saldoApos}</p>
          )}
        </div>
      )}
    />
  )
}

export function MovimentacoesPage() {
  const [filtroTipo, setFiltroTipo] = useState<'' | 'ENTRADA' | 'SAIDA'>('')
  const { data, isLoading } = useMovimentacoesEstoque({ tipo: filtroTipo || undefined })

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Movimentações"
        descricao="Histórico de entradas e saídas de estoque — ajustes, compras e baixas (manuais e automáticas)."
        acoes={
          <MovimentacaoFormDrawer
            trigger={
              <Button>
                <Plus /> Nova movimentação
              </Button>
            }
          />
        }
      />

      <div className="flex">
        <select
          aria-label="Filtrar por tipo"
          className={cn(classeCampoSelect, 'w-full sm:w-48')}
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as '' | 'ENTRADA' | 'SAIDA')}
        >
          <option value="">Todas</option>
          <option value="ENTRADA">Entradas</option>
          <option value="SAIDA">Saídas</option>
        </select>
      </div>

      <TabelaMovimentacoes movimentacoes={data ?? []} carregando={isLoading} />
    </div>
  )
}

const schema = z
  .object({
    tipo: z.enum(['ENTRADA', 'SAIDA']),
    subtipo: z.enum(['AJUSTE', 'COMPRA']),
    insumo: z.string().min(1, 'Selecione um insumo'),
    quantidade: z.string().min(1, 'Informe a quantidade'),
    observacao: z.string(),
    fornecedor: z.string(),
    valor: z.string(),
    forma_pagamento: z.string(),
    data_vencimento: z.string(),
  })
  .superRefine((valores, ctx) => {
    if (valores.tipo === 'ENTRADA' && valores.subtipo === 'COMPRA') {
      if (!valores.fornecedor) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fornecedor'], message: 'Selecione o fornecedor' })
      }
      if (!valores.valor) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['valor'], message: 'Informe o valor pago' })
      }
    }
  })

type FormValues = z.infer<typeof schema>

const VALORES_INICIAIS: FormValues = {
  tipo: 'ENTRADA',
  subtipo: 'AJUSTE',
  insumo: '',
  quantidade: '',
  observacao: '',
  fornecedor: '',
  valor: '',
  forma_pagamento: '',
  data_vencimento: '',
}

function MovimentacaoFormDrawer({ trigger }: { trigger: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const criar = useCriarMovimentacao()
  const { data: insumos } = useInsumos()
  const { data: fornecedores } = useFornecedores()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: VALORES_INICIAIS,
  })

  const tipo = watch('tipo')
  const subtipo = watch('subtipo')
  const ehCompra = tipo === 'ENTRADA' && subtipo === 'COMPRA'

  useEffect(() => {
    if (aberto) reset(VALORES_INICIAIS)
  }, [aberto, reset])

  async function onSubmit(valores: FormValues) {
    const dados: MovimentacaoEntrada = {
      insumo: Number(valores.insumo),
      tipo: valores.tipo,
      subtipo: valores.tipo === 'ENTRADA' ? valores.subtipo : undefined,
      quantidade: valores.quantidade,
      observacao: valores.observacao,
    }
    if (valores.tipo === 'ENTRADA' && valores.subtipo === 'COMPRA') {
      dados.fornecedor = Number(valores.fornecedor)
      dados.valor = valores.valor
      if (valores.forma_pagamento) dados.forma_pagamento = valores.forma_pagamento as FormaPagamento
      if (valores.data_vencimento) dados.data_vencimento = valores.data_vencimento
    }
    try {
      await criar.mutateAsync(dados)
      toast.success('Movimentação registrada.')
      setAberto(false)
    } catch (excecao) {
      const erro = excecao as ErroApi
      if (erro.campos?.quantidade) toast.error(erro.campos.quantidade[0])
      else if (erro.campos?.fornecedor) toast.error(erro.campos.fornecedor[0])
      else if (erro.campos?.valor) toast.error(erro.campos.valor[0])
      else toast.error(erro.mensagem ?? 'Não foi possível registrar.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <CabecalhoDrawer
          icone={ArrowLeftRight}
          titulo="Nova movimentação"
          descricao="Entrada (ajuste ou compra) ou saída manual de estoque."
        />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4">
          <CorpoDrawer>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="tipo" label="Tipo" obrigatorio>
                <select id="tipo" className={classeCampoSelect} {...register('tipo')}>
                  <option value="ENTRADA">Entrada</option>
                  <option value="SAIDA">Saída</option>
                </select>
              </Campo>

              {tipo === 'ENTRADA' && (
                <Campo id="subtipo" label="Origem" obrigatorio>
                  <select id="subtipo" className={classeCampoSelect} {...register('subtipo')}>
                    <option value="AJUSTE">Ajuste</option>
                    <option value="COMPRA">Compra</option>
                  </select>
                </Campo>
              )}
            </div>

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

            {ehCompra && (
              <>
                <Campo id="fornecedor" label="Fornecedor" obrigatorio erro={errors.fornecedor?.message}>
                  <select
                    id="fornecedor"
                    className={classeCampoSelect}
                    aria-invalid={!!errors.fornecedor}
                    {...register('fornecedor')}
                  >
                    <option value="">Selecione…</option>
                    {(fornecedores ?? []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </Campo>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo id="valor" label="Valor pago" obrigatorio erro={errors.valor?.message}>
                    <Input
                      id="valor"
                      inputMode="decimal"
                      placeholder="0,00"
                      aria-invalid={!!errors.valor}
                      {...register('valor')}
                    />
                  </Campo>
                  <Campo id="forma_pagamento" label="Forma de pagamento">
                    <select id="forma_pagamento" className={classeCampoSelect} {...register('forma_pagamento')}>
                      <option value="">Não informado</option>
                      {FORMAS_PAGAMENTO.map((f) => (
                        <option key={f.valor} value={f.valor}>
                          {f.rotulo}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>

                <Campo id="data_vencimento" label="Data do boleto/vencimento">
                  <Input id="data_vencimento" type="date" {...register('data_vencimento')} />
                </Campo>
              </>
            )}

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
