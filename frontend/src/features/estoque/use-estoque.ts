import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type CategoriaInsumo = components['schemas']['CategoriaInsumo']
export type Insumo = components['schemas']['Insumo']
export type MovimentacaoEstoque = components['schemas']['MovimentacaoEstoque']
export type ConsumoInsumo = components['schemas']['ConsumoInsumo']

export type CategoriaInsumoEntrada = { nome: string; descricao?: string; ativo?: boolean }

const CHAVE_CATEGORIAS = ['categorias-insumo'] as const

export function useCategoriasInsumo() {
  return useQuery({
    queryKey: CHAVE_CATEGORIAS,
    queryFn: async () =>
      (await api.get<CategoriaInsumo[]>('/categorias-insumo/')).data,
    staleTime: 5 * 60_000,
  })
}

export function useCriarCategoriaInsumo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: CategoriaInsumoEntrada) =>
      (await api.post<CategoriaInsumo>('/categorias-insumo/', dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_CATEGORIAS }),
  })
}

export function useAtualizarCategoriaInsumo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<CategoriaInsumoEntrada> }) =>
      (await api.patch<CategoriaInsumo>(`/categorias-insumo/${id}/`, dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_CATEGORIAS }),
  })
}

export function useRemoverCategoriaInsumo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/categorias-insumo/${id}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_CATEGORIAS }),
  })
}

export type InsumoEntrada = {
  nome: string
  descricao?: string
  categoria?: number | null
  unidade: string
  estoque_minimo?: string
  ativo?: boolean
}

const CHAVE_INSUMOS = ['insumos'] as const

export function useInsumos() {
  return useQuery({
    queryKey: CHAVE_INSUMOS,
    queryFn: async () => (await api.get<Insumo[]>('/insumos/')).data,
  })
}

export function useInsumo(id: number) {
  return useQuery({
    queryKey: [...CHAVE_INSUMOS, id],
    queryFn: async () => (await api.get<Insumo>(`/insumos/${id}/`)).data,
    enabled: Number.isFinite(id) && id > 0,
  })
}

/** Insumos no ou abaixo do estoque mínimo (alerta de reposição). */
export function useInsumosAlertas() {
  return useQuery({
    queryKey: ['insumos', 'alertas'],
    queryFn: async () => (await api.get<Insumo[]>('/insumos/alertas/')).data,
  })
}

export function useCriarInsumo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: InsumoEntrada) => (await api.post<Insumo>('/insumos/', dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_INSUMOS }),
  })
}

export function useAtualizarInsumo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<InsumoEntrada> }) =>
      (await api.patch<Insumo>(`/insumos/${id}/`, dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_INSUMOS }),
  })
}

export function useRemoverInsumo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/insumos/${id}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_INSUMOS }),
  })
}

export type Subtipo = 'AJUSTE' | 'COMPRA'
export type FormaPagamento = 'PIX' | 'BOLETO' | 'CARTAO' | 'DINHEIRO' | 'TRANSFERENCIA'

export type MovimentacaoEntrada = {
  insumo: number
  tipo: 'ENTRADA' | 'SAIDA'
  subtipo?: Subtipo
  quantidade: string
  observacao?: string
  // Só quando subtipo=COMPRA — geram a conta a pagar (ver apps.estoque.services.gerar_conta_da_compra).
  fornecedor?: number
  valor?: string
  forma_pagamento?: FormaPagamento
  data_vencimento?: string
}

const CHAVE_MOVIMENTACOES = ['movimentacoes-estoque'] as const

/** Lista movimentações, opcionalmente filtradas por tipo e/ou insumo (extrato do insumo). */
export function useMovimentacoesEstoque(filtros?: { tipo?: 'ENTRADA' | 'SAIDA'; insumo?: number }) {
  return useQuery({
    queryKey: [...CHAVE_MOVIMENTACOES, filtros?.tipo, filtros?.insumo] as const,
    queryFn: async () => {
      const params: Record<string, string | number> = {}
      if (filtros?.tipo) params.tipo = filtros.tipo
      if (filtros?.insumo) params.insumo = filtros.insumo
      const resp = await api.get<MovimentacaoEstoque[]>(
        '/movimentacoes-estoque/',
        Object.keys(params).length ? { params } : undefined,
      )
      return resp.data
    },
  })
}

/** Registra uma movimentação manual e revalida a lista + o saldo do insumo. */
export function useCriarMovimentacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: MovimentacaoEntrada) =>
      (await api.post<MovimentacaoEstoque>('/movimentacoes-estoque/', dados)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_MOVIMENTACOES })
      qc.invalidateQueries({ queryKey: CHAVE_INSUMOS })
    },
  })
}

const chaveConsumos = (consultaId: number) => ['consumos-insumo', 'consulta', consultaId]

export function useConsumosDaConsulta(consultaId: number) {
  return useQuery({
    queryKey: chaveConsumos(consultaId),
    queryFn: async () =>
      (
        await api.get<ConsumoInsumo[]>('/consumos-insumo/', { params: { consulta: consultaId } })
      ).data,
    enabled: Number.isFinite(consultaId) && consultaId > 0,
  })
}

export type ConsumoEntrada = { consulta: number; insumo: number; quantidade: string }

/** Registra um insumo consumido na consulta e revalida a lista + o saldo do insumo. */
export function useCriarConsumo(consultaId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: ConsumoEntrada) =>
      (await api.post<ConsumoInsumo>('/consumos-insumo/', dados)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaveConsumos(consultaId) })
      qc.invalidateQueries({ queryKey: CHAVE_INSUMOS })
    },
  })
}

export function useRemoverConsumo(consultaId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/consumos-insumo/${id}/`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaveConsumos(consultaId) })
      qc.invalidateQueries({ queryKey: CHAVE_INSUMOS })
    },
  })
}
