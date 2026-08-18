import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/common/data-table'
import { EmptyState } from '@/components/common/empty-state'
import { Cpf, PhoneText } from '@/components/common/formato'
import { StatusBadge } from '@/components/common/status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDentistas } from '@/features/dentistas/use-dentistas'
import { useDebounce } from '@/lib/hooks/use-debounce'

import { type Paciente, TAMANHO_PAGINA, usePacientes } from './use-pacientes'

const traco = <span className="text-muted-foreground">—</span>

// `id` das colunas ordenáveis = campo aceito pelo backend em `?ordering=`.
const colunas: ColumnDef<Paciente, unknown>[] = [
  {
    accessorKey: 'nome_completo',
    header: 'Nome',
    cell: ({ row }) => (
      <Link
        to={`/pacientes/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.nome_completo}
      </Link>
    ),
  },
  {
    accessorKey: 'cpf',
    header: 'CPF',
    cell: ({ row }) => (row.original.cpf ? <Cpf valor={row.original.cpf} /> : traco),
  },
  {
    id: 'telefone',
    header: 'Telefone',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.telefone_whatsapp ? <PhoneText valor={row.original.telefone_whatsapp} /> : traco,
  },
  {
    id: 'dentista_responsavel__nome_completo',
    accessorFn: (p) => p.dentista_responsavel_nome,
    header: 'Dentista responsável',
    cell: ({ row }) => row.original.dentista_responsavel_nome || traco,
  },
  {
    id: 'ativo',
    accessorFn: (p) => p.ativo,
    header: 'Status',
    cell: ({ row }) =>
      row.original.ativo ? (
        <StatusBadge variante="sucesso">Ativo</StatusBadge>
      ) : (
        <StatusBadge variante="neutro">Inativo</StatusBadge>
      ),
  },
]

const classeSelect =
  'h-9 cursor-pointer rounded-md border bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'

export function PacientesPage() {
  const [pagina, setPagina] = useState(1)
  const [busca, setBusca] = useState('')
  const [ordenacao, setOrdenacao] = useState('nome_completo')
  const [ativo, setAtivo] = useState('')
  const [dentistaResponsavel, setDentistaResponsavel] = useState('')
  const buscaDebounced = useDebounce(busca.trim(), 300)

  const { data: dentistas } = useDentistas()

  // Qualquer mudança de busca/filtro/ordenação reinicia na primeira página.
  useEffect(() => setPagina(1), [buscaDebounced, ordenacao, ativo, dentistaResponsavel])

  const { data, isLoading, isError } = usePacientes({
    pagina,
    busca: buscaDebounced,
    ordenacao,
    ativo,
    dentistaResponsavel,
  })
  const pacientes = data?.results ?? []
  const totalPaginas = Math.max(1, Math.ceil((data?.count ?? 0) / TAMANHO_PAGINA))

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Pacientes"
        descricao="Pacientes da clínica."
        acoes={
          <Button asChild>
            <Link to="/pacientes/novo">
              <Plus /> Novo paciente
            </Link>
          </Button>
        }
      />

      {isError ? (
        <EmptyState
          icone={Users}
          titulo="Não foi possível carregar os pacientes"
          descricao="Tente novamente em instantes."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Buscar por nome ou CPF…"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              className="max-w-xs"
              aria-label="Buscar pacientes"
            />
            <select
              className={classeSelect}
              value={ativo}
              onChange={(e) => setAtivo(e.target.value)}
              aria-label="Filtrar por status"
            >
              <option value="">Todos os status</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
            <select
              className={classeSelect}
              value={dentistaResponsavel}
              onChange={(e) => setDentistaResponsavel(e.target.value)}
              aria-label="Filtrar por dentista responsável"
            >
              <option value="">Todos os dentistas</option>
              <option value="nenhum">Sem responsável</option>
              {(dentistas ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome_completo}
                </option>
              ))}
            </select>
          </div>
          <DataTable
            columns={colunas}
            data={pacientes}
            carregando={isLoading}
            vazio="Nenhum paciente encontrado."
            paginacaoManual={{ pagina, totalPaginas, aoMudarPagina: setPagina }}
            ordenacaoManual={{ valor: ordenacao, aoMudar: setOrdenacao }}
          />
        </>
      )}
    </div>
  )
}
