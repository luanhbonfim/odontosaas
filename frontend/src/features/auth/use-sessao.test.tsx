import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'
import { tokenStore } from '@/lib/api/token-store'

import { useSessao } from './use-sessao'

vi.mock('@/lib/api/client', () => ({ api: { get: vi.fn() } }))

function criarWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('useSessao', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    tokenStore.definir({ access: 'a', refresh: 'r' })
  })
  afterEach(() => tokenStore.limpar())

  it('carrega e mapeia os dados do /me para camelCase', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        id: 1,
        email: 'dra@x.com',
        nome_completo: 'Dra. Ana',
        papel: 'DENTISTA',
        papel_display: 'Dentista',
        clinica: {
          schema: 'demo',
          nome_fantasia: 'Clínica Sorriso',
          modulos: {
            google_calendar: true,
            whatsapp: true,
            financeiro: true,
            estoque: true,
          },
        },
      },
    })

    const { result } = renderHook(() => useSessao(), { wrapper: criarWrapper() })
    await waitFor(() => expect(result.current.usuario).not.toBeNull())

    expect(api.get).toHaveBeenCalledWith('/auth/me/')
    expect(result.current.usuario).toEqual({
      id: 1,
      email: 'dra@x.com',
      nomeCompleto: 'Dra. Ana',
      papel: 'DENTISTA',
      papelExibicao: 'Dentista',
      clinica: {
        schema: 'demo',
        nomeFantasia: 'Clínica Sorriso',
        modulos: {
          google_calendar: true,
          whatsapp: true,
          financeiro: true,
          estoque: true,
        },
      },
    })
  })

  it('não busca a sessão quando não há usuário autenticado', () => {
    tokenStore.limpar()
    const { result } = renderHook(() => useSessao(), { wrapper: criarWrapper() })

    expect(api.get).not.toHaveBeenCalled()
    expect(result.current.usuario).toBeNull()
  })
})
