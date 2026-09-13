import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'

import { useFaturarOperadora, useFaturas } from './use-faturas'

vi.mock('@/lib/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))

function criarWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return { client, Wrapper }
}

describe('hooks de faturas', () => {
  it('useFaturas busca /faturas/', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 1, operadora: 'Amil' }] })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useFaturas(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/faturas/')
    expect(result.current.data).toEqual([{ id: 1, operadora: 'Amil' }])
  })

  it('useFaturarOperadora posta em /faturas/faturar/ e invalida faturas e lançamentos', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 2, operadora: 'Amil' } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useFaturarOperadora(), { wrapper: Wrapper })
    await result.current.mutateAsync({ operadora: 'Amil', competencia: '09/2026' })
    expect(api.post).toHaveBeenCalledWith('/faturas/faturar/', {
      operadora: 'Amil',
      competencia: '09/2026',
    })
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['faturas'] }))
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['lancamentos'] })
  })

  it('propaga a mensagem de erro do backend quando não há contas pendentes', async () => {
    vi.mocked(api.post).mockRejectedValue({
      mensagem: 'Nenhuma conta a receber pendente para essa operadora.',
    })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useFaturarOperadora(), { wrapper: Wrapper })
    await expect(result.current.mutateAsync({ operadora: 'Amil' })).rejects.toMatchObject({
      mensagem: 'Nenhuma conta a receber pendente para essa operadora.',
    })
  })
})
