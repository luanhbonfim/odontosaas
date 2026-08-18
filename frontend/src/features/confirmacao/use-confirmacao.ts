import { useMutation, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api/client'

export type ConfirmacaoInfo = {
  paciente_nome: string
  dentista_nome: string
  inicio: string
  status_confirmacao: string
  status: string
}

/** Dados públicos da consulta a partir do token do link (sem login). */
export function useConfirmacaoInfo(token: string) {
  return useQuery({
    queryKey: ['confirmacao', token],
    queryFn: async () => (await api.get<ConfirmacaoInfo>(`/confirmacao/${token}/`)).data,
    retry: false,
  })
}

/** Confirma ou recusa a consulta pelo link. */
export function useResponderConfirmacao(token: string) {
  return useMutation({
    mutationFn: async (acao: 'confirmar' | 'recusar') =>
      (await api.post<{ status_confirmacao: string }>(`/confirmacao/${token}/`, { acao })).data,
  })
}
