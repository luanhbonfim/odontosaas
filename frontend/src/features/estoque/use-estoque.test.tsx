import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'

import {
  useCategoriasInsumo,
  useConsumosDaConsulta,
  useCriarCategoriaInsumo,
  useCriarConsumo,
  useCriarInsumo,
  useCriarMovimentacao,
  useInsumos,
  useInsumosAlertas,
  useMovimentacoesEstoque,
  useRemoverConsumo,
  useRemoverInsumo,
} from './use-estoque'

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

function criarWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return { client, Wrapper }
}

describe('hooks de estoque', () => {
  beforeEach(() => vi.clearAllMocks())

  it('useCategoriasInsumo busca a lista', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 1, nome: 'Descartáveis' }] })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useCategoriasInsumo(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/categorias-insumo/')
  })

  it('useCriarCategoriaInsumo posta e invalida', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 2 } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCriarCategoriaInsumo(), { wrapper: Wrapper })
    await result.current.mutateAsync({ nome: 'Anestésicos' })
    expect(api.post).toHaveBeenCalledWith('/categorias-insumo/', { nome: 'Anestésicos' })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['categorias-insumo'] })
  })

  it('useInsumos busca a lista', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 1, nome: 'Luva' }] })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useInsumos(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/insumos/')
  })

  it('useInsumosAlertas busca /insumos/alertas/', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useInsumosAlertas(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/insumos/alertas/')
  })

  it('useCriarInsumo posta e invalida a lista de insumos', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 3 } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCriarInsumo(), { wrapper: Wrapper })
    await result.current.mutateAsync({ nome: 'Gaze', unidade: 'PC' })
    expect(api.post).toHaveBeenCalledWith('/insumos/', { nome: 'Gaze', unidade: 'PC' })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['insumos'] })
  })

  it('useRemoverInsumo deleta e invalida', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useRemoverInsumo(), { wrapper: Wrapper })
    await result.current.mutateAsync(9)
    expect(api.delete).toHaveBeenCalledWith('/insumos/9/')
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['insumos'] })
  })

  it('useMovimentacoesEstoque busca a lista (sem filtro)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useMovimentacoesEstoque(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/movimentacoes-estoque/', undefined)
  })

  it('useMovimentacoesEstoque filtra por tipo (Lançamentos/Baixas)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useMovimentacoesEstoque('SAIDA'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/movimentacoes-estoque/', { params: { tipo: 'SAIDA' } })
  })

  it('useCriarMovimentacao posta e invalida movimentações e insumos', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 4 } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCriarMovimentacao(), { wrapper: Wrapper })
    await result.current.mutateAsync({ insumo: 1, tipo: 'ENTRADA', quantidade: '10' })
    expect(api.post).toHaveBeenCalledWith('/movimentacoes-estoque/', {
      insumo: 1,
      tipo: 'ENTRADA',
      quantidade: '10',
    })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['movimentacoes-estoque'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['insumos'] })
  })

  it('useConsumosDaConsulta busca filtrando por consulta', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useConsumosDaConsulta(7), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/consumos-insumo/', { params: { consulta: 7 } })
  })

  it('useCriarConsumo posta e invalida consumos da consulta + insumos', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 5 } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCriarConsumo(7), { wrapper: Wrapper })
    await result.current.mutateAsync({ consulta: 7, insumo: 1, quantidade: '2' })
    expect(api.post).toHaveBeenCalledWith('/consumos-insumo/', {
      consulta: 7,
      insumo: 1,
      quantidade: '2',
    })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['consumos-insumo', 'consulta', 7] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['insumos'] })
  })

  it('useRemoverConsumo deleta e invalida', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useRemoverConsumo(7), { wrapper: Wrapper })
    await result.current.mutateAsync(5)
    expect(api.delete).toHaveBeenCalledWith('/consumos-insumo/5/')
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['consumos-insumo', 'consulta', 7] })
  })
})
