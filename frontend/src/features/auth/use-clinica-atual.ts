import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export interface InfoTenantAtual {
  is_public: boolean
  schema: string
  nome_fantasia: string | null
}

/**
 * Informações do tenant/clínica do host atual — PÚBLICO (usado na tela de login,
 * antes de autenticar). Resolvido pelo backend a partir do host da requisição.
 */
export function useClinicaAtual() {
  return useQuery({
    queryKey: ['tenant-atual'],
    queryFn: async () =>
      (await api.get<InfoTenantAtual>('/tenant-atual/')).data,
    staleTime: Infinity,
    retry: false,
  })
}

