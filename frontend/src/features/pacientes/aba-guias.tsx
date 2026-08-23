import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { Money } from '@/components/common/formato'
import { Button } from '@/components/ui/button'
import type { ErroApi } from '@/lib/api/client'

import { BadgeStatus } from './status'
import {
  type Guia,
  useAtualizarGuia,
  useGuiasDoPaciente,
  useRemoverGuia,
} from './use-paciente-detalhe'

// Transições válidas do ciclo de vida (espelha `Guia.TRANSICOES` no backend).
const TRANSICOES: Record<string, { status: string; rotulo: string }[]> = {
  EMITIDA: [
    { status: 'AUTORIZADA', rotulo: 'Autorizar' },
    { status: 'GLOSADA', rotulo: 'Glosar' },
  ],
  AUTORIZADA: [
    { status: 'EXECUTADA', rotulo: 'Executar' },
    { status: 'GLOSADA', rotulo: 'Glosar' },
  ],
  EXECUTADA: [
    { status: 'PAGA', rotulo: 'Marcar paga' },
    { status: 'GLOSADA', rotulo: 'Glosar' },
  ],
  PAGA: [],
  GLOSADA: [],
}

export function AbaGuias({ pacienteId }: { pacienteId: number }) {
  const { data, isLoading } = useGuiasDoPaciente(pacienteId)
  const atualizar = useAtualizarGuia(pacienteId)
  const remover = useRemoverGuia(pacienteId)
  const navigate = useNavigate()

  async function transicionar(guia: Guia, status: string, rotulo: string) {
    try {
      await atualizar.mutateAsync({ id: guia.id, dados: { status } })
      toast.success(`Guia ${rotulo.toLowerCase()}.`)
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível mudar o status.')
    }
  }

  async function excluir(guia: Guia) {
    try {
      await remover.mutateAsync(guia.id)
      toast.success('Guia excluída.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível excluir a guia.')
    }
  }

  // Ações da guia (transições de status + excluir). Compartilhadas entre a coluna
  // (desktop) e o card do mobile.
  const acoesGuia = (guia: Guia) => (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {(TRANSICOES[guia.status ?? ''] ?? []).map((t) => (
        <Button
          key={t.status}
          variant="outline"
          size="sm"
          onClick={() => transicionar(guia, t.status, t.rotulo)}
        >
          {t.rotulo}
        </Button>
      ))}
      <ConfirmDialog
        titulo="Excluir guia?"
        descricao={`Remove a guia ${guia.numero_guia}. Esta ação não pode ser desfeita.`}
        rotuloConfirmar="Excluir"
        destrutivo
        onConfirmar={() => excluir(guia)}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            title="Excluir guia"
            aria-label={`Excluir guia ${guia.numero_guia}`}
          >
            <Trash2 className="text-destructive" />
          </Button>
        }
      />
    </div>
  )

  const colunas: ColumnDef<Guia, unknown>[] = [
    {
      accessorKey: 'numero_guia',
      header: 'Número',
      cell: ({ row }) => (
        <Link
          to={`/pacientes/${pacienteId}/guias/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.numero_guia}
        </Link>
      ),
    },
    {
      id: 'procedimento',
      header: 'Procedimento',
      accessorFn: (g) => g.consulta_procedimento ?? g.procedimento ?? '',
      cell: ({ row }) => row.original.consulta_procedimento || row.original.procedimento || '—',
    },
    { id: 'valor', header: 'Valor', cell: ({ row }) => <Money valor={row.original.valor ?? 0} /> },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <BadgeStatus status={row.original.status} />,
    },
    {
      id: 'acoes',
      header: '',
      cell: ({ row }) => acoesGuia(row.original),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => navigate(`/pacientes/${pacienteId}/guias/nova`)}
        >
          <Plus /> Adicionar guia
        </Button>
      </div>

      <DataTable
        columns={colunas}
        data={data ?? []}
        carregando={isLoading}
        vazio="Nenhuma guia emitida."
        cardMobile={(g) => (
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to={`/pacientes/${pacienteId}/guias/${g.id}`}
                  className="font-semibold text-primary break-words hover:underline"
                >
                  {g.numero_guia}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground break-words">
                  {g.consulta_procedimento || g.procedimento || '—'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">{acoesGuia(g)}</div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <BadgeStatus status={g.status} />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Valor:</span>
              <Money valor={g.valor ?? 0} />
            </div>
          </div>
        )}
      />
    </div>
  )
}
