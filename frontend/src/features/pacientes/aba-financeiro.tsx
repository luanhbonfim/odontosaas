import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { toast } from 'sonner'

import { DataTable } from '@/components/common/data-table'
import { DateText, DateTime, Money } from '@/components/common/formato'
import { classeCampoSelect } from '@/components/common/form-kit'
import { Button } from '@/components/ui/button'
import { useEstornarLancamento, useQuitarLancamento } from '@/features/financeiro/use-lancamentos'
import type { ErroApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'

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

/** Situação de exibição — "Vencido" não é um status real do backend (só
 * PENDENTE/PAGO/CANCELADO): é PENDENTE cujo vencimento já passou. */
type Situacao = 'VENCIDO' | 'PENDENTE' | 'PAGO' | 'CANCELADO'

function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function situacaoDe(l: Lancamento): Situacao {
  if (l.status === 'PAGO') return 'PAGO'
  if (l.status === 'CANCELADO') return 'CANCELADO'
  return l.vencimento && l.vencimento < hojeISO() ? 'VENCIDO' : 'PENDENTE'
}

// Fundo "fraco" (translúcido) da linha pela situação — tons do próprio tema
// (destructive/warning/success), acompanham dark mode automaticamente.
const COR_LINHA: Record<Situacao, string> = {
  VENCIDO: 'bg-destructive/10',
  PENDENTE: 'bg-warning/10',
  PAGO: 'bg-success/10',
  CANCELADO: '',
}

const LEGENDA_SITUACAO: { situacao: Situacao; rotulo: string; cor: string }[] = [
  { situacao: 'VENCIDO', rotulo: 'Vencido', cor: 'bg-destructive' },
  { situacao: 'PENDENTE', rotulo: 'Pendente', cor: 'bg-warning' },
  { situacao: 'PAGO', rotulo: 'Pago', cor: 'bg-success' },
]

const OPCOES_FILTRO: { valor: '' | Situacao; rotulo: string }[] = [
  { valor: '', rotulo: 'Todas as situações' },
  { valor: 'VENCIDO', rotulo: 'Vencido' },
  { valor: 'PENDENTE', rotulo: 'Pendente' },
  { valor: 'PAGO', rotulo: 'Pago' },
  { valor: 'CANCELADO', rotulo: 'Cancelado' },
]

// Ordem padrão da lista: data da consulta (crescente) e, dentro do mesmo dia,
// vencimento (decrescente) — clicar num cabeçalho da tabela sobrepõe isso.
function compararPadrao(a: Lancamento, b: Lancamento): number {
  const dataA = a.consulta_data ?? ''
  const dataB = b.consulta_data ?? ''
  if (dataA !== dataB) return dataA < dataB ? -1 : 1
  const vencA = a.vencimento ?? ''
  const vencB = b.vencimento ?? ''
  if (vencA !== vencB) return vencA > vencB ? -1 : 1
  return 0
}

export function AbaFinanceiro({ pacienteId }: { pacienteId: number }) {
  const { data, isLoading } = useLancamentosDoPaciente(pacienteId)
  const quitar = useQuitarLancamento()
  const estornar = useEstornarLancamento()
  const [filtro, setFiltro] = useState<'' | Situacao>('')

  const lancamentos = (data ?? [])
    .filter((l) => !filtro || situacaoDe(l) === filtro)
    .sort(compararPadrao)

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
      accessorFn: (l) => l.vencimento ?? '',
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          aria-label="Filtrar por situação"
          className={cn(classeCampoSelect, 'w-full sm:w-56')}
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as '' | Situacao)}
        >
          {OPCOES_FILTRO.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
        <div
          role="group"
          aria-label="Legenda das cores por situação"
          className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground"
        >
          {LEGENDA_SITUACAO.map((s) => (
            <span key={s.situacao} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('size-2.5 rounded-full', s.cor)} />
              {s.rotulo}
            </span>
          ))}
        </div>
      </div>

      <DataTable
        columns={colunas}
        data={lancamentos}
        carregando={isLoading}
        vazio="Nenhum lançamento financeiro."
        linhaClassName={(l) => COR_LINHA[situacaoDe(l)]}
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
    </div>
  )
}
