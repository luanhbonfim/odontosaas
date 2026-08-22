import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { vendorApi } from '../vendor-api-client'

export interface ConfigLogin {
  access_token_min: number
  refresh_token_horas: number
  rotacionar_refresh: boolean
  login_max_tentativas: number
  login_bloqueio_min: number
  impersonate_validade_min: number
  impersonate_read_only_padrao: boolean
  exigir_2fa_todos: boolean
  throttle_vendor_login: string
  throttle_impersonate: string
  throttle_studio: string
  atualizado_em?: string
}

const CHAVE = ['vendor-config-login']

export function useConfigLogin() {
  return useQuery<ConfigLogin>({
    queryKey: CHAVE,
    queryFn: async () => (await vendorApi.get('/plataforma-admin/config-login/')).data,
  })
}

export function useSalvarConfigLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dados: Partial<ConfigLogin>) =>
      (await vendorApi.patch('/plataforma-admin/config-login/', dados)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE }),
  })
}
