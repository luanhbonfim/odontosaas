const CHAVE_ACCESS_VENDOR = 'odonto-vendor-access'
const CHAVE_REFRESH_VENDOR = 'odonto-vendor-refresh'
const CHAVE_OPERADOR_INFO = 'odonto-vendor-operador'

function lerAccess(): string | null {
  try {
    return sessionStorage.getItem(CHAVE_ACCESS_VENDOR) || localStorage.getItem(CHAVE_ACCESS_VENDOR)
  } catch {
    return null
  }
}

let accessTokenVendor: string | null = lerAccess()

export type InfoOperadorVendor = {
  email: string
  nome?: string
  is_staff?: boolean
  is_superuser?: boolean
}

function lerRefresh(): string | null {
  try {
    return localStorage.getItem(CHAVE_REFRESH_VENDOR)
  } catch {
    return null
  }
}

function lerOperador(): InfoOperadorVendor | null {
  try {
    const raw = localStorage.getItem(CHAVE_OPERADOR_INFO)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const vendorTokenStore = {
  get access() {
    if (!accessTokenVendor) {
      accessTokenVendor = lerAccess()
    }
    return accessTokenVendor
  },
  get refresh() {
    return lerRefresh()
  },
  get operador(): InfoOperadorVendor | null {
    return lerOperador()
  },
  get autenticado() {
    return lerRefresh() !== null
  },
  definir(tokens: { access: string; refresh?: string; operador?: InfoOperadorVendor }) {
    accessTokenVendor = tokens.access
    try {
      sessionStorage.setItem(CHAVE_ACCESS_VENDOR, tokens.access)
      localStorage.setItem(CHAVE_ACCESS_VENDOR, tokens.access)
    } catch {
      // ignora
    }
    if (tokens.refresh !== undefined) {
      try {
        localStorage.setItem(CHAVE_REFRESH_VENDOR, tokens.refresh)
      } catch {
        // ignora
      }
    }
    if (tokens.operador !== undefined) {
      try {
        localStorage.setItem(CHAVE_OPERADOR_INFO, JSON.stringify(tokens.operador))
      } catch {
        // ignora
      }
    }
  },
  limpar() {
    accessTokenVendor = null
    try {
      sessionStorage.removeItem(CHAVE_ACCESS_VENDOR)
      localStorage.removeItem(CHAVE_ACCESS_VENDOR)
      localStorage.removeItem(CHAVE_REFRESH_VENDOR)
      localStorage.removeItem(CHAVE_OPERADOR_INFO)
    } catch {
      // ignora
    }
  },
}
