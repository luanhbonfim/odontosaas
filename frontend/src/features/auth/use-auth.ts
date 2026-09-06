import { useNavigate } from 'react-router-dom'

import { api } from '@/lib/api/client'
import { CHAVE_AVISOS_DISPENSADOS } from '@/features/avisos/carrossel-avisos'
import { queryClient } from '@/lib/api/query-client'
import { tokenStore } from '@/lib/api/token-store'

import type { CredenciaisLogin } from './login-page'

/** Ações de autenticação: entrar (login JWT) e sair (logout). */
export function useAuth() {
  const navegar = useNavigate()

  /** Autentica no backend e guarda os tokens. Rejeita com ErroApi em caso de falha. */
  async function entrar(credenciais: CredenciaisLogin) {
    const { data } = await api.post('/auth/token/', {
      email: credenciais.email,
      password: credenciais.senha,
    })
    tokenStore.definir({ access: data.access, refresh: data.refresh })
    // Novo login = nova sessão: reabre o carrossel de avisos mesmo que a
    // pessoa já tenha dispensado antes de deslogar (mesma aba/navegador).
    try {
      sessionStorage.removeItem(CHAVE_AVISOS_DISPENSADOS)
    } catch {
      // sessionStorage indisponível (ex.: modo privado) — sem efeito prático.
    }
    navegar('/')
  }

  /** Encerra a sessão: limpa tokens, zera o cache do Query e volta ao login. */
  function sair() {
    tokenStore.limpar()
    queryClient.clear()
    navegar('/login', { replace: true })
  }

  return { entrar, sair }
}
