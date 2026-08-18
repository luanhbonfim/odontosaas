import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

import type { Paciente } from './use-pacientes'

export type Plano = components['schemas']['PlanoOdontologico']
export type Guia = components['schemas']['Guia']
export type Consulta = components['schemas']['Consulta']
export type Anamnese = components['schemas']['Anamnese']

/** Campos graváveis de um plano (o paciente vem do contexto da ficha).
 * `convenio` (id do catálogo) alimenta a `operadora` no backend. */
export type PlanoEntrada = {
  convenio: number
  numero_carteirinha?: string
  validade?: string | null
  status?: string
}

const chavePlanos = (pacienteId: number) => ['planos', 'paciente', pacienteId]

/** Dados do paciente (aba "Dados"). */
export function usePaciente(id: number) {
  return useQuery({
    queryKey: ['paciente', id],
    queryFn: async () => (await api.get<Paciente>(`/pacientes/${id}/`)).data,
    enabled: Number.isFinite(id) && id > 0,
  })
}

export function usePlanosDoPaciente(id: number) {
  return useQuery({
    queryKey: chavePlanos(id),
    queryFn: async () => (await api.get<Plano[]>('/planos/', { params: { paciente: id } })).data,
    enabled: Number.isFinite(id),
  })
}

/** Cria um plano para o paciente e invalida a aba Planos. */
export function useCriarPlano(pacienteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: PlanoEntrada) =>
      (await api.post<Plano>('/planos/', { ...dados, paciente: pacienteId })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: chavePlanos(pacienteId) }),
  })
}

/** Atualiza (parcial) um plano. */
export function useAtualizarPlano(pacienteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<PlanoEntrada> }) =>
      (await api.patch<Plano>(`/planos/${id}/`, dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: chavePlanos(pacienteId) }),
  })
}

/** Exclui um plano (400 se houver guias vinculadas). */
export function useRemoverPlano(pacienteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/planos/${id}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: chavePlanos(pacienteId) }),
  })
}

const chaveGuias = (pacienteId: number) => ['guias', 'paciente', pacienteId]

export function useGuiasDoPaciente(id: number) {
  return useQuery({
    queryKey: chaveGuias(id),
    queryFn: async () => (await api.get<Guia[]>('/guias/', { params: { paciente: id } })).data,
    enabled: Number.isFinite(id),
  })
}

/** Campos graváveis de uma guia (o plano é do próprio paciente). */
export type GuiaEntrada = {
  plano: number
  numero_guia: string
  procedimento: string
  valor: string
  status?: string
  /** Procedimentos por dente (odontograma), notação FDI. */
  dentes?: { dente: number; procedimento: string }[]
}

/** Uma guia específica (para a página de edição). */
export function useGuia(id: number) {
  return useQuery({
    queryKey: ['guia', id],
    queryFn: async () => (await api.get<Guia>(`/guias/${id}/`)).data,
    enabled: Number.isFinite(id) && id > 0,
  })
}

export function useCriarGuia(pacienteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: GuiaEntrada) => (await api.post<Guia>('/guias/', dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveGuias(pacienteId) }),
  })
}

/** Atualiza uma guia — edição de dados e transições de status. */
export function useAtualizarGuia(pacienteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<GuiaEntrada> }) =>
      (await api.patch<Guia>(`/guias/${id}/`, dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveGuias(pacienteId) }),
  })
}

export function useRemoverGuia(pacienteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/guias/${id}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveGuias(pacienteId) }),
  })
}

export function useConsultasDoPaciente(id: number) {
  return useQuery({
    queryKey: ['consultas', 'paciente', id],
    queryFn: async () =>
      (await api.get<Consulta[]>('/consultas/', { params: { paciente: id } })).data,
    enabled: Number.isFinite(id),
  })
}

/** Uma consulta específica (para a página da ficha). */
export function useConsulta(id: number) {
  return useQuery({
    queryKey: ['consulta', id],
    queryFn: async () => (await api.get<Consulta>(`/consultas/${id}/`)).data,
    enabled: Number.isFinite(id) && id > 0,
  })
}

/** Ficha clínica gravável da consulta: dentes tratados (odontograma) + anotações. */
export type FichaConsulta = {
  dentes: { dente: number; procedimento: string }[]
  anotacoes: string
}

/** Salva a ficha da consulta (dentes + anotações) e revalida a lista/consulta. */
export function useSalvarFichaConsulta(pacienteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: FichaConsulta }) =>
      (await api.patch<Consulta>(`/consultas/${id}/`, dados)).data,
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['consultas', 'paciente', pacienteId] })
      qc.invalidateQueries({ queryKey: ['consulta', id] })
    },
  })
}

const chaveAnamneses = (pacienteId: number) => ['anamneses', 'paciente', pacienteId]

export function useAnamnesesDoPaciente(id: number) {
  return useQuery({
    queryKey: chaveAnamneses(id),
    queryFn: async () =>
      (await api.get<Anamnese[]>('/anamneses/', { params: { paciente: id } })).data,
    enabled: Number.isFinite(id),
  })
}

/** Campos graváveis de uma anamnese (o paciente vem do contexto da ficha). */
export type AnamneseEntrada = {
  paciente: number
  queixa_principal: string
  pressao_arterial?: string
  fumante: boolean
  diabetico: boolean
  gestante: boolean
}

/** Registra uma anamnese para o paciente e revalida a aba. */
export function useCriarAnamnese(pacienteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: AnamneseEntrada) =>
      (await api.post<Anamnese>('/anamneses/', dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveAnamneses(pacienteId) }),
  })
}
