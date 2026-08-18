import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Papel } from '@/features/auth/use-sessao'

import { Sidebar } from './sidebar'

const { sessaoMock } = vi.hoisted(() => ({ sessaoMock: vi.fn() }))
vi.mock('@/features/auth/use-sessao', () => ({ useSessao: sessaoMock }))

function renderComPapel(papel: Papel | null) {
  sessaoMock.mockReturnValue({
    usuario: papel ? { papel } : null,
    carregando: false,
    erro: false,
  })
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  )
}

describe('Sidebar (menu por papel)', () => {
  afterEach(() => sessaoMock.mockReset())

  it('ADMIN vê todos os módulos', () => {
    renderComPapel('ADMIN')
    const modulos = [
      'Dashboard',
      'Agenda',
      'Pacientes',
      'Dentistas',
      'Estoque',
      'Financeiro',
      'WhatsApp',
      'Integrações',
      'Equipe',
    ]
    for (const modulo of modulos) {
      expect(screen.getByRole('link', { name: modulo })).toBeInTheDocument()
    }
  })

  it('RECEPCAO não vê Financeiro nem Integrações (mas vê WhatsApp)', () => {
    renderComPapel('RECEPCAO')
    expect(screen.queryByRole('link', { name: 'Financeiro' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Integrações' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toBeInTheDocument()
  })

  it('DENTISTA não vê Financeiro nem WhatsApp (mas vê Integrações)', () => {
    renderComPapel('DENTISTA')
    expect(screen.queryByRole('link', { name: 'Financeiro' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument()
    // Integrações é aberto ao dentista (vê a sua); e os módulos gerais.
    expect(screen.getByRole('link', { name: 'Integrações' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Agenda' })).toBeInTheDocument()
  })

  it('sem sessão carregada, oculta os módulos restritos', () => {
    renderComPapel(null)
    expect(screen.queryByRole('link', { name: 'Financeiro' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
  })
})
