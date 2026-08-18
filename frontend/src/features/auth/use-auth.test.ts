import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'
import { queryClient } from '@/lib/api/query-client'
import { tokenStore } from '@/lib/api/token-store'

import { useAuth } from './use-auth'

const { navegar } = vi.hoisted(() => ({ navegar: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => navegar }))
vi.mock('@/lib/api/client', () => ({ api: { post: vi.fn() } }))

describe('useAuth', () => {
  beforeEach(() => {
    navegar.mockClear()
    tokenStore.limpar()
  })

  it('entrar guarda os tokens e navega para a home', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { access: 'a1', refresh: 'r1' } })

    const { result } = renderHook(() => useAuth())
    await result.current.entrar({ email: 'x@y.com', senha: 'segredo' })

    expect(api.post).toHaveBeenCalledWith('/auth/token/', {
      email: 'x@y.com',
      password: 'segredo',
    })
    expect(tokenStore.access).toBe('a1')
    expect(tokenStore.refresh).toBe('r1')
    expect(navegar).toHaveBeenCalledWith('/')
  })

  it('sair limpa tokens, zera o cache do Query e volta ao login', () => {
    tokenStore.definir({ access: 'a', refresh: 'r' })
    const limparCache = vi.spyOn(queryClient, 'clear')

    const { result } = renderHook(() => useAuth())
    result.current.sair()

    expect(tokenStore.access).toBeNull()
    expect(tokenStore.refresh).toBeNull()
    expect(limparCache).toHaveBeenCalled()
    expect(navegar).toHaveBeenCalledWith('/login', { replace: true })
  })
})
