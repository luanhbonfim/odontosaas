import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type Dentista = components['schemas']['Dentista']
export type Especialidade = components['schemas']['Especialidade']
/** Campos graváveis (sem os read-only) para criar/editar. */
export type DentistaEntrada = Partial<
  Omit<Dentista, 'id' | 'criado_em' | 'atualizado_em' | 'especialidades_nomes'>
>

const CHAVE = ['dentistas'] as const

/** Lista os dentistas da clínica. */
export function useDentistas() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async () => (await api.get<Dentista[]>('/dentistas/')).data,
  })
}

/** Lista as especialidades (para seleção no formulário). */
export function useEspecialidades() {
  return useQuery({
    queryKey: ['especialidades'],
    queryFn: async () => (await api.get<Especialidade[]>('/especialidades/')).data,
    staleTime: 5 * 60_000,
  })
}

/** Cria um dentista e invalida a listagem. */
export function useCriarDentista() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: DentistaEntrada) =>
      (await api.post<Dentista>('/dentistas/', dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  })
}

/** Atualiza (parcialmente) um dentista e invalida a listagem. */
export function useAtualizarDentista() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: DentistaEntrada }) =>
      (await api.patch<Dentista>(`/dentistas/${id}/`, dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  })
}

/** Remove um dentista e invalida a listagem. */
export function useRemoverDentista() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/dentistas/${id}/`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  })
}
