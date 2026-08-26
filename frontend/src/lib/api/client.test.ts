import { AxiosError } from 'axios'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { server } from '@/test/server'
import { api, normalizarErro } from './client'
import { tokenStore } from './token-store'

afterEach(() => tokenStore.limpar())

describe('camada de API', () => {
  it('injeta o token Bearer na requisição', async () => {
    tokenStore.definir({ access: 'abc123' })
    server.use(
      http.get('/api/ping/', ({ request }) =>
        HttpResponse.json({ auth: request.headers.get('authorization') }),
      ),
    )

    const resp = await api.get('/ping/')
    expect(resp.data.auth).toBe('Bearer abc123')
  })

  it('normaliza erro de validação do DRF em campos', async () => {
    server.use(
      http.post('/api/pacientes/', () =>
        HttpResponse.json({ cpf: ['Já existe paciente com este CPF.'] }, { status: 400 }),
      ),
    )

    await expect(api.post('/pacientes/', {})).rejects.toMatchObject({
      status: 400,
      campos: { cpf: ['Já existe paciente com este CPF.'] },
    })
  })

  it('renova o access no 401 e refaz a requisição', async () => {
    tokenStore.definir({ access: 'velho', refresh: 'r1' })
    let chamadas = 0
    server.use(
      http.get('/api/protegido/', ({ request }) => {
        chamadas += 1
        if (request.headers.get('authorization') === 'Bearer novo') {
          return HttpResponse.json({ ok: true })
        }
        return new HttpResponse(null, { status: 401 })
      }),
      http.post('/api/auth/token/refresh/', () => HttpResponse.json({ access: 'novo' })),
    )

    const resp = await api.get('/protegido/')
    expect(resp.data).toEqual({ ok: true })
    expect(chamadas).toBe(2) // 401 original + retry
    expect(tokenStore.access).toBe('novo')
  })

  it('limpa a sessão quando o refresh também falha', async () => {
    tokenStore.definir({ access: 'velho', refresh: 'ruim' })
    server.use(
      http.get('/api/protegido/', () => new HttpResponse(null, { status: 401 })),
      http.post('/api/auth/token/refresh/', () => new HttpResponse(null, { status: 401 })),
    )

    await expect(api.get('/protegido/')).rejects.toBeTruthy()
    expect(tokenStore.access).toBeNull()
  })

  it('unifica chamadas concorrentes de refresh evitando race conditions', async () => {
    tokenStore.definir({ access: 'velho', refresh: 'r1' })
    let refreshCalls = 0

    server.use(
      http.get('/api/paralelo-1/', ({ request }) => {
        if (request.headers.get('authorization') === 'Bearer novo-concorrente') {
          return HttpResponse.json({ ok: 1 })
        }
        return new HttpResponse(null, { status: 401 })
      }),
      http.get('/api/paralelo-2/', ({ request }) => {
        if (request.headers.get('authorization') === 'Bearer novo-concorrente') {
          return HttpResponse.json({ ok: 2 })
        }
        return new HttpResponse(null, { status: 401 })
      }),
      http.post('/api/auth/token/refresh/', async () => {
        refreshCalls += 1
        return HttpResponse.json({ access: 'novo-concorrente' })
      }),
    )

    const [resp1, resp2] = await Promise.all([
      api.get('/paralelo-1/'),
      api.get('/paralelo-2/'),
    ])

    expect(resp1.data).toEqual({ ok: 1 })
    expect(resp2.data).toEqual({ ok: 2 })
    expect(refreshCalls).toBe(1)
    expect(tokenStore.access).toBe('novo-concorrente')
  })

  it('desloga imediatamente e dispara sessao-expirada quando o tenant é suspenso (403)', async () => {
    tokenStore.definir({ access: 'valido', refresh: 'valido' })
    let sessaoExpiradaDisparada = false
    const ouvinte = () => {
      sessaoExpiradaDisparada = true
    }
    window.addEventListener('sessao-expirada', ouvinte)

    server.use(
      http.get('/api/protegido-tenant/', () =>
        HttpResponse.json({ erro: 'Acesso suspenso.', motivo: 'inadimplente' }, { status: 403 }),
      ),
    )

    await expect(api.get('/protegido-tenant/')).rejects.toMatchObject({
      status: 403,
      mensagem: 'Acesso suspenso.',
    })

    expect(tokenStore.access).toBeNull()
    expect(tokenStore.refresh).toBeNull()
    expect(sessaoExpiradaDisparada).toBe(true)
    window.removeEventListener('sessao-expirada', ouvinte)
  })

  it('não dispara sessao-expirada em 401 na rota de login com senha incorreta', async () => {
    let sessaoExpiradaDisparada = false
    const ouvinte = () => {
      sessaoExpiradaDisparada = true
    }
    window.addEventListener('sessao-expirada', ouvinte)

    server.use(
      http.post('/api/auth/token/', () =>
        HttpResponse.json({ detail: 'No active account found with the given credentials' }, { status: 401 }),
      ),
    )

    await expect(api.post('/auth/token/', { email: 'x@y.com', password: 'errada' })).rejects.toMatchObject({
      status: 401,
      mensagem: 'No active account found with the given credentials',
    })

    expect(sessaoExpiradaDisparada).toBe(false)
    window.removeEventListener('sessao-expirada', ouvinte)
  })

  it('renova o access proativamente ao voltar o foco da janela com token vencido', async () => {
    const payloadVencido = btoa(JSON.stringify({ exp: 1 })) // exp no passado
    tokenStore.definir({ access: `h.${payloadVencido}.s`, refresh: 'r1' })

    let renovacoes = 0
    server.use(
      http.post('/api/auth/token/refresh/', () => {
        renovacoes += 1
        return HttpResponse.json({ access: 'renovado-proativo' })
      }),
    )

    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(tokenStore.access).toBe('renovado-proativo'))
    expect(renovacoes).toBe(1)
  })

  it('não renova ao voltar o foco se o access ainda está válido', async () => {
    const payloadValido = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    tokenStore.definir({ access: `h.${payloadValido}.s`, refresh: 'r1' })

    let renovacoes = 0
    server.use(
      http.post('/api/auth/token/refresh/', () => {
        renovacoes += 1
        return HttpResponse.json({ access: 'nao-deveria-chamar' })
      }),
    )

    window.dispatchEvent(new Event('focus'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(renovacoes).toBe(0)
    expect(tokenStore.access).toBe(`h.${payloadValido}.s`)
  })

  it('normalizarErro: usa "detail" como mensagem', () => {
    const erro = new AxiosError('x')
    erro.response = { status: 403, data: { detail: 'Sem permissão.' } } as never
    expect(normalizarErro(erro)).toEqual({ status: 403, mensagem: 'Sem permissão.' })
  })

  it('normalizarErro: erro de rede sem resposta', () => {
    expect(normalizarErro(new AxiosError()).mensagem).toContain('rede')
  })
})
