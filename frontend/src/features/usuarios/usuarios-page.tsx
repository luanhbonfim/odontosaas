import type { ColumnDef } from '@tanstack/react-table'
import { Plus, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'

import { DataTable } from '@/components/common/data-table'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { AcoesUsuario } from './acoes-usuario'
import { UsuarioFormDrawer } from './usuario-form-drawer'
import { type Usuario, useUsuarios } from './use-usuarios'

const colunas: ColumnDef<Usuario, unknown>[] = [
  { accessorKey: 'nome_completo', header: 'Nome' },
  { accessorKey: 'email', header: 'E-mail (login)' },
  {
    id: 'dentista',
    header: 'Dentista vinculado',
    cell: ({ row }) =>
      row.original.dentista_nome ? (
        <span>{row.original.dentista_nome}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  { accessorKey: 'papel_display', header: 'Perfil' },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) =>
      row.original.ativo ? (
        <StatusBadge variante="sucesso">Ativo</StatusBadge>
      ) : (
        <StatusBadge variante="erro">Bloqueado</StatusBadge>
      ),
  },
  {
    id: 'acoes',
    header: '',
    cell: ({ row }) => <AcoesUsuario usuario={row.original} />,
  },
]

export function UsuariosPage() {
  const { data, isLoading, isError } = useUsuarios()
  const [busca, setBusca] = useState('')

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return data ?? []
    return (data ?? []).filter(
      (u) =>
        (u.nome_completo ?? '').toLowerCase().includes(termo) ||
        u.email.toLowerCase().includes(termo),
    )
  }, [data, busca])

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Equipe"
        descricao="Usuários da clínica e seus perfis."
        acoes={
          <UsuarioFormDrawer
            trigger={
              <Button>
                <Plus /> Novo usuário
              </Button>
            }
          />
        }
      />

      {isError ? (
        <EmptyState
          icone={UsersRound}
          titulo="Não foi possível carregar a equipe"
          descricao="Tente novamente em instantes."
        />
      ) : (
        <>
          <Input
            placeholder="Buscar por nome ou e-mail…"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            className="max-w-xs"
          />
          <DataTable
            columns={colunas}
            data={filtrados}
            carregando={isLoading}
            vazio="Nenhum usuário cadastrado."
          />
        </>
      )}
    </div>
  )
}
