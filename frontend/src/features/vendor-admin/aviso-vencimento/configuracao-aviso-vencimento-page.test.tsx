import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConfiguracaoAvisoVencimentoPage } from './configuracao-aviso-vencimento-page'

const { configMock, salvarMock } = vi.hoisted(() => ({
  configMock: vi.fn(),
  salvarMock: vi.fn(),
}))
vi.mock('./use-config-aviso-vencimento', () => ({
  useConfigAvisoVencimento: configMock,
  useSalvarConfigAvisoVencimento: () => ({ mutateAsync: salvarMock, isPending: false }),
}))

describe('ConfiguracaoAvisoVencimentoPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('carrega e mostra o valor configurado', () => {
    configMock.mockReturnValue({ data: { dias_antecedencia: 15 }, isLoading: false })
    render(<ConfiguracaoAvisoVencimentoPage />)
    expect(screen.getByLabelText(/dias de antecedência/i)).toHaveValue(15)
  })

  it('salva o novo valor', async () => {
    configMock.mockReturnValue({ data: { dias_antecedencia: 15 }, isLoading: false })
    salvarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<ConfiguracaoAvisoVencimentoPage />)

    const campo = screen.getByLabelText(/dias de antecedência/i)
    await user.clear(campo)
    await user.type(campo, '20')
    await user.click(screen.getByRole('button', { name: /salvar configuração/i }))

    await waitFor(() =>
      expect(salvarMock).toHaveBeenCalledWith(expect.objectContaining({ dias_antecedencia: 20 })),
    )
  })

  it('mostra "Carregando…" enquanto a configuração não chega', () => {
    configMock.mockReturnValue({ data: undefined, isLoading: true })
    render(<ConfiguracaoAvisoVencimentoPage />)
    expect(screen.getByText(/carregando configuração/i)).toBeInTheDocument()
  })
})
