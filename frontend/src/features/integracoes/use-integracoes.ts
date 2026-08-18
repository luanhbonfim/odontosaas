import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type ConexaoGoogle = components['schemas']['ConexaoGoogle']

export type ResumoSync = {
  criados: number
  atualizados: number
  removidos: number
  canceladas: number
}
export type ConfigSync = {
  intervalo_minutos: number
  ultima_sincronizacao: string | null
  proxima_sincronizacao: string | null
}

const CHAVE = ['integracoes', 'google', 'conexoes'] as const
const CHAVE_SYNC = ['integracoes', 'google', 'sincronizacao'] as const

/** Status das conexões Google (clínica + cada dentista). */
export function useConexoesGoogle() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async () => (await api.get<ConexaoGoogle[]>('/integracoes/google/conexoes/')).data,
  })
}

/** Força a reconciliação com o Google agora (retorna o resumo do que mudou). */
export function useSincronizarGoogle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      (await api.post<ResumoSync>('/integracoes/google/sincronizar/', {})).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE })
      qc.invalidateQueries({ queryKey: CHAVE_SYNC })
    },
  })
}

/** Informativo + config da sincronização periódica (última/próxima, intervalo).
 * Refaz a cada 15s para a "última/próxima" acompanharem as rodadas do servidor. */
export function useConfigSync() {
  return useQuery({
    queryKey: CHAVE_SYNC,
    queryFn: async () => (await api.get<ConfigSync>('/integracoes/google/sincronizacao/')).data,
    refetchInterval: 15_000,
  })
}

/** Salva a config de sincronização (intervalo em min, prazo de confirmação em h). */
export function useAtualizarConfigSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: { intervalo_minutos?: number }) =>
      (await api.patch<ConfigSync>('/integracoes/google/sincronizacao/', dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_SYNC }),
  })
}

/** Remove a credencial de um alvo (dentista = id, ou null para a clínica). */
export function useDesconectarGoogle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dentista: number | null) =>
      (await api.post('/integracoes/google/desconectar/', { dentista })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  })
}

/**
 * URL do fluxo OAuth (redirect de navegador, fora do /api). Um clique leva à
 * tela de consentimento do Google; a credencial é salva no callback.
 */
export function urlAutorizarGoogle(dentista: number | null): string {
  const base = '/integracoes/google/authorize'
  return dentista ? `${base}?dentista=${dentista}` : base
}
