import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AlertasPage } from './alertas-page'

const { alertasMock } = vi.hoisted(() => ({ alertasMock: vi.fn() }))

vi.mock('./use-estoque', () => ({ useInsumosAlertas: alertasMock }))

describe('AlertasPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista só insumos abaixo do mínimo', () => {
    alertasMock.mockReturnValue({
      data: [
        {
          id: 2,
          nome: 'Resina A2',
          categoria_nome: 'Restauradores',
          saldo: '2.00',
          estoque_minimo: '8.00',
          estoque_baixo: true,
        },
      ],
      isLoading: false,
    })
    render(<AlertasPage />)
    expect(screen.getByRole('heading', { name: 'Alertas' })).toBeInTheDocument()
    const tabela = screen.getByRole('table')
    expect(within(tabela).getByText('Resina A2')).toBeInTheDocument()
    expect(within(tabela).getByText('Estoque baixo')).toBeInTheDocument()
  })

  it('vazio: mostra aviso de nenhum alerta', () => {
    alertasMock.mockReturnValue({ data: [], isLoading: false })
    render(<AlertasPage />)
    expect(screen.getByText(/nenhum insumo abaixo do estoque mínimo/i)).toBeInTheDocument()
  })
})
