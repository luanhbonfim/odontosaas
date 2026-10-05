import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ErroCarregamento } from './erro-carregamento'

describe('ErroCarregamento', () => {
  it('avisa com role=alert e permite tentar de novo', async () => {
    const aoTentar = vi.fn()
    render(<ErroCarregamento titulo="Não foi possível carregar X" aoTentarDeNovo={aoTentar} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar X')
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(aoTentar).toHaveBeenCalledTimes(1)
  })

  it('sem callback não mostra o botão', () => {
    render(<ErroCarregamento titulo="Erro" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
