import { Navigate, Outlet } from 'react-router-dom'

import { tokenStore } from '@/lib/api/token-store'

/**
 * Guarda de rotas: valida a sessão (token) a cada navegação. Sem sessão,
 * redireciona para /login — assim cada menu/rota exige usuário autenticado.
 */
export function RequireAuth() {
  if (!tokenStore.autenticado) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

/** Rota pública só para visitantes: se já autenticado, vai para a home. */
export function SomenteVisitante() {
  if (tokenStore.autenticado) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
