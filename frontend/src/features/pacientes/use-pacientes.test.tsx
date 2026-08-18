import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'

import { useAtualizarPaciente, useCriarPaciente, usePacientes } from './use-pacientes'

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

describe('hooks de pacientes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('usePacientes busca a página com page + search', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { count: 1, results: [{ id: 1, nome_completo: 'João', cpf: '11122233344' }] },
    })
    const { Wrapper } = criarWrapper()
    const { result } = renderHook(() => usePacientes({ pagina: 2, busca: 'jo' }), {
      wrapper: Wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/pacientes/', {
      params: { page: 2, page_size: 10, search: 'jo' },
    })
    expect(result.current.data?.results).toHaveLength(1)
  })

  it('omite o search quando vazio', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { count: 0, results: [] } })
    const { Wrapper } = criarWrapper()
    renderHook(() => usePacientes({ pagina: 1, busca: '' }), { wrapper: Wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(api.get).toHaveBeenCalledWith('/pacientes/', {
      params: { page: 1, page_size: 10, search: undefined },
    })
  })

  it('useCriarPaciente posta e invalida a listagem', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 9 } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCriarPaciente(), { wrapper: Wrapper })

    await result.current.mutateAsync({ nome_completo: 'João', cpf: '11122233344' })
    expect(api.post).toHaveBeenCalledWith('/pacientes/', {
      nome_completo: 'João',
      cpf: '11122233344',
    })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['pacientes'] })
  })

  it('useAtualizarPaciente faz patch e invalida listagem + ficha', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { id: 9 } })
    const { client, Wrapper } = criarWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useAtualizarPaciente(), { wrapper: Wrapper })

    await result.current.mutateAsync({ id: 9, dados: { ativo: false } })
    expect(api.patch).toHaveBeenCalledWith('/pacientes/9/', { ativo: false })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['pacientes'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['paciente', 9] })
  })
})
