import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { vendorApi } from '../vendor-api-client'

export interface ConfigAvisoVencimento {
  dias_antecedencia: number
  atualizado_em?: string
}

const CHAVE = ['vendor-config-aviso-vencimento']

export function useConfigAvisoVencimento() {
  return useQuery<ConfigAvisoVencimento>({
    queryKey: CHAVE,
    queryFn: async () => (await vendorApi.get('/plataforma-admin/config-aviso-vencimento/')).data,
  })
}

export function useSalvarConfigAvisoVencimento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dados: Partial<ConfigAvisoVencimento>) =>
      (await vendorApi.patch('/plataforma-admin/config-aviso-vencimento/', dados)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE }),
  })
}
