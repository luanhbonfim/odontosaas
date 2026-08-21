import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ErroApi } from '@/lib/api/client'

import { LoginPage } from './login-page'

const mockUseClinicaAtual = vi.fn()

// Nome do tenant vem de um hook com useQuery; mock evita precisar de provider.
vi.mock('./use-clinica-atual', () => ({ useClinicaAtual: () => mockUseClinicaAtual() }))

describe('LoginPage', () => {
  beforeEach(() => {
    mockUseClinicaAtual.mockReturnValue({
      data: { is_public: false, schema: 'clinica_teste', nome_fantasia: 'Clínica Teste' },
      isLoading: false,
    })
  })
  it('mostra erros inline quando os campos estão vazios', async () => {
    const user = userEvent.setup()
    render(<LoginPage aoEntrar={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText('Informe o e-mail')).toBeInTheDocument()
    expect(screen.getByText('Informe a senha')).toBeInTheDocument()
  })

  it('valida o formato do e-mail', async () => {
    const user = userEvent.setup()
    render(<LoginPage aoEntrar={vi.fn()} />)

    await user.type(screen.getByLabelText('E-mail'), 'nao-e-email')
    await user.type(screen.getByLabelText('Senha'), 'segredo123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument()
  })

  it('chama aoEntrar com as credenciais quando o formulário é válido', async () => {
    const user = userEvent.setup()
    const aoEntrar = vi.fn().mockResolvedValue(undefined)
    render(<LoginPage aoEntrar={aoEntrar} />)

    await user.type(screen.getByLabelText('E-mail'), 'dra@clinica.com')
    await user.type(screen.getByLabelText('Senha'), 'segredo123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(aoEntrar).toHaveBeenCalledWith({ email: 'dra@clinica.com', senha: 'segredo123' })
  })

  it('exibe mensagem amigável quando o login retorna 401', async () => {
    const user = userEvent.setup()
    const erro: ErroApi = { status: 401, mensagem: 'No active account found' }
    const aoEntrar = vi.fn().mockRejectedValue(erro)
    render(<LoginPage aoEntrar={aoEntrar} />)

    await user.type(screen.getByLabelText('E-mail'), 'dra@clinica.com')
    await user.type(screen.getByLabelText('Senha'), 'errada')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
  })

  it('alterna a visibilidade da senha', async () => {
    const user = userEvent.setup()
    render(<LoginPage aoEntrar={vi.fn()} />)

    const senha = screen.getByLabelText('Senha')
    expect(senha).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(senha).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(senha).toHaveAttribute('type', 'password')
  })

  it('bloqueia o formulário e exibe tela off/sem acesso quando acessado no domínio raiz/público', async () => {
    // Sobrescreve mock para retornar is_public: true
    mockUseClinicaAtual.mockReturnValue({
      data: { is_public: true, schema: 'public', nome_fantasia: null },
      isLoading: false,
    })

    render(<LoginPage aoEntrar={vi.fn()} />)

    expect(screen.getByText('404 | Página Não Encontrada')).toBeInTheDocument()
    expect(screen.getByText('Acesso Indisponível')).toBeInTheDocument()
    expect(screen.getByText(/o domínio principal é reservado para a página institucional e de vendas/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /entrar/i })).not.toBeInTheDocument()
  })
})

