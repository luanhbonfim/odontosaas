import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { EmptyState } from '@/components/common/empty-state'
import { Cpf, PhoneText } from '@/components/common/formato'
import { StatusBadge } from '@/components/common/status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSessao } from '@/features/auth/use-sessao'
import { useDentistas } from '@/features/dentistas/use-dentistas'
import type { ErroApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/use-debounce'

import { type Paciente, TAMANHO_PAGINA, useExcluirPaciente, usePacientes } from './use-pacientes'

const traco = <span className="text-muted-foreground">—</span>

/** Ação de excluir paciente (lixeira). Compartilhada entre a coluna (desktop) e o
 *  card do mobile: sem registros -> lixeira vermelha com confirmação; com registros
 *  -> lixeira desabilitada + tooltip explicando o porquê. */
function AcaoExcluirPaciente({
  p,
  onExcluir,
}: {
  p: Paciente
  onExcluir: (p: Paciente) => void
}) {
  if (!p.pode_excluir) {
    const motivo =
      'Não é possível excluir: este paciente já tem registros (consultas, planos ou anamneses).'
    return (
      <div className="group relative">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Excluir ${p.nome_completo} (indisponível)`}
          className="cursor-not-allowed"
          onClick={() => toast.info(motivo)}
        >
          <Trash2 className="text-muted-foreground" />
        </Button>
        {/* Tooltip estilizado (CSS puro): aparece à esquerda no hover. */}
        <span
          role="tooltip"
          className="pointer-events-none absolute top-1/2 right-full z-30 mr-2 w-56 -translate-y-1/2 rounded-lg border bg-popover px-3 py-2 text-xs leading-snug text-popover-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
        >
          {motivo}
        </span>
      </div>
    )
  }
  return (
    <ConfirmDialog
      titulo="Excluir paciente?"
      descricao={`Remove ${p.nome_completo}. Esta ação não pode ser desfeita.`}
      rotuloConfirmar="Excluir"
      destrutivo
      onConfirmar={() => onExcluir(p)}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          title="Excluir paciente"
          aria-label={`Excluir ${p.nome_completo}`}
        >
          <Trash2 className="text-destructive" />
        </Button>
      }
    />
  )
}

// `id` das colunas ordenáveis = campo aceito pelo backend em `?ordering=`.
const COLUNAS_BASE: ColumnDef<Paciente, unknown>[] = [
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
  const { usuario } = useSessao()
  const excluir = useExcluirPaciente()
  // Dentista não exclui paciente (só gestão/recepção/admin). Backend também barra.
  const podeExcluir = usuario ? usuario.papel !== 'DENTISTA' : false

  async function excluirPaciente(p: Paciente) {
    try {
      await excluir.mutateAsync(p.id)
      toast.success('Paciente excluído.')
    } catch (erro) {
      toast.error((erro as ErroApi).mensagem ?? 'Não foi possível excluir.')
    }
  }

  // Lixeira no fim da linha (só para quem pode excluir). O backend só permite se
  // o paciente não tiver nenhum registro (consultas, planos ou anamneses).
  const colunas = useMemo<ColumnDef<Paciente, unknown>[]>(() => {
    if (!podeExcluir) return COLUNAS_BASE
    return [
      ...COLUNAS_BASE,
      {
        id: 'acoes',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <AcaoExcluirPaciente p={row.original} onExcluir={excluirPaciente} />
          </div>
        ),
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeExcluir])

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
          {/* Mobile: filtros empilhados em 100% de largura (acompanham o botão). sm+: em linha. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              placeholder="Buscar por nome ou CPF…"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              className="w-full sm:w-72"
              aria-label="Buscar pacientes"
            />
            <select
              className={cn(classeSelect, 'w-full sm:w-48')}
              value={ativo}
              onChange={(e) => setAtivo(e.target.value)}
              aria-label="Filtrar por status"
            >
              <option value="">Todos os status</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
            <select
              className={cn(classeSelect, 'w-full sm:w-48')}
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
            cardMobile={(p) => {
              const partes = [
                p.cpf ? <Cpf valor={p.cpf} /> : null,
                p.telefone_whatsapp ? <PhoneText valor={p.telefone_whatsapp} /> : null,
                p.dentista_responsavel_nome || null,
              ].filter(Boolean)
              return (
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/pacientes/${p.id}`}
                        className="font-semibold text-primary break-words hover:underline"
                      >
                        {p.nome_completo}
                      </Link>
                      {partes.length > 0 && (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                          {partes.map((parte, i) => (
                            <span key={i} className="inline-flex items-center gap-1.5">
                              {i > 0 && <span aria-hidden="true">·</span>}
                              {parte}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                    {podeExcluir && (
                      <div className="flex shrink-0 items-center gap-1">
                        <AcaoExcluirPaciente p={p} onExcluir={excluirPaciente} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.ativo ? (
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
