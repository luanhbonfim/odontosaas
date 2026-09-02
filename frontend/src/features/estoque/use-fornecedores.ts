import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type Fornecedor = components['schemas']['Fornecedor']
export type FornecedorEntrada = { nome: string; ativo?: boolean }

const CHAVE = ['fornecedores'] as const

/** Catálogo de fornecedores da clínica (usado nas compras de insumo). */
export function useFornecedores() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async () => (await api.get<Fornecedor[]>('/fornecedores/')).data,
    staleTime: 5 * 60_000,
  })
}

export function useCriarFornecedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: FornecedorEntrada) =>
      (await api.post<Fornecedor>('/fornecedores/', dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  })
}

export function useAtualizarFornecedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<FornecedorEntrada> }) =>
      (await api.patch<Fornecedor>(`/fornecedores/${id}/`, dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  })
}

export function useRemoverFornecedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/fornecedores/${id}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  })
}
