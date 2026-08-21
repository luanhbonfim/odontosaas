import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { vendorTokenStore } from './vendor-token-store'

/** Erro normalizado da API do Vendor. */
export type ErroVendorApi = {
  status?: number
  mensagem: string
  campos?: Record<string, string[]>
}

export const vendorApi = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Interceptor de requisição: injeta o Bearer token do vendorTokenStore
vendorApi.interceptors.request.use((config) => {
  const token = vendorTokenStore.access
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let renovacaoVendorEmAndamento: Promise<string> | null = null

async function renovarAccessVendor(): Promise<string> {
  const resposta = await axios.post('/api/auth/token/refresh/', {
    refresh: vendorTokenStore.refresh,
  })
  const novo = resposta.data.access as string
  vendorTokenStore.definir({ access: novo })
  return novo
}

async function obterTokenVendorRenovado(): Promise<string> {
  if (!renovacaoVendorEmAndamento) {
    renovacaoVendorEmAndamento = renovarAccessVendor().finally(() => {
      renovacaoVendorEmAndamento = null
    })
  }
  return renovacaoVendorEmAndamento
}

function normalizarErro(error: AxiosError): ErroVendorApi {
  const status = error.response?.status
  const data = error.response?.data as Record<string, unknown> | undefined

  if (!data || typeof data !== 'object') {
    return {
      status,
      mensagem: status === 404 ? 'Recurso não encontrado.' : 'Falha na comunicação com o servidor.',
    }
  }

  if (typeof data.detail === 'string') {
    return { status, mensagem: data.detail }
  }

  if (typeof data.mensagem === 'string') {
    return { status, mensagem: data.mensagem }
  }

  const campos: Record<string, string[]> = {}
  for (const [chave, valor] of Object.entries(data)) {
    if (Array.isArray(valor)) {
      campos[chave] = valor.map(String)
    } else if (typeof valor === 'string') {
      campos[chave] = [valor]
    }
  }

  return {
    status,
    mensagem: Object.values(campos)[0]?.[0] ?? 'Ocorreu um erro na operação.',
    campos: Object.keys(campos).length > 0 ? campos : undefined,
  }
}

// Interceptor de resposta: renovação automática de access token no 401
vendorApi.interceptors.response.use(
  (resposta) => resposta,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const status = error.response?.status

    if (status === 401 && original && !original._retry) {
      const url = original.url || ''
      // Ignora rotas de login direto do vendor
      if (url.includes('/plataforma-admin/auth/login/')) {
        return Promise.reject(normalizarErro(error))
      }

      if (!vendorTokenStore.refresh) {
        vendorTokenStore.limpar()
        window.dispatchEvent(new Event('vendor-sessao-expirada'))
        return Promise.reject(normalizarErro(error))
      }

      original._retry = true
      try {
        const novoToken = await obterTokenVendorRenovado()
        if (original.headers) {
          original.headers.Authorization = `Bearer ${novoToken}`
        }
        return vendorApi(original)
      } catch {
        vendorTokenStore.limpar()
        window.dispatchEvent(new Event('vendor-sessao-expirada'))
      }
    }
    return Promise.reject(normalizarErro(error))
  },
)
