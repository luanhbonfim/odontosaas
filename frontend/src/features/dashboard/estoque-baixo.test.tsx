import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EstoqueBaixoLista } from './estoque-baixo'

describe('EstoqueBaixoLista', () => {
  it('lista vazia mostra mensagem', () => {
    render(<EstoqueBaixoLista itens={[]} />)
    expect(screen.getByText('Nenhum insumo abaixo do mínimo.')).toBeInTheDocument()
  })

  it('mostra atual/mínimo com unidade e marca crítico (< metade do mínimo)', () => {
    const { container } = render(
      <EstoqueBaixoLista
        itens={[
          { item: 'Resina', unidade: 'UN', atual: 2, minimo: 8 }, // crítico
          { item: 'Luva', unidade: 'CX', atual: 6, minimo: 8 }, // não crítico
        ]}
      />,
    )
    expect(screen.getByText('2/8 UN')).toBeInTheDocument()
    expect(screen.getByText('6/8 CX')).toBeInTheDocument()
    expect(container.querySelectorAll('.bg-destructive').length).toBe(1)
    expect(container.querySelectorAll('.bg-warning').length).toBe(1)
  })

  it('saldo negativo não gera largura negativa na barra', () => {
    const { container } = render(
      <EstoqueBaixoLista itens={[{ item: 'X', unidade: 'UN', atual: -3, minimo: 8 }]} />,
    )
    const barra = container.querySelector('.bg-destructive') as HTMLElement
    expect(barra.style.width).toBe('0%')
  })
})
