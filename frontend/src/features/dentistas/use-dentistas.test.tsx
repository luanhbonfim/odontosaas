import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'

import { useCriarDentista, useDentistas, useRemoverDentista } from './use-dentistas'

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

describe('hooks de dentistas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('useDentistas busca a lista', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [{ id: 1, nome_completo: 'Dra. Ana', cro: '123' }],
    })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useDentistas(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/dentistas/')
    expect(result.current.data).toHaveLength(1)
  })

  it('useCriarDentista posta e invalida a listagem', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 2 } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCriarDentista(), { wrapper: Wrapper })

    await result.current.mutateAsync({ nome_completo: 'X', cro: '9' })
    expect(api.post).toHaveBeenCalledWith('/dentistas/', { nome_completo: 'X', cro: '9' })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['dentistas'] })
  })

  it('useRemoverDentista deleta e invalida a listagem', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useRemoverDentista(), { wrapper: Wrapper })

    await result.current.mutateAsync(7)
    expect(api.delete).toHaveBeenCalledWith('/dentistas/7/')
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['dentistas'] })
  })
})
