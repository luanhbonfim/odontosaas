import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type LancamentoFinanceiro = components['schemas']['LancamentoFinanceiro']

/** Baixa manual: marca o lançamento como Pago (data atual). */
export function useQuitarLancamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<LancamentoFinanceiro>(`/lancamentos/${id}/quitar/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lancamentos'] }),
  })
}

/** Desfaz a quitação: volta o lançamento para Pendente. */
export function useEstornarLancamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<LancamentoFinanceiro>(`/lancamentos/${id}/estornar/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lancamentos'] }),
  })
}
