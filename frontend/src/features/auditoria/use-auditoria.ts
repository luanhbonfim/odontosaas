import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type RegistroAuditoria = components['schemas']['RegistroAuditoria']
export type PaginaAuditoria = components['schemas']['PaginatedRegistroAuditoriaList']

export const TAMANHO_PAGINA_AUDITORIA = 20

/** Modelos que entram na trilha (espelha `apps/auditoria/signals.py`). */
export const MODELOS_AUDITADOS: { valor: string; rotulo: string }[] = [
  { valor: 'Paciente', rotulo: 'Paciente' },
  { valor: 'Anamnese', rotulo: 'Anamnese' },
  { valor: 'Guia', rotulo: 'Guia de convênio' },
  { valor: 'LancamentoFinanceiro', rotulo: 'Lançamento financeiro' },
  { valor: 'Fatura', rotulo: 'Fatura' },
  { valor: 'Usuario', rotulo: 'Usuário (equipe)' },
]

export const ROTULO_MODELO: Record<string, string> = Object.fromEntries(
  MODELOS_AUDITADOS.map((m) => [m.valor, m.rotulo]),
)

export const ACOES_AUDITORIA: { valor: string; rotulo: string }[] = [
  { valor: 'CRIACAO', rotulo: 'Criação' },
  { valor: 'ALTERACAO', rotulo: 'Alteração' },
  { valor: 'EXCLUSAO', rotulo: 'Exclusão' },
]

export type FiltrosAuditoria = {
  pagina: number
  busca: string
  modelo: string
  acao: string
  /** id do usuário ('' = todos) */
  usuario: string
  /** AAAA-MM-DD ('' = sem limite) */
  de: string
  ate: string
}

/** Trilha de auditoria (LGPD) — lista **paginada**, somente leitura, com filtros no servidor. */
export function useAuditoria({ pagina, busca, modelo, acao, usuario, de, ate }: FiltrosAuditoria) {
  return useQuery({
    queryKey: ['auditoria', pagina, busca, modelo, acao, usuario, de, ate],
    queryFn: async () =>
      (
        await api.get<PaginaAuditoria>('/auditoria/', {
          params: {
            page: pagina,
            page_size: TAMANHO_PAGINA_AUDITORIA,
            search: busca || undefined,
            modelo: modelo || undefined,
            acao: acao || undefined,
            usuario: usuario || undefined,
            de: de || undefined,
            ate: ate || undefined,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  })
}
