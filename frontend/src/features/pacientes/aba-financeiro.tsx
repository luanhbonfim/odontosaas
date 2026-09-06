import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'

import { DataTable } from '@/components/common/data-table'
import { DateText, DateTime, Money } from '@/components/common/formato'
import { Button } from '@/components/ui/button'
import { useEstornarLancamento, useQuitarLancamento } from '@/features/financeiro/use-lancamentos'
import type { ErroApi } from '@/lib/api/client'

import { BadgeStatus } from './status'
import { type Lancamento, useLancamentosDoPaciente } from './use-paciente-detalhe'

const ROTULO_FORMA_PAGAMENTO: Record<string, string> = {
  PIX: 'Pix',
  BOLETO: 'Boleto',
  CARTAO: 'Cartão',
  DINHEIRO: 'Dinheiro',
  TRANSFERENCIA: 'Transferência',
}

function rotuloParcela(l: Lancamento): string {
  return (l.total_parcelas ?? 1) > 1 ? `${l.numero_parcela}/${l.total_parcelas}` : '—'
}

export function AbaFinanceiro({ pacienteId }: { pacienteId: number }) {
  const { data, isLoading } = useLancamentosDoPaciente(pacienteId)
  const quitar = useQuitarLancamento()
  const estornar = useEstornarLancamento()

  const lancamentos = data ?? []

  async function marcarPago(l: Lancamento) {
    try {
      await quitar.mutateAsync(l.id)
      toast.success('Lançamento marcado como pago.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível marcar como pago.')
    }
  }

  async function desfazerPagamento(l: Lancamento) {
    try {
      await estornar.mutateAsync(l.id)
      toast.success('Pagamento desfeito.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível desfazer o pagamento.')
    }
  }

  const acaoLancamento = (l: Lancamento) => {
    if (l.status === 'PENDENTE') {
      return (
        <Button variant="outline" size="sm" onClick={() => marcarPago(l)}>
          Marcar como pago
        </Button>
      )
    }
    if (l.status === 'PAGO') {
      return (
        <Button variant="ghost" size="sm" onClick={() => desfazerPagamento(l)}>
          Desfazer pagamento
        </Button>
      )
    }
    return null
  }

  const colunas: ColumnDef<Lancamento, unknown>[] = [
    {
      id: 'procedimento',
      header: 'Procedimento',
      accessorFn: (l) => l.consulta_procedimento ?? '',
      cell: ({ row }) => row.original.consulta_procedimento || '—',
    },
    {
      id: 'data_consulta',
      header: 'Data da consulta',
      accessorFn: (l) => l.consulta_data ?? '',
      cell: ({ row }) => <DateTime iso={row.original.consulta_data} />,
    },
    {
      id: 'parcela',
      header: 'Parcela',
      cell: ({ row }) => rotuloParcela(row.original),
    },
    {
      id: 'valor',
      header: 'Valor',
      cell: ({ row }) => <Money valor={row.original.valor ?? 0} />,
    },
    {
      id: 'vencimento',
      header: 'Vencimento',
      cell: ({ row }) => <DateText iso={row.original.vencimento} />,
    },
    {
      id: 'forma_pagamento',
      header: 'Forma de pagamento',
      cell: ({ row }) =>
        (row.original.forma_pagamento && ROTULO_FORMA_PAGAMENTO[row.original.forma_pagamento]) ||
        '—',
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (l) => l.status ?? '',
      cell: ({ row }) => <BadgeStatus status={row.original.status} />,
    },
    {
      id: 'acoes',
      header: '',
      cell: ({ row }) => <div className="flex justify-end">{acaoLancamento(row.original)}</div>,
    },
  ]

  return (
    <DataTable
      columns={colunas}
      data={lancamentos}
      carregando={isLoading}
      vazio="Nenhum lançamento financeiro."
      cardMobile={(l) => (
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold break-words">{l.consulta_procedimento || 'Consulta'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <DateTime iso={l.consulta_data} />
                {rotuloParcela(l) !== '—' ? ` · Parcela ${rotuloParcela(l)}` : ''}
              </p>
            </div>
            <BadgeStatus status={l.status} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              <Money valor={l.valor ?? 0} /> · Vence em <DateText iso={l.vencimento} />
            </span>
          </div>
          {acaoLancamento(l) && <div className="flex justify-end">{acaoLancamento(l)}</div>}
        </div>
      )}
    />
  )
}
