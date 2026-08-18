import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api/client'

/**
 * Nome da clínica (tenant) do subdomínio atual — PÚBLICO (usado na tela de login,
 * antes de autenticar). Resolvido pelo backend a partir do host.
 */
export function useClinicaAtual() {
  return useQuery({
    queryKey: ['tenant-atual'],
    queryFn: async () =>
      (await api.get<{ nome_fantasia: string }>('/tenant-atual/')).data.nome_fantasia,
    staleTime: Infinity,
    retry: false,
  })
}
