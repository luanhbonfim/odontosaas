import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatusBadge } from './status-badge'

describe('StatusBadge', () => {
  it('renderiza o rótulo textual (cor nunca sozinha)', () => {
    render(<StatusBadge variante="sucesso">Confirmada</StatusBadge>)
    expect(screen.getByText('Confirmada')).toBeInTheDocument()
  })

  it('aplica a cor da variante no ponto (com aria-hidden)', () => {
    const { container } = render(<StatusBadge variante="pendente">Pendente</StatusBadge>)
    const ponto = container.querySelector('[aria-hidden="true"]')
    expect(ponto).not.toBeNull()
    expect(ponto).toHaveClass('bg-warning')
  })

  it('usa cor destrutiva para erro', () => {
    const { container } = render(<StatusBadge variante="erro">Cancelada</StatusBadge>)
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('bg-destructive')
  })
})
