import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type Usuario = components['schemas']['Usuario']
export type Papel = NonNullable<Usuario['papel']>

export type UsuarioEntrada = {
  email: string
  nome_completo: string
  papel: Papel
  ativo?: boolean
  senha?: string
  /** Dentista atrelado ao login (papéis de dentista). null desfaz o vínculo. */
  dentista?: number | null
}

/** Papéis para o seletor (rótulos amigáveis). */
export const PAPEIS: { valor: Papel; rotulo: string }[] = [
  { valor: 'ADMIN', rotulo: 'Administrador(a)' },
  { valor: 'DENTISTA_GERENTE', rotulo: 'Dentista Gerente' },
  { valor: 'DENTISTA', rotulo: 'Dentista' },
  { valor: 'RECEPCAO', rotulo: 'Recepção' },
]

// Hierarquia dos papéis (espelha o backend). Só se gerencia cargos abaixo do seu.
const RANK: Record<Papel, number> = { RECEPCAO: 0, DENTISTA: 1, DENTISTA_GERENTE: 2, ADMIN: 3 }

/** Um ator só gerencia cargos **estritamente abaixo** do seu; Admin gerencia todos. */
export function podeGerenciar(ator: Papel | null | undefined, alvo: Papel): boolean {
  if (ator === 'ADMIN') return true
  if (!ator) return false
  return RANK[alvo] < RANK[ator]
}

/** Papéis que o ator pode atribuir (para o seletor do formulário). */
export function papeisGerenciaveis(ator: Papel | null | undefined) {
  return PAPEIS.filter((papel) => podeGerenciar(ator, papel.valor))
}

/** Resumo (informativo) do que cada perfil pode acessar — espelha a matriz de permissões. */
export const ACESSO_PAPEL: Record<Papel, string> = {
  RECEPCAO:
    'Agenda, Pacientes, Estoque/Insumos e Notificações. Sem acesso a Financeiro, Auditoria ou Equipe.',
  DENTISTA:
    'Agenda e Pacientes (apenas os seus), além de consultar Dentistas e Estoque. Sem Financeiro, Notificações, Auditoria ou Equipe.',
  DENTISTA_GERENTE:
    'Visão geral da clínica: Agenda, Pacientes, Dentistas, Estoque, Financeiro, Notificações, Auditoria e Equipe. Não mexe em configurações da plataforma.',
  ADMIN: 'Acesso total à clínica, incluindo configurações e gestão da Equipe.',
}

const CHAVE = ['usuarios'] as const

/** Lista os usuários da equipe (Gerente/Admin). */
export function useUsuarios() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async () => (await api.get<Usuario[]>('/usuarios/')).data,
  })
}

/** Invalida usuários e dentistas (o vínculo login↔dentista muda os dois). */
function invalidarEquipe(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: CHAVE })
  qc.invalidateQueries({ queryKey: ['dentistas'] })
}

/** Cria um usuário e invalida a listagem. */
export function useCriarUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: UsuarioEntrada) =>
      (await api.post<Usuario>('/usuarios/', dados)).data,
    onSuccess: () => invalidarEquipe(qc),
  })
}

/** Atualiza (parcial) um usuário — inclui bloquear/reativar (`ativo`). */
export function useAtualizarUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<UsuarioEntrada> }) =>
      (await api.patch<Usuario>(`/usuarios/${id}/`, dados)).data,
    onSuccess: () => invalidarEquipe(qc),
  })
}
