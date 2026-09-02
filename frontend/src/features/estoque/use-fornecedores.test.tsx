import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'

import { useCriarFornecedor, useFornecedores, useRemoverFornecedor } from './use-fornecedores'

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

describe('hooks de fornecedores', () => {
  beforeEach(() => vi.clearAllMocks())

  it('useFornecedores busca a lista', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 1, nome: 'Dental Center' }] })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useFornecedores(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/fornecedores/')
  })

  it('useCriarFornecedor posta e invalida', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 2 } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCriarFornecedor(), { wrapper: Wrapper })
    await result.current.mutateAsync({ nome: 'Distribuidora Odonto' })
    expect(api.post).toHaveBeenCalledWith('/fornecedores/', { nome: 'Distribuidora Odonto' })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['fornecedores'] })
  })

  it('useRemoverFornecedor deleta e invalida', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useRemoverFornecedor(), { wrapper: Wrapper })
    await result.current.mutateAsync(7)
    expect(api.delete).toHaveBeenCalledWith('/fornecedores/7/')
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['fornecedores'] })
  })
})
