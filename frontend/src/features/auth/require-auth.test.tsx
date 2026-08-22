import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { tokenStore } from '@/lib/api/token-store'

import { RequireAuth, SomenteVisitante } from './require-auth'

const mockUseClinicaAtual = vi.fn()
vi.mock('./use-clinica-atual', () => ({
  useClinicaAtual: () => mockUseClinicaAtual(),
}))

function Arvore() {
  return (
    <Routes>
      <Route path="/" element={<div>Raiz Pública ou Painel</div>} />
      <Route element={<SomenteVisitante />}>
        <Route path="/login" element={<div>Tela de login</div>} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<div>Painel protegido</div>} />
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
  beforeEach(() => {
    mockUseClinicaAtual.mockReturnValue({
      data: { is_public: false, schema: 'clinica_teste', nome_fantasia: 'Clínica Teste' },
      isLoading: false,
    })
  })

  afterEach(() => tokenStore.limpar())

  it('no subdomínio do tenant sem sessão, rota protegida redireciona para /login', () => {
    renderizar('/dashboard')
    expect(screen.getByText('Tela de login')).toBeInTheDocument()
  })

  it('no subdomínio do tenant com sessão, a rota protegida é exibida', () => {
    tokenStore.definir({ access: 'a', refresh: 'r' })
    renderizar('/dashboard')
    expect(screen.getByText('Painel protegido')).toBeInTheDocument()
  })

  it('no subdomínio do tenant já autenticado, /login redireciona para a home', () => {
    tokenStore.definir({ access: 'a', refresh: 'r' })
    renderizar('/login')
    expect(screen.getByText('Raiz Pública ou Painel')).toBeInTheDocument()
  })

  it('no host público da plataforma, /login redireciona para a raiz pública', () => {
    mockUseClinicaAtual.mockReturnValue({
      data: { is_public: true, schema: 'public', nome_fantasia: null },
      isLoading: false,
    })

    renderizar('/login')
    expect(screen.getByText('Raiz Pública ou Painel')).toBeInTheDocument()
    expect(screen.queryByText('Tela de login')).not.toBeInTheDocument()
  })

  it('no host público da plataforma, rota protegida redireciona para a raiz pública', () => {
    mockUseClinicaAtual.mockReturnValue({
      data: { is_public: true, schema: 'public', nome_fantasia: null },
      isLoading: false,
    })

    renderizar('/dashboard')
    expect(screen.getByText('Raiz Pública ou Painel')).toBeInTheDocument()
  })

  it('quando o host não resolve para clínica (404/isError), mostra página terminal e NÃO redireciona (anti-loop)', () => {
    // Simula clínica inexistente/removida + token velho (cenário do loop de redirecionamento).
    tokenStore.definir({ access: 'a', refresh: 'r' })
    mockUseClinicaAtual.mockReturnValue({ data: undefined, isLoading: false, isError: true })

    renderizar('/login')
    expect(screen.getByText(/Clínica não encontrada/i)).toBeInTheDocument()
    // Não caiu em login nem redirecionou para a raiz (sem loop).
    expect(screen.queryByText('Tela de login')).not.toBeInTheDocument()
    expect(screen.queryByText('Raiz Pública ou Painel')).not.toBeInTheDocument()
  })
})
