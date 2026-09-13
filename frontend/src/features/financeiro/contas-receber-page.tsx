import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { DateText, Money } from '@/components/common/formato'
import { classeCampoSelect } from '@/components/common/form-kit'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BadgeStatus } from '@/features/pacientes/status'
import type { ErroApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import { useConvenios } from '../convenios/use-convenios'
import { COR_LINHA, ROTULO_FORMA_PAGAMENTO, situacaoDe } from './formato'
import { LancamentoFormDrawer } from './lancamento-form-drawer'
import {
  type LancamentoFinanceiro,
  useEstornarLancamento,
  useLancamentos,
  useQuitarLancamento,
  useRemoverLancamento,
} from './use-lancamentos'
import { useFaturarOperadora, useFaturas } from './use-faturas'

const OPCOES_STATUS: { valor: string; rotulo: string }[] = [
  { valor: '', rotulo: 'Todos os status' },
  { valor: 'PENDENTE', rotulo: 'Pendente' },
  { valor: 'PAGO', rotulo: 'Pago' },
  { valor: 'CANCELADO', rotulo: 'Cancelado' },
]

function AbaLancamentos() {
  const [status, setStatus] = useState('')
  const { data, isLoading } = useLancamentos({
    tipo: 'RECEITA',
    status: (status || undefined) as 'PENDENTE' | 'PAGO' | 'CANCELADO' | undefined,
  })
  const quitar = useQuitarLancamento()
  const estornar = useEstornarLancamento()
  const remover = useRemoverLancamento()

  async function marcarPago(l: LancamentoFinanceiro) {
    try {
      await quitar.mutateAsync(l.id)
      toast.success('Lançamento marcado como pago.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível marcar como pago.')
    }
  }

  async function desfazerPagamento(l: LancamentoFinanceiro) {
    try {
      await estornar.mutateAsync(l.id)
      toast.success('Pagamento desfeito.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível desfazer o pagamento.')
    }
  }

  async function excluir(l: LancamentoFinanceiro) {
    try {
      await remover.mutateAsync(l.id)
      toast.success('Lançamento excluído.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível excluir o lançamento.')
    }
  }

  const acoes = (l: LancamentoFinanceiro) => (
    <div className="flex items-center justify-end gap-1">
      {l.status === 'PENDENTE' && (
        <Button variant="outline" size="sm" onClick={() => marcarPago(l)}>
          Marcar como pago
        </Button>
      )}
      {l.status === 'PAGO' && (
        <Button variant="ghost" size="sm" onClick={() => desfazerPagamento(l)}>
          Desfazer pagamento
        </Button>
      )}
      {!l.origem_automatica && (
        <>
          <LancamentoFormDrawer
            lancamento={l}
            trigger={
              <Button variant="ghost" size="icon" title="Editar lançamento" aria-label="Editar lançamento">
                <Pencil />
              </Button>
            }
          />
          <ConfirmDialog
            titulo="Excluir lançamento?"
            descricao={`Remove "${l.descricao}" definitivamente.`}
            rotuloConfirmar="Excluir"
            destrutivo
            onConfirmar={() => excluir(l)}
            trigger={
              <Button variant="ghost" size="icon" title="Excluir lançamento" aria-label="Excluir lançamento">
                <Trash2 className="text-destructive" />
              </Button>
            }
          />
        </>
      )}
    </div>
  )

  const colunas: ColumnDef<LancamentoFinanceiro, unknown>[] = [
    { id: 'paciente', header: 'Paciente', cell: ({ row }) => row.original.paciente_nome || '—' },
    { accessorKey: 'descricao', header: 'Descrição' },
    {
      id: 'vencimento',
      header: 'Vencimento',
      cell: ({ row }) => <DateText iso={row.original.vencimento} />,
    },
    { id: 'valor', header: 'Valor', cell: ({ row }) => <Money valor={row.original.valor} /> },
    {
      id: 'forma_pagamento',
      header: 'Forma de pagamento',
      cell: ({ row }) =>
        (row.original.forma_pagamento && ROTULO_FORMA_PAGAMENTO[row.original.forma_pagamento]) || '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <BadgeStatus status={row.original.status} />,
    },
    { id: 'acoes', header: '', cell: ({ row }) => acoes(row.original) },
  ]

  return (
    <div className="space-y-3">
      <select
        aria-label="Filtrar por status"
        className={cn(classeCampoSelect, 'w-full sm:w-56')}
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        {OPCOES_STATUS.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>

      <DataTable
        columns={colunas}
        data={data ?? []}
        carregando={isLoading}
        vazio="Nenhuma conta a receber."
        linhaClassName={(l) => COR_LINHA[situacaoDe(l)]}
        cardMobile={(l) => (
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold break-words">{l.paciente_nome || l.descricao}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{l.descricao}</p>
              </div>
              <BadgeStatus status={l.status} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                <Money valor={l.valor} /> · Vence em <DateText iso={l.vencimento} />
              </span>
            </div>
            <div className="flex justify-end">{acoes(l)}</div>
          </div>
        )}
      />
    </div>
  )
}

function AbaFaturas() {
  const { data: faturas, isLoading } = useFaturas()
  const { data: convenios } = useConvenios()
  const faturar = useFaturarOperadora()
  const [operadora, setOperadora] = useState('')
  const [competencia, setCompetencia] = useState('')

  async function faturarOperadora() {
    if (!operadora) {
      toast.error('Selecione a operadora.')
      return
    }
    try {
      await faturar.mutateAsync({ operadora, competencia: competencia || undefined })
      toast.success('Fatura gerada.')
      setCompetencia('')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível faturar a operadora.')
    }
  }

  const colunas: ColumnDef<NonNullable<typeof faturas>[number], unknown>[] = [
    { accessorKey: 'numero', header: 'Número' },
    { accessorKey: 'operadora', header: 'Operadora' },
    { accessorKey: 'competencia', header: 'Competência' },
    {
      id: 'valor_total',
      header: 'Valor total',
      cell: ({ row }) => <Money valor={row.original.valor_total} />,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <BadgeStatus status={row.original.status} />,
    },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="fatura-operadora" className="text-sm font-medium">
              Faturar operadora
            </label>
            <select
              id="fatura-operadora"
              className={classeCampoSelect}
              value={operadora}
              onChange={(e) => setOperadora(e.target.value)}
            >
              <option value="">Selecione a operadora…</option>
              {(convenios ?? []).map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="fatura-competencia" className="text-sm font-medium">
              Competência (opcional)
            </label>
            <Input
              id="fatura-competencia"
              placeholder="MM/AAAA"
              className="w-full sm:w-32"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
            />
          </div>
          <Button onClick={faturarOperadora} disabled={faturar.isPending}>
            {faturar.isPending ? 'Faturando…' : 'Faturar'}
          </Button>
        </CardContent>
      </Card>

      <DataTable
        columns={colunas}
        data={faturas ?? []}
        carregando={isLoading}
        vazio="Nenhuma fatura gerada ainda."
      />
    </div>
  )
}

export function ContasReceberPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Contas a Receber"
        descricao="Lançamentos de receita (particular e convênio) e faturamento por operadora."
        acoes={
          <LancamentoFormDrawer
            tipo="RECEITA"
            trigger={
              <Button>
                <Plus /> Novo lançamento
              </Button>
            }
          />
        }
      />

      <Tabs defaultValue="lancamentos">
        <TabsList>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="faturas">
            <Receipt className="mr-1.5 size-4" /> Faturas
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lancamentos">
          <AbaLancamentos />
        </TabsContent>
        <TabsContent value="faturas">
          <AbaFaturas />
        </TabsContent>
      </Tabs>
    </div>
  )
}
