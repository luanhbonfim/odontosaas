import { AxiosError } from 'axios'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

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

  it('normalizarErro: usa "detail" como mensagem', () => {
    const erro = new AxiosError('x')
    erro.response = { status: 403, data: { detail: 'Sem permissão.' } } as never
    expect(normalizarErro(erro)).toEqual({ status: 403, mensagem: 'Sem permissão.' })
  })

  it('normalizarErro: erro de rede sem resposta', () => {
    expect(normalizarErro(new AxiosError()).mensagem).toContain('rede')
  })
})
