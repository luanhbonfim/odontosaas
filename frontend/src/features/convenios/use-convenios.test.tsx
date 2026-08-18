import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'

import { useConvenios, useCriarConvenio, useRemoverConvenio } from './use-convenios'

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

describe('hooks de convênios', () => {
  beforeEach(() => vi.clearAllMocks())

  it('useConvenios busca a lista', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 1, nome: 'Amil' }] })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useConvenios(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/convenios/')
  })

  it('useCriarConvenio posta e invalida', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 2 } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCriarConvenio(), { wrapper: Wrapper })
    await result.current.mutateAsync({ nome: 'Bradesco' })
    expect(api.post).toHaveBeenCalledWith('/convenios/', { nome: 'Bradesco' })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['convenios'] })
  })

  it('useRemoverConvenio deleta e invalida', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useRemoverConvenio(), { wrapper: Wrapper })
    await result.current.mutateAsync(7)
    expect(api.delete).toHaveBeenCalledWith('/convenios/7/')
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['convenios'] })
  })
})
