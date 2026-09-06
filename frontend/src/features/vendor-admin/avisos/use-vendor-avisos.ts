import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { vendorApi } from '../vendor-api-client'

export type AvisoVendor = {
  id: number
  titulo: string
  descricao: string
  imagem_url: string
  icone: string
  link_url: string
  link_rotulo: string
  publicado_em: string
  dias_visibilidade: number
  ordem: number
  ativo: boolean
  criado_em: string
  vigente_ate: string
}

export type AvisoInput = {
  titulo: string
  descricao?: string
  imagem_url?: string
  icone?: string
  link_url?: string
  link_rotulo?: string
  publicado_em?: string
  dias_visibilidade?: number
  ordem?: number
  ativo?: boolean
}

const CHAVE_AVISOS = ['vendor-avisos']

export function useVendorAvisos() {
  return useQuery<AvisoVendor[]>({
    queryKey: CHAVE_AVISOS,
    queryFn: async () => {
      const { data } = await vendorApi.get('/plataforma-admin/avisos/')
      return data
    },
  })
}

export function useCriarAviso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dados: AvisoInput) => {
      const { data } = await vendorApi.post('/plataforma-admin/avisos/', dados)
      return data as AvisoVendor
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVE_AVISOS })
    },
  })
}

export function useAtualizarAviso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<AvisoInput> }) => {
      const { data } = await vendorApi.patch(`/plataforma-admin/avisos/${id}/`, dados)
      return data as AvisoVendor
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVE_AVISOS })
    },
  })
}

export function useDeletarAviso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await vendorApi.delete(`/plataforma-admin/avisos/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVE_AVISOS })
    },
  })
}
