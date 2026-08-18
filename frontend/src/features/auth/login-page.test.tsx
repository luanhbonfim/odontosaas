import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { ErroApi } from '@/lib/api/client'

import { LoginPage } from './login-page'

// Nome do tenant vem de um hook com useQuery; mock evita precisar de provider.
vi.mock('./use-clinica-atual', () => ({ useClinicaAtual: () => ({ data: 'Clínica Teste' }) }))

describe('LoginPage', () => {
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
})
