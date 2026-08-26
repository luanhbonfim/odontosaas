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

async function obterTokenRenovado(): Promise<string> {
  if (!renovacaoEmAndamento) {
    renovacaoEmAndamento = renovarAccess().finally(() => {
      renovacaoEmAndamento = null
    })
  }
  return renovacaoEmAndamento
}

// Considera que o access precisa renovar se não existe ou se já venceu (com margem).
function accessPrecisaRenovar(margemSegundos = 10): boolean {
  if (!tokenStore.access) return true
  const exp = tokenStore.exp
  if (exp == null) return false
  return Date.now() / 1000 >= exp - margemSegundos
}

// Ao voltar para a aba/janela depois de um período ocioso, o access pode ter vencido
// (lifetime de 30min) enquanto nada disparava requisição. Sem isso, a primeira query
// real (ex.: sidebar/topbar remontando) bateria com 401 antes do retry automático,
// gerando ruído no log de erros do backend mesmo com a sessão se recuperando sozinha.
function renovarSeVoltouOcioso() {
  if (!tokenStore.refresh || !accessPrecisaRenovar()) return
  obterTokenRenovado().catch(() => {
    tokenStore.limpar()
    window.dispatchEvent(new Event('sessao-expirada'))
  })
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') renovarSeVoltouOcioso()
  })
  window.addEventListener('focus', renovarSeVoltouOcioso)
}

// Resposta: no 401 tenta renovar o access UMA vez e refaz a requisição.
// No 403 de clínica bloqueada/suspensa, desloga imediatamente os usuários conectados.
api.interceptors.response.use(
  (resposta) => resposta,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const status = error.response?.status
    const data = error.response?.data as Record<string, unknown> | undefined

    // Se o tenant foi bloqueado/suspenso pela administração, desloga imediatamente
    if (
      status === 403 &&
      (data?.motivo ||
        data?.erro === 'Acesso suspenso.' ||
        (typeof data?.detail === 'string' && data.detail.includes('suspenso')))
    ) {
      tokenStore.limpar()
      window.dispatchEvent(new Event('sessao-expirada'))
      return Promise.reject(normalizarErro(error))
    }

    if (status === 401 && original && !original._retry) {
      const url = original.url || ''
      // Ignora erro de login direto com credenciais inválidas (deixa para o form de login tratar)
      if (url.includes('/auth/token/') && !url.includes('/auth/token/refresh/')) {
        return Promise.reject(normalizarErro(error))
      }

      if (!tokenStore.refresh) {
        tokenStore.limpar()
        window.dispatchEvent(new Event('sessao-expirada'))
        return Promise.reject(normalizarErro(error))
      }

      original._retry = true
      try {
        const novoToken = await obterTokenRenovado()
        if (original.headers) {
          original.headers.Authorization = `Bearer ${novoToken}`
        }
        return api(original)
      } catch {
        tokenStore.limpar()
        // Sessão inválida/expirada: avisa a app para redirecionar ao /login.
        window.dispatchEvent(new Event('sessao-expirada'))
      }
    }
    return Promise.reject(normalizarErro(error))
  },
)

/** Converte um erro do Axios/DRF em `ErroApi` (detail/mensagem/erro → mensagem; demais → campos). */
export function normalizarErro(error: AxiosError): ErroApi {
  const status = error.response?.status
  const data = error.response?.data as unknown

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const registro = data as Record<string, unknown>
    if (typeof registro.detail === 'string') {
      return { status, mensagem: registro.detail }
    }
    if (typeof registro.mensagem === 'string') {
      return { status, mensagem: registro.mensagem }
    }
    if (typeof registro.erro === 'string') {
      return { status, mensagem: registro.erro }
    }
    const campos: Record<string, string[]> = {}
    for (const [chave, valor] of Object.entries(registro)) {
      campos[chave] = Array.isArray(valor) ? valor.map(String) : [String(valor)]
    }
    const mensagem =
      campos.non_field_errors?.[0] ??
      campos.erro?.[0] ??
      campos.mensagem?.[0] ??
      'Verifique os campos e tente novamente.'
    return { status, mensagem, campos }
  }
  return { status, mensagem: error.message || 'Erro de rede. Tente novamente.' }
}
