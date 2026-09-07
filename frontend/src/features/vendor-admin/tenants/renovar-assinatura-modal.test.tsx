import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RenovarAssinaturaModal } from './renovar-assinatura-modal'

const { renovarMock } = vi.hoisted(() => ({ renovarMock: vi.fn() }))
vi.mock('./use-vendor-tenants', () => ({
  useRenovarTenant: () => ({ mutateAsync: renovarMock, isPending: false }),
}))

describe('RenovarAssinaturaModal', () => {
  afterEach(() => vi.clearAllMocks())

  it('confirma a renovação sem preencher nada (todos os campos são opcionais)', async () => {
    renovarMock.mockResolvedValue({})
    const aoFechar = vi.fn()
    const user = userEvent.setup()
    render(<RenovarAssinaturaModal aberto aoFechar={aoFechar} tenantId={7} />)

    await user.click(screen.getByRole('button', { name: /confirmar renovação/i }))

    await waitFor(() =>
      expect(renovarMock).toHaveBeenCalledWith({
        id: 7,
        dados: { valor: undefined, forma_pagamento: undefined, observacao: undefined },
      }),
    )
    expect(aoFechar).toHaveBeenCalled()
  })

  it('envia valor, forma de pagamento e observação quando preenchidos', async () => {
    renovarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<RenovarAssinaturaModal aberto aoFechar={vi.fn()} tenantId={7} />)

    await user.type(screen.getByLabelText(/valor recebido/i), '299.90')
    await user.selectOptions(screen.getByLabelText(/forma de pagamento/i), 'PIX')
    await user.type(screen.getByLabelText(/observação/i), 'Pago via link.')
    await user.click(screen.getByRole('button', { name: /confirmar renovação/i }))

    await waitFor(() =>
      expect(renovarMock).toHaveBeenCalledWith({
        id: 7,
        dados: { valor: '299.90', forma_pagamento: 'PIX', observacao: 'Pago via link.' },
      }),
    )
  })

  it('mostra erro e não fecha o modal quando a renovação falha', async () => {
    renovarMock.mockRejectedValue(new Error('falhou'))
    const aoFechar = vi.fn()
    const user = userEvent.setup()
    render(<RenovarAssinaturaModal aberto aoFechar={aoFechar} tenantId={7} />)

    await user.click(screen.getByRole('button', { name: /confirmar renovação/i }))

    await waitFor(() => expect(renovarMock).toHaveBeenCalled())
    expect(aoFechar).not.toHaveBeenCalled()
  })

  it('não renderiza nada quando fechado', () => {
    render(<RenovarAssinaturaModal aberto={false} aoFechar={vi.fn()} tenantId={7} />)
    expect(screen.queryByRole('button', { name: /confirmar renovação/i })).toBeNull()
  })
})
