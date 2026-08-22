import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UserMenu } from './user-menu'

const renderMenu = () => render(<UserMenu />, { wrapper: MemoryRouter })

const { sessaoMock, sairMock, temaState } = vi.hoisted(() => ({
  sessaoMock: vi.fn(),
  sairMock: vi.fn(),
  temaState: { tema: 'claro', alternar: vi.fn() },
}))

vi.mock('@/features/auth/use-sessao', () => ({ useSessao: sessaoMock }))
vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => ({ sair: sairMock, entrar: vi.fn() }),
}))
vi.mock('@/stores/tema', () => ({
  useTema: (seletor: (estado: typeof temaState) => unknown) => seletor(temaState),
}))

function comUsuario() {
  sessaoMock.mockReturnValue({
    usuario: {
      email: 'dra@c.com',
      nomeCompleto: 'Dra. Ana',
      papel: 'DENTISTA_GERENTE',
      papelExibicao: 'Dentista Gerente',
      clinica: { schema: 'demo', nomeFantasia: 'Clínica Sorriso' },
    },
    carregando: false,
    erro: false,
  })
}

describe('UserMenu', () => {
  afterEach(() => vi.clearAllMocks())

  it('mostra o nome do usuário no gatilho', () => {
    comUsuario()
    renderMenu()
    expect(screen.getByRole('button', { name: /menu do usuário/i })).toHaveTextContent('Dra. Ana')
  })

  it('abre o menu (mostra o papel) e permite sair', async () => {
    comUsuario()
    const user = userEvent.setup()
    renderMenu()

    await user.click(screen.getByRole('button', { name: /menu do usuário/i }))
    expect(await screen.findByText('Dentista Gerente')).toBeInTheDocument()

    await user.click(screen.getByRole('menuitem', { name: /sair/i }))
    expect(sairMock).toHaveBeenCalled()
  })
})
