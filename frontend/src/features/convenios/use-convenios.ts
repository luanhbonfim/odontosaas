import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type Convenio = components['schemas']['Convenio']
export type ConvenioEntrada = { nome: string; ativo?: boolean }

const CHAVE = ['convenios'] as const

/** Lista o catálogo de convênios da clínica (também usado no seletor do plano). */
export function useConvenios() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async () => (await api.get<Convenio[]>('/convenios/')).data,
    staleTime: 5 * 60_000,
  })
}

export function useCriarConvenio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: ConvenioEntrada) =>
      (await api.post<Convenio>('/convenios/', dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  })
}

export function useAtualizarConvenio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<ConvenioEntrada> }) =>
      (await api.patch<Convenio>(`/convenios/${id}/`, dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  })
}

export function useRemoverConvenio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/convenios/${id}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  })
}
