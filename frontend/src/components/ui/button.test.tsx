import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from './button'

describe('Button', () => {
  it('renderiza o texto', () => {
    render(<Button>Salvar</Button>)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
  })

  it('aplica a variante destrutiva', () => {
    render(<Button variant="destructive">Excluir</Button>)
    expect(screen.getByRole('button', { name: 'Excluir' })).toHaveClass('bg-destructive')
  })

  it('dispara o onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Ok</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Ok' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renderiza como âncora com asChild', () => {
    render(
      <Button asChild>
        <a href="/rota">Ir</a>
      </Button>,
    )
    expect(screen.getByRole('link', { name: 'Ir' })).toBeInTheDocument()
  })
})
