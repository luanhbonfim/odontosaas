import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UsuariosPage } from './usuarios-page'

const { usuariosMock } = vi.hoisted(() => ({ usuariosMock: vi.fn() }))
vi.mock('./use-usuarios', () => ({ useUsuarios: usuariosMock }))
vi.mock('./acoes-usuario', () => ({ AcoesUsuario: () => null }))
vi.mock('./usuario-form-drawer', () => ({
  UsuarioFormDrawer: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
}))

const AMOSTRA = [
  {
    id: 1,
    nome_completo: 'Rita Recep',
    email: 'rita@c.com',
    papel: 'RECEPCAO',
    papel_display: 'Recepção',
    ativo: true,
  },
  {
    id: 2,
    nome_completo: 'Gil Gerente',
    email: 'gil@c.com',
    papel: 'DENTISTA_GERENTE',
    papel_display: 'Dentista Gerente',
    ativo: false,
    dentista_nome: 'Dra. Ana',
  },
]

function preparar(dados = AMOSTRA, extra = {}) {
  usuariosMock.mockReturnValue({ data: dados, isLoading: false, isError: false, ...extra })
}

describe('UsuariosPage', () => {
  afterEach(() => usuariosMock.mockReset())

  it('lista com nome, e-mail, dentista vinculado, perfil e status', () => {
    preparar()
    render(<UsuariosPage />)
    expect(screen.getByText('Rita Recep')).toBeInTheDocument()
    expect(screen.getByText('gil@c.com')).toBeInTheDocument()
    expect(screen.getByText('Dra. Ana')).toBeInTheDocument() // dentista vinculado
    expect(screen.getByText('Recepção')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Bloqueado')).toBeInTheDocument()
  })

  it('tem o botão "Novo usuário"', () => {
    preparar()
    render(<UsuariosPage />)
    expect(screen.getByRole('button', { name: /novo usuário/i })).toBeInTheDocument()
  })

  it('filtra pela busca (nome ou e-mail)', async () => {
    preparar()
    const user = userEvent.setup()
    render(<UsuariosPage />)
    await user.type(screen.getByPlaceholderText(/buscar por nome ou e-mail/i), 'gil')
    expect(screen.getByText('Gil Gerente')).toBeInTheDocument()
    expect(screen.queryByText('Rita Recep')).not.toBeInTheDocument()
  })

  it('mostra estado vazio', () => {
    preparar([])
    render(<UsuariosPage />)
    expect(screen.getByText('Nenhum usuário cadastrado.')).toBeInTheDocument()
  })

  it('mostra erro', () => {
    preparar([], { isError: true })
    render(<UsuariosPage />)
    expect(screen.getByText('Não foi possível carregar a equipe')).toBeInTheDocument()
  })
})
