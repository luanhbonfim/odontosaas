import { Navigate, Outlet } from 'react-router-dom'
import { VENDOR_BASE_PATH } from './constants'
import { vendorTokenStore } from './vendor-token-store'

/**
 * Guarda de rota do Vendor Admin: exige sessão ativa de operador vendor.
 */
export function VendorRequireAuth() {
  if (!vendorTokenStore.autenticado) {
    return <Navigate to={`${VENDOR_BASE_PATH}/login`} replace />
  }
  return <Outlet />
}

/**
 * Guarda de rota do Vendor Admin restrita a SuperAdmin — só pras telas que o
 * backend já trata como 100% superadmin-only (sem nenhuma ação staff): Master
 * Admin Global, Configurações de Login e Segurança 2FA. Defesa em profundidade
 * (o 403 real já vem do backend); redireciona pro dashboard do vendor em vez
 * de deixar a tela carregar pra depois falhar.
 */
export function VendorRequireSuperAdmin() {
  if (!vendorTokenStore.autenticado) {
    return <Navigate to={`${VENDOR_BASE_PATH}/login`} replace />
  }
  if (!vendorTokenStore.operador?.is_superuser) {
    return <Navigate to={VENDOR_BASE_PATH} replace />
  }
  return <Outlet />
}

/**
 * Guarda de rota de visitante do Vendor: redireciona para o dashboard se já logado.
 */
export function VendorSomenteVisitante() {
  if (vendorTokenStore.autenticado) {
    return <Navigate to={VENDOR_BASE_PATH} replace />
  }
  return <Outlet />
}
