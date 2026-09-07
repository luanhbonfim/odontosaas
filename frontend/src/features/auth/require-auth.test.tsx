import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { tokenStore } from '@/lib/api/token-store'

import { RequireAuth, SomenteVisitante } from './require-auth'

const mockUseClinicaAtual = vi.fn()
vi.mock('./use-clinica-atual', () => ({
  useClinicaAtual: () => mockUseClinicaAtual(),
}))

const obterTokenRenovadoMock = vi.fn()
vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  obterTokenRenovado: () => obterTokenRenovadoMock(),
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

  it('reload com só refresh persistido (sem access em memória): espera renovar antes de liberar a rota', async () => {
    // Simula exatamente o cenário do F5: nada passou por tokenStore.definir()
    // nesta "aba" ainda, só o refresh sobrevive no localStorage de antes.
    localStorage.setItem('odonto-refresh', 'r-antigo')
    let resolver: ((valor: string) => void) | undefined
    obterTokenRenovadoMock.mockReturnValue(
      new Promise<string>((resolve) => {
        resolver = resolve
      }),
    )

    renderizar('/dashboard')
    // Enquanto a renovação não resolve, não libera a rota nem redireciona pro
    // login (evita a corrida: consulta disparando sem Authorization nenhum).
    expect(screen.queryByText('Painel protegido')).not.toBeInTheDocument()
    expect(screen.queryByText('Tela de login')).not.toBeInTheDocument()

    // Renovação resolve (efeito colateral real: define o access novo).
    tokenStore.definir({ access: 'novo', refresh: 'r-antigo' })
    resolver?.('novo')
    expect(await screen.findByText('Painel protegido')).toBeInTheDocument()
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
