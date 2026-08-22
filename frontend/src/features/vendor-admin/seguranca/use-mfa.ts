import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { vendorApi } from '../vendor-api-client'

export interface MfaStatus {
  email: string
  habilitado: boolean
}

export interface MfaInicio {
  secret: string
  otpauth_uri: string
  expira_em_seg: number
}

export interface OperadorMfa {
  email: string
  criado_em: string
  atualizado_em: string
  eu: boolean
}

const CHAVE_STATUS = ['vendor-mfa-status']
const CHAVE_OPERADORES = ['vendor-mfa-operadores']

export function useMfaStatus() {
  return useQuery<MfaStatus>({
    queryKey: CHAVE_STATUS,
    queryFn: async () => (await vendorApi.get('/plataforma-admin/mfa/')).data,
  })
}

export function useIniciarMfa() {
  return useMutation({
    mutationFn: async () => (await vendorApi.post('/plataforma-admin/mfa/iniciar/')).data as MfaInicio,
  })
}

export function useConfirmarMfa() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (codigo: string) =>
      (await vendorApi.post('/plataforma-admin/mfa/confirmar/', { codigo })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE_STATUS }),
  })
}

export function useDesativarMfa() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (codigo: string) =>
      (await vendorApi.post('/plataforma-admin/mfa/desativar/', { codigo })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE_STATUS }),
  })
}

export function useOperadoresMfa() {
  return useQuery<OperadorMfa[]>({
    queryKey: CHAVE_OPERADORES,
    queryFn: async () => (await vendorApi.get('/plataforma-admin/mfa/operadores/')).data,
  })
}

export function useResetarMfa() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (email: string) =>
      (await vendorApi.post('/plataforma-admin/mfa/resetar/', { email })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVE_OPERADORES })
      queryClient.invalidateQueries({ queryKey: CHAVE_STATUS })
    },
  })
}
