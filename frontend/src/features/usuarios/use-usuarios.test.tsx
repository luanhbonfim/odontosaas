import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'

import { useAtualizarUsuario, useCriarUsuario, useUsuarios } from './use-usuarios'

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

function criarWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return { client, Wrapper }
}

describe('hooks de usuarios', () => {
  beforeEach(() => vi.clearAllMocks())

  it('useUsuarios busca a lista', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 1, email: 'a@b.com' }] })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => useUsuarios(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/usuarios/')
    expect(result.current.data).toHaveLength(1)
  })

  it('useCriarUsuario posta e invalida a listagem', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 2 } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCriarUsuario(), { wrapper: Wrapper })
    await result.current.mutateAsync({
      email: 'x@y.com',
      nome_completo: 'X',
      papel: 'RECEPCAO',
      senha: 'Senha12345',
    })
    expect(api.post).toHaveBeenCalledWith(
      '/usuarios/',
      expect.objectContaining({ email: 'x@y.com', papel: 'RECEPCAO' }),
    )
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['usuarios'] })
  })

  it('useAtualizarUsuario faz patch (bloquear) e invalida', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { id: 3, ativo: false } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useAtualizarUsuario(), { wrapper: Wrapper })
    await result.current.mutateAsync({ id: 3, dados: { ativo: false } })
    expect(api.patch).toHaveBeenCalledWith('/usuarios/3/', { ativo: false })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['usuarios'] })
  })
})
