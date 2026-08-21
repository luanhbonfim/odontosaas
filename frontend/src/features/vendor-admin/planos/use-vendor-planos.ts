import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { vendorApi } from '../vendor-api-client'

export type PlanoAssinaturaVendor = {
  id: number
  nome: string
  periodicidade: 'MENSAL' | 'ANUAL' | 'PERMANENTE'
  preco_mensal: number
  preco_anual: number | null
  limite_dentistas: number
  limite_usuarios: number
  limite_pacientes_ativos: number
  limite_armazenamento_mb: number
  modulo_financeiro_ativo: boolean
  modulo_estoque_ativo: boolean
  sync_google_ativo: boolean
  whatsapp_waha_ativo: boolean
  ativo: boolean
  criado_em: string
  total_clinicas: number
}

export type PlanoInput = {
  nome: string
  periodicidade?: 'MENSAL' | 'ANUAL' | 'PERMANENTE'
  preco_mensal: number
  preco_anual?: number | null
  limite_dentistas?: number
  limite_usuarios?: number
  limite_pacientes_ativos?: number
  limite_armazenamento_mb?: number
  modulo_financeiro_ativo?: boolean
  modulo_estoque_ativo?: boolean
  sync_google_ativo?: boolean
  whatsapp_waha_ativo?: boolean
  ativo?: boolean
}

const CHAVE_PLANOS = ['vendor-planos']

export function useVendorPlanos(busca?: string) {
  return useQuery<PlanoAssinaturaVendor[]>({
    queryKey: [...CHAVE_PLANOS, { busca }],
    queryFn: async () => {
      const params = busca ? { search: busca } : {}
      const { data } = await vendorApi.get('/plataforma-admin/planos/', { params })
      return data
    },
  })
}

export function useCriarPlano() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dados: PlanoInput) => {
      const { data } = await vendorApi.post('/plataforma-admin/planos/', dados)
      return data as PlanoAssinaturaVendor
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVE_PLANOS })
    },
  })
}

export function useAtualizarPlano() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<PlanoInput> }) => {
      const { data } = await vendorApi.patch(`/plataforma-admin/planos/${id}/`, dados)
      return data as PlanoAssinaturaVendor
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVE_PLANOS })
    },
  })
}

export function useDeletarPlano() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await vendorApi.delete(`/plataforma-admin/planos/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVE_PLANOS })
    },
  })
}
