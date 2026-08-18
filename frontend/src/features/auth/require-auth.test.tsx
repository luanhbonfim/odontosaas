import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { tokenStore } from '@/lib/api/token-store'

import { RequireAuth, SomenteVisitante } from './require-auth'

function Arvore() {
  return (
    <Routes>
      <Route element={<SomenteVisitante />}>
        <Route path="/login" element={<div>Tela de login</div>} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/" element={<div>Painel protegido</div>} />
      </Route>
    </Routes>
  )
}

function renderizar(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Arvore />
    </MemoryRouter>,
  )
}

describe('Guarda de rotas', () => {
  afterEach(() => tokenStore.limpar())

  it('sem sessão, rota protegida redireciona para /login', () => {
    renderizar('/')
    expect(screen.getByText('Tela de login')).toBeInTheDocument()
  })

  it('com sessão, a rota protegida é exibida', () => {
    tokenStore.definir({ access: 'a', refresh: 'r' })
    renderizar('/')
    expect(screen.getByText('Painel protegido')).toBeInTheDocument()
  })

  it('já autenticado, /login redireciona para a home', () => {
    tokenStore.definir({ access: 'a', refresh: 'r' })
    renderizar('/login')
    expect(screen.getByText('Painel protegido')).toBeInTheDocument()
  })
})
