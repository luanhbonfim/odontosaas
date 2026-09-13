import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'

import {
  useAtualizarLancamento,
  useCriarLancamento,
  useEstornarLancamento,
  useFluxoCaixa,
  useLancamentos,
  useQuitarLancamento,
  useRemoverLancamento,
} from './use-lancamentos'

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

describe('hooks de lançamentos financeiros', () => {
  it('useQuitarLancamento posta em /quitar/ e invalida', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 1, status: 'PAGO' } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useQuitarLancamento(), { wrapper: Wrapper })
    await result.current.mutateAsync(1)
    expect(api.post).toHaveBeenCalledWith('/lancamentos/1/quitar/')
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['lancamentos'] }))
  })

  it('useEstornarLancamento posta em /estornar/ e invalida', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 1, status: 'PENDENTE' } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useEstornarLancamento(), { wrapper: Wrapper })
    await result.current.mutateAsync(1)
    expect(api.post).toHaveBeenCalledWith('/lancamentos/1/estornar/')
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['lancamentos'] }))
  })

  it('useLancamentos sem filtro busca sem params', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useLancamentos(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/lancamentos/', undefined)
  })

  it('useLancamentos com tipo busca com params.tipo', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useLancamentos({ tipo: 'RECEITA' }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/lancamentos/', { params: { tipo: 'RECEITA' } })
  })

  it('useLancamentos com tipo e status combina os params', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(
      () => useLancamentos({ tipo: 'DESPESA', status: 'PAGO' }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/lancamentos/', {
      params: { tipo: 'DESPESA', status: 'PAGO' },
    })
  })

  it('useCriarLancamento posta em /lancamentos/ e invalida', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 9 } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCriarLancamento(), { wrapper: Wrapper })
    await result.current.mutateAsync({ tipo: 'RECEITA', descricao: 'Venda avulsa', valor: '50' })
    expect(api.post).toHaveBeenCalledWith('/lancamentos/', {
      tipo: 'RECEITA',
      descricao: 'Venda avulsa',
      valor: '50',
    })
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['lancamentos'] }))
  })

  it('useAtualizarLancamento faz PATCH em /lancamentos/{id}/ e invalida', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { id: 9, valor: '80' } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useAtualizarLancamento(), { wrapper: Wrapper })
    await result.current.mutateAsync({ id: 9, dados: { valor: '80' } })
    expect(api.patch).toHaveBeenCalledWith('/lancamentos/9/', { valor: '80' })
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['lancamentos'] }))
  })

  it('useRemoverLancamento faz DELETE em /lancamentos/{id}/ e invalida', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useRemoverLancamento(), { wrapper: Wrapper })
    await result.current.mutateAsync(9)
    expect(api.delete).toHaveBeenCalledWith('/lancamentos/9/')
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['lancamentos'] }))
  })

  it('useFluxoCaixa busca /lancamentos/fluxo-caixa/', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        a_receber: '100.00',
        a_pagar: '50.00',
        saldo_previsto: '50.00',
        recebido: '30.00',
        pago: '10.00',
        saldo_realizado: '20.00',
      },
    })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useFluxoCaixa(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/lancamentos/fluxo-caixa/')
    expect(result.current.data?.a_receber).toBe('100.00')
  })
})
