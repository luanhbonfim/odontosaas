import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { NaoEncontradaPage } from './nao-encontrada-page'

const mockUseClinicaAtual = vi.fn()
vi.mock('@/features/auth/use-clinica-atual', () => ({
  useClinicaAtual: () => mockUseClinicaAtual(),
}))

describe('NaoEncontradaPage (404)', () => {
  it('renderiza os textos e botões da página 404', () => {
    mockUseClinicaAtual.mockReturnValue({
      data: { is_public: true, schema: 'public', nome_fantasia: null },
      isLoading: false,
    })

    render(
      <MemoryRouter>
        <NaoEncontradaPage />
      </MemoryRouter>
    )

    expect(screen.getByText('404 | Não Encontrado')).toBeInTheDocument()
    expect(screen.getByText('Página Não Encontrada')).toBeInTheDocument()
    expect(
      screen.getByText(/o endereço ou endpoint que você tentou acessar não existe/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /voltar/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /página inicial/i })).toHaveAttribute('href', '/')
  })

  it('aponta link de início para /dashboard quando dentro do subdomínio do tenant', () => {
    mockUseClinicaAtual.mockReturnValue({
      data: { is_public: false, schema: 'clinica_alfa', nome_fantasia: 'Clínica Alfa' },
      isLoading: false,
    })

    render(
      <MemoryRouter>
        <NaoEncontradaPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: /página inicial/i })).toHaveAttribute(
      'href',
      '/dashboard'
    )
  })
})
