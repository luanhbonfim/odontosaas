import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'

import { usePermissoesModulo, useSalvarPermissoesModulo } from './use-permissoes'

vi.mock('@/lib/api/client', () => ({ api: { get: vi.fn(), put: vi.fn() } }))

function criarWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return { client, Wrapper }
}

const CELULA = { papel: 'RECEPCAO' as const, modulo: 'agenda', ver: true, criar: true, editar: true, excluir: true }

describe('hooks de permissões de módulo', () => {
  it('usePermissoesModulo busca a grade', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [CELULA] })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => usePermissoesModulo(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/permissoes-modulo/')
    expect(result.current.data).toEqual([CELULA])
  })

  it('useSalvarPermissoesModulo salva e atualiza o cache + invalida a sessão', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: [CELULA] })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useSalvarPermissoesModulo(), { wrapper: Wrapper })
    await result.current.mutateAsync([CELULA])
    expect(api.put).toHaveBeenCalledWith('/permissoes-modulo/', [CELULA])
    expect(client.getQueryData(['permissoes-modulo'])).toEqual([CELULA])
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['sessao'] })
  })
})
