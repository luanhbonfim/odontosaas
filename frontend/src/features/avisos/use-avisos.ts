import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api/client'

export type Aviso = {
  id: number
  titulo: string
  descricao: string
  imagem_url: string
  icone: string
  link_url: string
  link_rotulo: string
}

/** Avisos/novidades vigentes, pro carrossel exibido logo após o login. */
export function useAvisosAtivos() {
  return useQuery({
    queryKey: ['avisos-ativos'],
    queryFn: async () => (await api.get<Aviso[]>('/avisos-ativos/')).data,
    staleTime: 5 * 60_000,
  })
}
