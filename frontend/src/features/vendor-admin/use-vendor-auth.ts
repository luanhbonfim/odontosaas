import { useNavigate } from 'react-router-dom'
import { queryClient } from '@/lib/api/query-client'
import { VENDOR_BASE_PATH } from './constants'
import { vendorApi } from './vendor-api-client'
import { vendorTokenStore, type InfoOperadorVendor } from './vendor-token-store'

export type CredenciaisVendorLogin = {
  email: string
  senha: string
  codigoMfa?: string
}

function decodificarPayloadJwt(token: string): Record<string, unknown> {
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

export function useVendorAuth() {
  const navegar = useNavigate()

  async function entrar(credenciais: CredenciaisVendorLogin) {
    const { data } = await vendorApi.post('/plataforma-admin/auth/login/', {
      email: credenciais.email,
      password: credenciais.senha,
    })

    const payload = decodificarPayloadJwt(data.access)
    const is_staff = Boolean(payload.is_staff)
    const is_superuser = Boolean(payload.is_superuser)

    // Gate de segurança do cliente: somente operadores com is_staff ou is_superuser podem acessar
    if (!is_staff && !is_superuser) {
      throw new Error('Acesso negado: sua conta não possui privilégios de operador do Vendor Admin.')
    }

    const operador: InfoOperadorVendor = {
      email: (payload.email as string) || credenciais.email,
      nome: (payload.nome as string) || credenciais.email.split('@')[0],
      is_staff,
      is_superuser,
    }

    vendorTokenStore.definir({
      access: data.access,
      refresh: data.refresh,
      operador,
    })

    navegar(VENDOR_BASE_PATH, { replace: true })
  }

  function sair() {
    vendorTokenStore.limpar()
    queryClient.clear()
    navegar(`${VENDOR_BASE_PATH}/login`, { replace: true })
  }

  return { entrar, sair, operador: vendorTokenStore.operador, autenticado: vendorTokenStore.autenticado }
}
