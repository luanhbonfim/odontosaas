// Armazenamento dos tokens JWT e metadados de sessão do Tenant.
// - access: em memória + persistido temporariamente se for sessão de impersonate (suporte).
// - refresh: persistido em localStorage para a sessão sobreviver a reload/abas.
// - metadados de impersonate (suporte): decodificados e persistidos em localStorage.

const CHAVE_REFRESH = 'odonto-refresh'
const CHAVE_IMPERSONATE_META = 'odonto-impersonate-meta'
const CHAVE_IMPERSONATE_ACCESS = 'odonto-impersonate-access'

export type MetadadosImpersonate = {
  is_impersonate: boolean
  impersonated_by: string | null
  impersonate_read_only: boolean
  exp: number | null
}

let accessToken: string | null = lerImpersonateAccess()
let impersonateMeta: MetadadosImpersonate = lerImpersonateMeta()

function lerRefresh(): string | null {
  try {
    return localStorage.getItem(CHAVE_REFRESH)
  } catch {
    return null
  }
}

function lerImpersonateAccess(): string | null {
  try {
    return localStorage.getItem(CHAVE_IMPERSONATE_ACCESS)
  } catch {
    return null
  }
}

function lerImpersonateMeta(): MetadadosImpersonate {
  try {
    const raw = localStorage.getItem(CHAVE_IMPERSONATE_META)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignora
  }
  return {
    is_impersonate: false,
    impersonated_by: null,
    impersonate_read_only: false,
    exp: null,
  }
}

function decodificarJwt(token: string): Record<string, unknown> {
  try {
    if (!token || typeof token !== 'string') return {}
    const partes = token.split('.')
    if (partes.length !== 3 || !partes[1]) return {}
    const base64Url = partes[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
    return JSON.parse(jsonPayload)
  } catch {
    return {}
  }
}

export const tokenStore = {
  get access() {
    return accessToken || lerImpersonateAccess()
  },
  get refresh() {
    return lerRefresh()
  },
  get autenticado() {
    return Boolean(accessToken || lerImpersonateAccess() || lerRefresh())
  },
  get is_impersonate() {
    return impersonateMeta.is_impersonate
  },
  get impersonated_by() {
    return impersonateMeta.impersonated_by
  },
  get impersonate_read_only() {
    return impersonateMeta.impersonate_read_only
  },
  get exp() {
    return impersonateMeta.exp
  },
  definir(tokens: { access: string; refresh?: string }) {
    accessToken = tokens.access

    // Decodifica claims para identificar sessões de suporte (impersonate)
    const payload = decodificarJwt(tokens.access)
    const isImpersonate = Boolean(payload.is_impersonate)

    impersonateMeta = {
      is_impersonate: isImpersonate,
      impersonated_by: isImpersonate ? (payload.impersonated_by as string) || 'Operador Suporte' : null,
      impersonate_read_only: isImpersonate ? Boolean(payload.impersonate_read_only) : false,
      exp: typeof payload.exp === 'number' ? payload.exp : null,
    }

    try {
      if (tokens.refresh) {
        localStorage.setItem(CHAVE_REFRESH, tokens.refresh)
      }
      if (isImpersonate) {
        localStorage.setItem(CHAVE_IMPERSONATE_ACCESS, tokens.access)
        localStorage.setItem(CHAVE_IMPERSONATE_META, JSON.stringify(impersonateMeta))
      } else {
        localStorage.removeItem(CHAVE_IMPERSONATE_ACCESS)
        localStorage.removeItem(CHAVE_IMPERSONATE_META)
      }
    } catch {
      // ignora indisponibilidade de localStorage
    }
  },
  limpar() {
    accessToken = null
    impersonateMeta = {
      is_impersonate: false,
      impersonated_by: null,
      impersonate_read_only: false,
      exp: null,
    }
    try {
      localStorage.removeItem(CHAVE_REFRESH)
      localStorage.removeItem(CHAVE_IMPERSONATE_ACCESS)
      localStorage.removeItem(CHAVE_IMPERSONATE_META)
    } catch {
      // ignora
    }
  },
}
