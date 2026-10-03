import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type Busca = components['schemas']['Busca']
export type PacienteBusca = components['schemas']['PacienteBusca']
export type ConsultaBusca = components['schemas']['ConsultaBusca']

/** Mínimo de caracteres para consultar (espelha `MIN_CARACTERES` do backend). */
export const MIN_CARACTERES_BUSCA = 2

/** Busca global por paciente (nome/CPF) e consulta (paciente/procedimento).
 * Bloco `null` = usuário sem permissão para o módulo (a UI não o mostra). */
export function useBusca(termo: string) {
  const limpo = termo.trim()
  return useQuery({
    queryKey: ['busca', limpo],
    queryFn: async () => (await api.get<Busca>('/busca/', { params: { q: limpo } })).data,
    enabled: limpo.length >= MIN_CARACTERES_BUSCA,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}
