import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'

import { useBusca } from './use-busca'

vi.mock('@/lib/api/client', () => ({ api: { get: vi.fn() } }))

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('useBusca', () => {
  it('não consulta com menos de 2 caracteres', () => {
    const { result } = renderHook(() => useBusca(' a '), { wrapper: wrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(api.get).not.toHaveBeenCalled()
  })

  it('consulta /busca/ com o termo aparado e devolve os blocos', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { pacientes: [], consultas: null } })
    const { result } = renderHook(() => useBusca(' ana '), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/busca/', { params: { q: 'ana' } })
    expect(result.current.data).toEqual({ pacientes: [], consultas: null })
  })
})
