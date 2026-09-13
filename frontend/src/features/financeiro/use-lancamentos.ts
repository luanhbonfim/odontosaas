import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type LancamentoFinanceiro = components['schemas']['LancamentoFinanceiro']

// A action `fluxo-caixa` não tem `@extend_schema` (drf-spectacular cai pro
// serializer_class padrão do ViewSet nos docs) — tipo à mão, mesmo padrão já
// usado nos hooks do Vendor Admin pra actions sem documentação real.
export type FluxoCaixa = {
  a_receber: string
  a_pagar: string
  saldo_previsto: string
  recebido: string
  pago: string
  saldo_realizado: string
}

export type LancamentoEntrada = {
  tipo: 'RECEITA' | 'DESPESA'
  descricao: string
  valor: string
  vencimento?: string | null
  forma_pagamento?: string
  fornecedor?: number | null
}

const CHAVE_LANCAMENTOS = ['lancamentos'] as const

/** Lista lançamentos, opcionalmente filtrados por tipo e/ou status (server-side). */
export function useLancamentos(filtros?: {
  tipo?: 'RECEITA' | 'DESPESA'
  status?: 'PENDENTE' | 'PAGO' | 'CANCELADO'
}) {
  return useQuery({
    queryKey: [...CHAVE_LANCAMENTOS, filtros?.tipo, filtros?.status] as const,
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (filtros?.tipo) params.tipo = filtros.tipo
      if (filtros?.status) params.status = filtros.status
      const resp = await api.get<LancamentoFinanceiro[]>(
        '/lancamentos/',
        Object.keys(params).length ? { params } : undefined,
      )
      return resp.data
    },
  })
}

export function useCriarLancamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: LancamentoEntrada) =>
      (await api.post<LancamentoFinanceiro>('/lancamentos/', dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_LANCAMENTOS }),
  })
}

export function useAtualizarLancamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<LancamentoEntrada> }) =>
      (await api.patch<LancamentoFinanceiro>(`/lancamentos/${id}/`, dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_LANCAMENTOS }),
  })
}

export function useRemoverLancamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/lancamentos/${id}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_LANCAMENTOS }),
  })
}

/** Baixa manual: marca o lançamento como Pago (data atual). */
export function useQuitarLancamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<LancamentoFinanceiro>(`/lancamentos/${id}/quitar/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_LANCAMENTOS }),
  })
}

/** Desfaz a quitação: volta o lançamento para Pendente. */
export function useEstornarLancamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<LancamentoFinanceiro>(`/lancamentos/${id}/estornar/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_LANCAMENTOS }),
  })
}

/** Totais consolidados (a receber/a pagar/saldo previsto/recebido/pago/saldo realizado). */
export function useFluxoCaixa() {
  return useQuery({
    queryKey: [...CHAVE_LANCAMENTOS, 'fluxo-caixa'] as const,
    queryFn: async () => (await api.get<FluxoCaixa>('/lancamentos/fluxo-caixa/')).data,
  })
}
