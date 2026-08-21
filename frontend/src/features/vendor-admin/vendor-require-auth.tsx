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
 * Guarda de rota de visitante do Vendor: redireciona para o dashboard se já logado.
 */
export function VendorSomenteVisitante() {
  if (vendorTokenStore.autenticado) {
    return <Navigate to={VENDOR_BASE_PATH} replace />
  }
  return <Outlet />
}
