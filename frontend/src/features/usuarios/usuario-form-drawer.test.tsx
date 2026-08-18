import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Usuario } from './use-usuarios'
import { UsuarioFormDrawer } from './usuario-form-drawer'

const { criarMock, atualizarMock } = vi.hoisted(() => ({
  criarMock: vi.fn(),
  atualizarMock: vi.fn(),
}))
// Mantém PAPEIS/ACESSO_PAPEL/papeisGerenciaveis reais; só troca os hooks de dados.
vi.mock('./use-usuarios', async (importOriginal) => {
  const real = await importOriginal<typeof import('./use-usuarios')>()
  return {
    ...real,
    useCriarUsuario: () => ({ mutateAsync: criarMock }),
    useAtualizarUsuario: () => ({ mutateAsync: atualizarMock }),
  }
})
// Ator = ADMIN id 999 (pode atribuir todos os perfis).
vi.mock('@/features/auth/use-sessao', () => ({
  useSessao: () => ({ usuario: { id: 999, papel: 'ADMIN' } }),
}))
vi.mock('@/features/dentistas/use-dentistas', () => ({
  useDentistas: () => ({ data: [{ id: 7, nome_completo: 'Dra. Ana', cro: 'CRO-1' }] }),
}))

async function abrir() {
  const user = userEvent.setup()
  render(<UsuarioFormDrawer trigger={<button>Abrir</button>} />)
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  await screen.findByText('Novo usuário')
  return user
}

describe('UsuarioFormDrawer', () => {
  afterEach(() => vi.clearAllMocks())

  it('valida campos obrigatórios', async () => {
    const user = await abrir()
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    expect(await screen.findByText('Informe o nome')).toBeInTheDocument()
    expect(screen.getByText('Informe o e-mail')).toBeInTheDocument()
  })

  it('cria o usuário com o papel selecionado', async () => {
    criarMock.mockResolvedValue({})
    const user = await abrir()
    await user.type(screen.getByLabelText(/nome/i), 'Rita')
    await user.type(screen.getByLabelText(/e-mail/i), 'rita@c.com')
    await user.selectOptions(screen.getByLabelText(/perfil/i), 'DENTISTA')
    await user.type(screen.getByLabelText(/^senha/i), 'Senha12345')
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => expect(criarMock).toHaveBeenCalled())
    expect(criarMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'rita@c.com',
        nome_completo: 'Rita',
        papel: 'DENTISTA',
        senha: 'Senha12345',
      }),
    )
  })

  it('atrela um dentista ao login (só para papel de dentista)', async () => {
    criarMock.mockResolvedValue({})
    const user = await abrir()
    // Sem seletor de dentista para papel de recepção.
    expect(screen.queryByLabelText(/dentista vinculado/i)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(/nome/i), 'Ana')
    await user.type(screen.getByLabelText(/e-mail/i), 'ana@c.com')
    await user.selectOptions(screen.getByLabelText(/perfil/i), 'DENTISTA')
    await user.selectOptions(screen.getByLabelText(/dentista vinculado/i), '7')
    await user.type(screen.getByLabelText(/^senha/i), 'Senha12345')
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => expect(criarMock).toHaveBeenCalled())
    expect(criarMock).toHaveBeenCalledWith(expect.objectContaining({ dentista: 7 }))
  })

  it('dentista já vinculado aparece como chip com X; ao remover, mostra o select', async () => {
    atualizarMock.mockResolvedValue({})
    const vinculado = {
      id: 2,
      email: 'ana@c.com',
      nome_completo: 'Dra. Ana',
      papel: 'DENTISTA',
      ativo: true,
      dentista_id: 7,
      dentista_nome: 'Dra. Ana',
    } as unknown as Usuario
    const user = userEvent.setup()
    render(<UsuarioFormDrawer usuario={vinculado} trigger={<button>Abrir</button>} />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    await screen.findByText('Editar usuário')

    // Chip do vínculo (sem select) + botão de remover.
    expect(screen.getByText('Dra. Ana', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /dentista vinculado/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /remover vínculo do dentista/i }))

    // Agora aparece o select para escolher outro.
    expect(screen.getByRole('combobox', { name: /dentista vinculado/i })).toBeInTheDocument()
  })

  it('mostra o acesso do perfil selecionado (informativo)', async () => {
    const user = await abrir()
    expect(screen.getByText(/Estoque\/Insumos e Notificações/)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/perfil/i), 'DENTISTA')
    expect(screen.getByText(/apenas os seus/i)).toBeInTheDocument()
  })

  it('auto-edição: só nome e senha (sem perfil), payload restrito', async () => {
    atualizarMock.mockResolvedValue({})
    const eu = {
      id: 999,
      email: 'eu@c.com',
      nome_completo: 'Eu',
      papel: 'DENTISTA_GERENTE',
      ativo: true,
    } as unknown as Usuario
    const user = userEvent.setup()
    render(<UsuarioFormDrawer usuario={eu} trigger={<button>Abrir</button>} />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    await screen.findByText('Meu cadastro')

    // Sem seletor de perfil ao editar a si mesmo.
    expect(screen.queryByLabelText(/perfil/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/e-mail/i)).toHaveAttribute('readonly')

    const nome = screen.getByLabelText(/nome/i)
    await user.clear(nome)
    await user.type(nome, 'Eu Novo')
    await user.type(screen.getByLabelText(/senha/i), 'NovaSenha987')
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => expect(atualizarMock).toHaveBeenCalled())
    expect(atualizarMock).toHaveBeenCalledWith({
      id: 999,
      dados: { nome_completo: 'Eu Novo', senha: 'NovaSenha987' },
    })
  })

  it('reflete e-mail duplicado do backend inline', async () => {
    criarMock.mockRejectedValue({
      status: 400,
      mensagem: 'x',
      campos: { email: ['Já existe usuário com este e-mail.'] },
    })
    const user = await abrir()
    await user.type(screen.getByLabelText(/nome/i), 'Rita')
    await user.type(screen.getByLabelText(/e-mail/i), 'rita@c.com')
    await user.type(screen.getByLabelText(/^senha/i), 'Senha12345')
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    expect(await screen.findByText('Já existe usuário com este e-mail.')).toBeInTheDocument()
  })
})
