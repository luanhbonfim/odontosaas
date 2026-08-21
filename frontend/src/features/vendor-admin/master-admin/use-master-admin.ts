import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorApi } from '../vendor-api-client'

export type MasterAdminInfo = {
  email: string
  total_tenants: number
  tenants_sincronizados: number
}

export type AtualizarMasterAdminInput = {
  email?: string
  nova_senha: string
}

export type AtualizarMasterAdminResponse = {
  mensagem: string
  email: string
  tenants_sincronizados: number
  total_tenants: number
}

const CHAVE_MASTER_ADMIN = ['vendor-master-admin-info']

export function useMasterAdminInfo() {
  return useQuery<MasterAdminInfo>({
    queryKey: CHAVE_MASTER_ADMIN,
    queryFn: async () => {
      const { data } = await vendorApi.get('/plataforma-admin/master-admin/')
      return data
    },
  })
}

export function useAtualizarMasterAdmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dados: AtualizarMasterAdminInput): Promise<AtualizarMasterAdminResponse> => {
      const { data } = await vendorApi.post('/plataforma-admin/master-admin/', dados)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVE_MASTER_ADMIN })
    },
  })
}
