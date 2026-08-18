// Armazenamento dos tokens JWT.
// - access: só em memória (curta duração, renovado via refresh no 401).
// - refresh: persistido em localStorage para a sessão sobreviver a reload/abas.
//   O localStorage é a fonte de verdade do refresh (sincroniza entre abas).
const CHAVE_REFRESH = 'odonto-refresh'

let accessToken: string | null = null

function lerRefresh(): string | null {
  try {
    return localStorage.getItem(CHAVE_REFRESH)
  } catch {
    return null
  }
}

export const tokenStore = {
  get access() {
    return accessToken
  },
  get refresh() {
    return lerRefresh()
  },
  /** True quando há sessão (refresh presente) — usado pela guarda de rota. */
  get autenticado() {
    return lerRefresh() !== null
  },
  definir(tokens: { access: string; refresh?: string }) {
    accessToken = tokens.access
    if (tokens.refresh !== undefined) {
      try {
        localStorage.setItem(CHAVE_REFRESH, tokens.refresh)
      } catch {
        // ignora indisponibilidade de localStorage (ex.: modo restrito)
      }
    }
  },
  limpar() {
    accessToken = null
    try {
      localStorage.removeItem(CHAVE_REFRESH)
    } catch {
      // ignora
    }
  },
}
