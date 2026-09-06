import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { vendorApi } from '../vendor-api-client'
import {
  useAtualizarAviso,
  useCriarAviso,
  useDeletarAviso,
  useVendorAvisos,
} from './use-vendor-avisos'

vi.mock('../vendor-api-client', () => ({
  vendorApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

function criarWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return { client, Wrapper }
}

describe('hooks de avisos (vendor admin)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('useVendorAvisos busca a lista', async () => {
    vi.mocked(vendorApi.get).mockResolvedValue({ data: [{ id: 1, titulo: 'Novidade' }] })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useVendorAvisos(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(vendorApi.get).toHaveBeenCalledWith('/plataforma-admin/avisos/')
  })

  it('useCriarAviso posta e invalida', async () => {
    vi.mocked(vendorApi.post).mockResolvedValue({ data: { id: 2 } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCriarAviso(), { wrapper: Wrapper })
    await result.current.mutateAsync({ titulo: 'Novo módulo' })
    expect(vendorApi.post).toHaveBeenCalledWith('/plataforma-admin/avisos/', { titulo: 'Novo módulo' })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['vendor-avisos'] })
  })

  it('useAtualizarAviso faz PATCH e invalida', async () => {
    vi.mocked(vendorApi.patch).mockResolvedValue({ data: { id: 1 } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useAtualizarAviso(), { wrapper: Wrapper })
    await result.current.mutateAsync({ id: 1, dados: { titulo: 'Editado' } })
    expect(vendorApi.patch).toHaveBeenCalledWith('/plataforma-admin/avisos/1/', { titulo: 'Editado' })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['vendor-avisos'] })
  })

  it('useDeletarAviso deleta e invalida', async () => {
    vi.mocked(vendorApi.delete).mockResolvedValue({ data: {} })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useDeletarAviso(), { wrapper: Wrapper })
    await result.current.mutateAsync(1)
    expect(vendorApi.delete).toHaveBeenCalledWith('/plataforma-admin/avisos/1/')
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['vendor-avisos'] })
  })
})
