import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type Procedimento = components['schemas']['Procedimento']
export type ProcedimentoEntrada = { nome: string; valor?: string; ativo?: boolean }

const CHAVE = ['procedimentos'] as const

/** Lista o catálogo de procedimentos da clínica (também usado no agendamento). */
export function useProcedimentos() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async () => (await api.get<Procedimento[]>('/procedimentos/')).data,
    staleTime: 5 * 60_000,
  })
}

export function useCriarProcedimento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: ProcedimentoEntrada) =>
      (await api.post<Procedimento>('/procedimentos/', dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  })
}

export function useAtualizarProcedimento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<ProcedimentoEntrada> }) =>
      (await api.patch<Procedimento>(`/procedimentos/${id}/`, dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  })
}

export function useRemoverProcedimento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/procedimentos/${id}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  })
}
