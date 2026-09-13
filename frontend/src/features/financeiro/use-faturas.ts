import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type Fatura = components['schemas']['Fatura']

const CHAVE_FATURAS = ['faturas'] as const
const CHAVE_LANCAMENTOS = ['lancamentos'] as const

export function useFaturas() {
  return useQuery({
    queryKey: CHAVE_FATURAS,
    queryFn: async () => (await api.get<Fatura[]>('/faturas/')).data,
  })
}

/** Agrupa as contas a receber pendentes (de guias) daquela operadora numa fatura nova. */
export function useFaturarOperadora() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: { operadora: string; competencia?: string }) =>
      (await api.post<Fatura>('/faturas/faturar/', dados)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_FATURAS })
      // Faturar seta `fatura` nos lançamentos RECEITA envolvidos.
      qc.invalidateQueries({ queryKey: CHAVE_LANCAMENTOS })
    },
  })
}
