import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api/client'

import {
  useAnamnesesDoPaciente,
  useConsultasDoPaciente,
  useGuiasDoPaciente,
  usePaciente,
  usePlanosDoPaciente,
} from './use-paciente-detalhe'

vi.mock('@/lib/api/client', () => ({ api: { get: vi.fn() } }))

function criarWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return { Wrapper }
}

describe('hooks da ficha do paciente', () => {
  beforeEach(() => vi.clearAllMocks())

  it('usePaciente busca o detalhe por id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { id: 5 } })
    const { Wrapper } = criarWrapper()
    renderHook(() => usePaciente(5), { wrapper: Wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/pacientes/5/'))
  })

  it.each([
    ['planos', usePlanosDoPaciente],
    ['guias', useGuiasDoPaciente],
    ['consultas', useConsultasDoPaciente],
    ['anamneses', useAnamnesesDoPaciente],
  ])('%s filtra por ?paciente', async (recurso, hook) => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    const { Wrapper } = criarWrapper()
    renderHook(() => hook(5), { wrapper: Wrapper })
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(`/${recurso}/`, { params: { paciente: 5 } }),
    )
  })
})
