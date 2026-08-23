import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Stethoscope } from 'lucide-react'
import { useMemo, useState } from 'react'

import { DataTable } from '@/components/common/data-table'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSessao } from '@/features/auth/use-sessao'

import { AcoesDentista } from './acoes-dentista'
import { DentistaFormDrawer } from './dentista-form-drawer'
import { type Dentista, useDentistas } from './use-dentistas'

function usarColunas(podeEscrever: boolean): ColumnDef<Dentista, unknown>[] {
  const base: ColumnDef<Dentista, unknown>[] = [
    { accessorKey: 'nome_completo', header: 'Nome' },
    { accessorKey: 'cro', header: 'CRO' },
    {
      id: 'especialidades',
      header: 'Especialidades',
      cell: ({ row }) => {
        const nomes = row.original.especialidades_nomes ?? []
        return nomes.length > 0 ? (
          <span className="text-sm">{nomes.join(', ')}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
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
  ]

  if (!podeEscrever) return base

  return [
    ...base,
    {
      id: 'acoes',
      header: '',
      cell: ({ row }) => <AcoesDentista dentista={row.original} />,
    },
  ]
}

export function DentistasPage() {
  const { data, isLoading, isError } = useDentistas()
  const { usuario } = useSessao()
  const [busca, setBusca] = useState('')

  const podeEscrever = usuario?.papel === 'DENTISTA_GERENTE' || usuario?.papel === 'ADMIN'
  const colunas = useMemo(() => usarColunas(podeEscrever), [podeEscrever])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return data ?? []
    return (data ?? []).filter(
      (d) => d.nome_completo.toLowerCase().includes(termo) || d.cro.toLowerCase().includes(termo),
    )
  }, [data, busca])

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Dentistas"
        descricao="Profissionais da clínica."
        acoes={
          podeEscrever ? (
            <DentistaFormDrawer
              trigger={
                <Button>
                  <Plus /> Novo dentista
                </Button>
              }
            />
          ) : undefined
        }
      />

      {isError ? (
        <EmptyState
          icone={Stethoscope}
          titulo="Não foi possível carregar os dentistas"
          descricao="Tente novamente em instantes."
        />
      ) : (
        <>
          <Input
            placeholder="Buscar por nome ou CRO…"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            className="w-full sm:max-w-xs"
          />
          <DataTable
            columns={colunas}
            data={filtrados}
            carregando={isLoading}
            vazio="Nenhum dentista cadastrado."
            cardMobile={(d) => {
              const especialidades = (d.especialidades_nomes ?? []).join(', ')
              const subinfo = [`CRO ${d.cro}`, especialidades].filter(Boolean).join(' · ')
              return (
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold break-words">{d.nome_completo}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground break-words">{subinfo}</p>
                    </div>
                    {podeEscrever && (
                      <div className="flex shrink-0 items-center gap-1">
                        <AcoesDentista dentista={d} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {d.ativo ? (
                      <StatusBadge variante="sucesso">Ativo</StatusBadge>
                    ) : (
                      <StatusBadge variante="neutro">Inativo</StatusBadge>
                    )}
                  </div>
                </div>
              )
            }}
          />
        </>
      )}
    </div>
  )
}
