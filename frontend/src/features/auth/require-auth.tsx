import { Navigate, Outlet } from 'react-router-dom'

import { tokenStore } from '@/lib/api/token-store'
import { useClinicaAtual } from '@/features/auth/use-clinica-atual'
import { useSessao } from '@/features/auth/use-sessao'
import type { ModuloRecurso } from '@/routes/nav'

/**
 * Guarda de rotas: valida a sessão (token) a cada navegação. Sem sessão,
 * redireciona para /login — assim cada menu/rota exige usuário autenticado.
 */
export function RequireAuth() {
  const { data: infoClinica, isLoading } = useClinicaAtual()

  if (isLoading) return null

  // No host público da plataforma (sem tenant), redireciona para a raiz pública
  if (infoClinica?.is_public) {
    return <Navigate to="/" replace />
  }

  if (!tokenStore.autenticado) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

/** Rota pública só para visitantes: se já autenticado, vai para a home. */
export function SomenteVisitante() {
  const { data: infoClinica, isLoading } = useClinicaAtual()
  const hasImpersonateParam =
    typeof window !== 'undefined' &&
    (window.location.search.includes('impersonate_access') ||
      window.location.search.includes('impersonate_token'))

  if (isLoading) return null

  // No host público, a rota /login não existe -> redireciona para a raiz pública /
  if (infoClinica?.is_public) {
    return <Navigate to="/" replace />
  }

  if (tokenStore.autenticado && !hasImpersonateParam) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

/**
 * Guarda de rotas por módulo: redireciona para a home se o módulo estiver
 * explicitamente desabilitado no plano ou override da clínica.
 */
export function RequireModulo({ modulo }: { modulo: ModuloRecurso }) {
  const { usuario, carregando } = useSessao()
  if (carregando) return null

  const modulos = usuario?.clinica?.modulos
  if (modulos) {
    let habilitado: boolean | undefined = modulos[modulo]
    if (habilitado === undefined) {
      if (modulo === 'google_calendar') habilitado = modulos.sync_google
      if (modulo === 'whatsapp') habilitado = modulos.whatsapp_waha
    }
    if (habilitado === false) {
      return <Navigate to="/" replace />
    }
  }

  return <Outlet />
}

