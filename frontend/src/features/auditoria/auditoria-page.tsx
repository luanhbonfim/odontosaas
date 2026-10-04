import type { ColumnDef } from '@tanstack/react-table'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import { DataTable } from '@/components/common/data-table'
import { EmptyState } from '@/components/common/empty-state'
import { DateTime } from '@/components/common/formato'
import { StatusBadge, type VarianteStatus } from '@/components/common/status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { Input } from '@/components/ui/input'
import { useSessao } from '@/features/auth/use-sessao'
import { useUsuarios } from '@/features/usuarios/use-usuarios'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { cn } from '@/lib/utils'

import {
  ACOES_AUDITORIA,
  MODELOS_AUDITADOS,
  ROTULO_MODELO,
  type RegistroAuditoria,
  TAMANHO_PAGINA_AUDITORIA,
  useAuditoria,
} from './use-auditoria'

const VARIANTE_ACAO: Record<string, VarianteStatus> = {
  CRIACAO: 'sucesso',
  ALTERACAO: 'info',
  EXCLUSAO: 'erro',
}

const traco = <span className="text-muted-foreground">—</span>
const SISTEMA = <span className="text-muted-foreground">Sistema</span>

const COLUNAS: ColumnDef<RegistroAuditoria, unknown>[] = [
  {
    id: 'criado_em',
    header: 'Data e hora',
    enableSorting: false,
    cell: ({ row }) => <DateTime iso={row.original.criado_em} />,
  },
  {
    id: 'acao',
    header: 'Ação',
    enableSorting: false,
    cell: ({ row }) => (
      <StatusBadge variante={VARIANTE_ACAO[row.original.acao] ?? 'neutro'}>
        {row.original.acao_rotulo}
      </StatusBadge>
    ),
  },
  {
    id: 'registro',
    header: 'Registro',
    enableSorting: false,
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-medium">{ROTULO_MODELO[row.original.modelo] ?? row.original.modelo}</p>
        <p className="truncate text-xs text-muted-foreground">
          {row.original.objeto_repr || traco} · #{row.original.objeto_id}
        </p>
      </div>
    ),
  },
  {
    id: 'usuario',
    header: 'Realizado por',
    enableSorting: false,
    cell: ({ row }) => row.original.usuario_nome || SISTEMA,
  },
]

const classeSelect =
  'h-9 cursor-pointer rounded-md border bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'

/** Trilha de auditoria (LGPD) — somente leitura, para Gerente e Admin. */
export function AuditoriaPage() {
  const { usuario: sessao } = useSessao()
  const autorizado = sessao?.papel === 'ADMIN' || sessao?.papel === 'DENTISTA_GERENTE'

  const [pagina, setPagina] = useState(1)
  const [busca, setBusca] = useState('')
  const [modelo, setModelo] = useState('')
  const [acao, setAcao] = useState('')
  const [usuario, setUsuario] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const buscaDebounced = useDebounce(busca.trim(), 300)

  const { data: usuarios } = useUsuarios()
  const { data, isLoading, isError } = useAuditoria({
    pagina,
    busca: buscaDebounced,
    modelo,
    acao,
    usuario,
    de,
    ate,
  })

  // Qualquer mudança de filtro reinicia na primeira página.
  useEffect(() => setPagina(1), [buscaDebounced, modelo, acao, usuario, de, ate])

  if (!autorizado) {
    return (
      <EmptyState
        icone={ShieldAlert}
        titulo="Acesso restrito"
        descricao="A trilha de auditoria é visível apenas para Gerente e Administrador."
      />
    )
  }

  const registros = data?.results ?? []
  const totalPaginas = Math.max(1, Math.ceil((data?.count ?? 0) / TAMANHO_PAGINA_AUDITORIA))

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Auditoria"
        descricao="Trilha LGPD: quem criou, alterou ou excluiu dados sensíveis. Somente leitura."
      />

      {isError ? (
        <EmptyState
          icone={ShieldAlert}
          titulo="Não foi possível carregar a trilha"
          descricao="Tente novamente em instantes."
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              placeholder="Buscar registro ou usuário…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full sm:w-64"
              aria-label="Buscar na auditoria"
            />
            <select
              className={cn(classeSelect, 'w-full sm:w-48')}
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              aria-label="Filtrar por tipo de registro"
            >
              <option value="">Todos os registros</option>
              {MODELOS_AUDITADOS.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </select>
            <select
              className={cn(classeSelect, 'w-full sm:w-40')}
              value={acao}
              onChange={(e) => setAcao(e.target.value)}
              aria-label="Filtrar por ação"
            >
              <option value="">Todas as ações</option>
              {ACOES_AUDITORIA.map((a) => (
                <option key={a.valor} value={a.valor}>
                  {a.rotulo}
                </option>
              ))}
            </select>
            <select
              className={cn(classeSelect, 'w-full sm:w-52')}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              aria-label="Filtrar por usuário"
            >
              <option value="">Todos os usuários</option>
              {(usuarios ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome_completo || u.email}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <label htmlFor="auditoria-de">De</label>
              <Input
                id="auditoria-de"
                type="date"
                value={de}
                max={ate || undefined}
                onChange={(e) => setDe(e.target.value)}
                className="w-40"
                aria-label="Data inicial"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <label htmlFor="auditoria-ate">Até</label>
              <Input
                id="auditoria-ate"
                type="date"
                value={ate}
                min={de || undefined}
                onChange={(e) => setAte(e.target.value)}
                className="w-40"
                aria-label="Data final"
              />
            </div>
          </div>

          <DataTable
            columns={COLUNAS}
            data={registros}
            carregando={isLoading}
            vazio={
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4" /> Nenhum registro encontrado.
              </span>
            }
            paginacaoManual={{ pagina, totalPaginas, aoMudarPagina: setPagina }}
            cardMobile={(r) => (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge variante={VARIANTE_ACAO[r.acao] ?? 'neutro'}>
                    {r.acao_rotulo}
                  </StatusBadge>
                  <span className="text-xs text-muted-foreground">
                    <DateTime iso={r.criado_em} />
                  </span>
                </div>
                <p className="font-medium break-words">
                  {ROTULO_MODELO[r.modelo] ?? r.modelo}
                  <span className="font-normal text-muted-foreground">
                    {' '}
                    — {r.objeto_repr || `#${r.objeto_id}`}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Por {r.usuario_nome || 'Sistema'}
                </p>
              </div>
            )}
          />
        </>
      )}
    </div>
  )
}
