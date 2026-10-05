import { render, screen } from '@testing-library/react'
import { Suspense, lazy } from 'react'
import { describe, expect, it } from 'vitest'

import { violacoesAxe } from '@/test/axe'

import { CarregandoPagina } from './carregando-pagina'

describe('CarregandoPagina', () => {
  it('anuncia o carregamento (role=status, aria-busy) e não tem violações de a11y', async () => {
    const { container } = render(<CarregandoPagina />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveTextContent('Carregando…')
    expect(await violacoesAxe(container)).toEqual([])
  })

  it('é o fallback de uma página sob demanda enquanto o chunk não chega', async () => {
    const Pendente = lazy(() => new Promise<{ default: () => null }>(() => {}))
    render(
      <Suspense fallback={<CarregandoPagina />}>
        <Pendente />
      </Suspense>,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('mostra a página quando o chunk carrega', async () => {
    const Pronta = lazy(async () => ({ default: () => <h1>Pronta</h1> }))
    render(
      <Suspense fallback={<CarregandoPagina />}>
        <Pronta />
      </Suspense>,
    )
    expect(await screen.findByRole('heading', { name: 'Pronta' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
