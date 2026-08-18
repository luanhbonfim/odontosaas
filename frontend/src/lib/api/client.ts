import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { tokenStore } from './token-store'

/** Erro normalizado da API para uso em toasts (mensagem) e forms (campos). */
export type ErroApi = {
  status?: number
  mensagem: string
  campos?: Record<string, string[]>
}

export const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Requisição: injeta o Bearer quando há token.
api.interceptors.request.use((config) => {
  const token = tokenStore.access
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let renovacaoEmAndamento: Promise<string> | null = null

async function renovarAccess(): Promise<string> {
  // Usa axios "cru" (sem interceptors) para evitar recursão no 401.
  const resposta = await axios.post('/api/auth/token/refresh/', { refresh: tokenStore.refresh })
  const novo = resposta.data.access as string
  tokenStore.definir({ access: novo })
  return novo
}

// Resposta: no 401 tenta renovar o access UMA vez e refaz a requisição; senão,
// normaliza o erro.
api.interceptors.response.use(
  (resposta) => resposta,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined

    if (error.response?.status === 401 && tokenStore.refresh && original && !original._retry) {
      original._retry = true
      try {
        renovacaoEmAndamento = renovacaoEmAndamento ?? renovarAccess()
        await renovacaoEmAndamento
        renovacaoEmAndamento = null
        return api(original)
      } catch {
        renovacaoEmAndamento = null
        tokenStore.limpar()
        // Sessão inválida/expirada: avisa a app para redirecionar ao /login.
        window.dispatchEvent(new Event('sessao-expirada'))
      }
    }
    return Promise.reject(normalizarErro(error))
  },
)

/** Converte um erro do Axios/DRF em `ErroApi` (detail → mensagem; demais → campos). */
export function normalizarErro(error: AxiosError): ErroApi {
  const status = error.response?.status
  const data = error.response?.data as unknown

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const registro = data as Record<string, unknown>
    if (typeof registro.detail === 'string') {
      return { status, mensagem: registro.detail }
    }
    const campos: Record<string, string[]> = {}
    for (const [chave, valor] of Object.entries(registro)) {
      campos[chave] = Array.isArray(valor) ? valor.map(String) : [String(valor)]
    }
    const mensagem = campos.non_field_errors?.[0] ?? 'Verifique os campos e tente novamente.'
    return { status, mensagem, campos }
  }
  return { status, mensagem: error.message || 'Erro de rede. Tente novamente.' }
}
