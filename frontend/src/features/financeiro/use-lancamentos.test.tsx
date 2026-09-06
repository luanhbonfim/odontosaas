import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'

import { useEstornarLancamento, useQuitarLancamento } from './use-lancamentos'

vi.mock('@/lib/api/client', () => ({ api: { post: vi.fn() } }))

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
})
