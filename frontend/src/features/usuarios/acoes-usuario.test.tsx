import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AcoesUsuario } from './acoes-usuario'
import type { Usuario } from './use-usuarios'

const { atualizarMock, sessaoMock } = vi.hoisted(() => ({
  atualizarMock: vi.fn(),
  sessaoMock: vi.fn(),
}))
// Mantém `podeGerenciar` real; só troca o hook de atualização.
vi.mock('./use-usuarios', async (importOriginal) => {
  const real = await importOriginal<typeof import('./use-usuarios')>()
  return { ...real, useAtualizarUsuario: () => ({ mutateAsync: atualizarMock }) }
})
vi.mock('@/features/auth/use-sessao', () => ({ useSessao: sessaoMock }))
// O drawer é testado à parte; aqui só renderizamos o seu gatilho (botão editar).
vi.mock('./usuario-form-drawer', () => ({
  UsuarioFormDrawer: ({ trigger }: { trigger: ReactNode }) => trigger,
}))

const RECEP_ATIVO = {
  id: 7,
  email: 'x@c.com',
  papel: 'RECEPCAO',
  ativo: true,
} as unknown as Usuario
const RECEP_BLOQ = {
  id: 8,
  email: 'y@c.com',
  papel: 'RECEPCAO',
  ativo: false,
} as unknown as Usuario
const OUTRO_ADMIN = { id: 9, email: 'a@c.com', papel: 'ADMIN', ativo: true } as unknown as Usuario
const EU_GERENTE = {
  id: 5,
  email: 'eu@c.com',
  papel: 'DENTISTA_GERENTE',
  ativo: true,
} as unknown as Usuario

describe('AcoesUsuario', () => {
  beforeEach(() => sessaoMock.mockReturnValue({ usuario: { id: 1, papel: 'ADMIN' } }))
  afterEach(() => vi.clearAllMocks())

  it('bloquear pede confirmação e chama a atualização', async () => {
    atualizarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<AcoesUsuario usuario={RECEP_ATIVO} />)

    await user.click(screen.getByRole('button', { name: /bloquear x@c\.com/i }))
    expect(await screen.findByText('Bloquear acesso?')).toBeInTheDocument()
    expect(atualizarMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /^bloquear$/i }))
    await waitFor(() =>
      expect(atualizarMock).toHaveBeenCalledWith({ id: 7, dados: { ativo: false } }),
    )
  })

  it('reativar chama a atualização direto', async () => {
    atualizarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<AcoesUsuario usuario={RECEP_BLOQ} />)

    await user.click(screen.getByRole('button', { name: /reativar y@c\.com/i }))
    await waitFor(() =>
      expect(atualizarMock).toHaveBeenCalledWith({ id: 8, dados: { ativo: true } }),
    )
  })

  it('não mostra ações para cargo igual/superior (hierarquia)', () => {
    sessaoMock.mockReturnValue({ usuario: { id: 1, papel: 'DENTISTA_GERENTE' } })
    render(<AcoesUsuario usuario={OUTRO_ADMIN} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('para o próprio usuário, só edita (sem bloquear)', () => {
    sessaoMock.mockReturnValue({ usuario: { id: 5, papel: 'DENTISTA_GERENTE' } })
    render(<AcoesUsuario usuario={EU_GERENTE} />)
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /bloquear/i })).not.toBeInTheDocument()
  })
})
