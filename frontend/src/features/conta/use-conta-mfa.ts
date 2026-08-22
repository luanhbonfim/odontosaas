import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'

export interface MfaStatus {
  email: string
  habilitado: boolean
}

export interface MfaInicio {
  secret: string
  otpauth_uri: string
  expira_em_seg: number
}

const CHAVE = ['conta-mfa-status']

export function useMfaStatus() {
  return useQuery<MfaStatus>({
    queryKey: CHAVE,
    queryFn: async () => (await api.get('/conta/mfa/')).data,
  })
}

export function useIniciarMfa() {
  return useMutation({
    mutationFn: async () => (await api.post('/conta/mfa/iniciar/')).data as MfaInicio,
  })
}

export function useConfirmarMfa() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (codigo: string) => (await api.post('/conta/mfa/confirmar/', { codigo })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE }),
  })
}

export function useDesativarMfa() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (codigo: string) => (await api.post('/conta/mfa/desativar/', { codigo })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE }),
  })
}
