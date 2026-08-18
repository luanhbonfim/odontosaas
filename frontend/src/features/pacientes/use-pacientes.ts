import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type Paciente = components['schemas']['Paciente']
export type PaginaPacientes = components['schemas']['PaginatedPacienteList']

/** Campos graváveis do paciente (criação/edição). */
export type PacienteEntrada = {
  nome_completo: string
  cpf: string
  data_nascimento?: string | null
  telefone_whatsapp?: string
  email?: string
  endereco?: string
  dentista_responsavel?: number | null
  dentistas_compartilhados?: number[]
  ativo?: boolean
}

/** Tamanho de página: 10 pacientes por página (depois, paginação). */
export const TAMANHO_PAGINA = 10

export type FiltrosPacientes = {
  pagina: number
  busca: string
  /** Campo de `?ordering=` (ex.: 'nome_completo' ou '-nome_completo'); '' = padrão. */
  ordenacao: string
  /** '' (todos) | 'true' | 'false' */
  ativo: string
  /** '' (todos) | 'nenhum' (sem responsável) | id do dentista */
  dentistaResponsavel: string
}

/** Lista **paginada** de pacientes com busca, ordenação e filtros no servidor.
 * `placeholderData` mantém a página anterior visível durante a troca. */
export function usePacientes({
  pagina,
  busca,
  ordenacao,
  ativo,
  dentistaResponsavel,
}: FiltrosPacientes) {
  return useQuery({
    queryKey: ['pacientes', pagina, busca, ordenacao, ativo, dentistaResponsavel],
    queryFn: async () => {
      const { data } = await api.get<PaginaPacientes>('/pacientes/', {
        params: {
          page: pagina,
          page_size: TAMANHO_PAGINA,
          search: busca || undefined,
          ordering: ordenacao || undefined,
          ativo: ativo || undefined,
          dentista_responsavel: dentistaResponsavel || undefined,
        },
      })
      return data
    },
    placeholderData: keepPreviousData,
  })
}

/** Cria um paciente e invalida a listagem. */
export function useCriarPaciente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: PacienteEntrada) =>
      (await api.post<Paciente>('/pacientes/', dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pacientes'] }),
  })
}

/** Exclui um paciente (só permitido se não tiver registros). Invalida a listagem. */
export function useExcluirPaciente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/pacientes/${id}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pacientes'] }),
  })
}

/** Atualiza (parcial) um paciente — invalida listagem e a ficha. */
export function useAtualizarPaciente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<PacienteEntrada> }) =>
      (await api.patch<Paciente>(`/pacientes/${id}/`, dados)).data,
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['pacientes'] })
      qc.invalidateQueries({ queryKey: ['paciente', id] })
    },
  })
}
