import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'

import { useAuditoria } from './use-auditoria'

vi.mock('@/lib/api/client', () => ({ api: { get: vi.fn() } }))

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('useAuditoria', () => {
  it('envia paginação e só os filtros preenchidos', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { count: 0, results: [] } })
    const { result } = renderHook(
      () =>
        useAuditoria({ pagina: 2, busca: '', modelo: 'Guia', acao: '', usuario: '', de: '2026-10-01', ate: '' }),
      { wrapper: wrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/auditoria/', {
      params: {
        page: 2,
        page_size: 20,
        search: undefined,
        modelo: 'Guia',
        acao: undefined,
        usuario: undefined,
        de: '2026-10-01',
        ate: undefined,
      },
    })
  })
})
