import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { api } from '@/lib/api/client'
import { tokenStore } from '@/lib/api/token-store'

export type Papel = 'ADMIN' | 'DENTISTA_GERENTE' | 'DENTISTA' | 'RECEPCAO'

export type ModulosAtivos = {
  google_calendar?: boolean
  sync_google?: boolean
  whatsapp?: boolean
  whatsapp_waha?: boolean
  financeiro?: boolean
  estoque?: boolean
  [chave: string]: boolean | undefined
}

/** Sessão do usuário logado (dados de `/api/auth/me/`, em camelCase). */
export type Sessao = {
  id: number
  email: string
  nomeCompleto: string
  papel: Papel
  papelExibicao: string
  clinica: {
    schema: string
    nomeFantasia: string
    modulos?: ModulosAtivos
  }
}

// Formato bruto retornado pelo backend (snake_case).
type MeResposta = {
  id: number
  email: string
  nome_completo: string
  papel: Papel
  papel_display: string
  clinica: {
    schema: string
    nome_fantasia: string
    modulos?: ModulosAtivos
  }
}

async function buscarSessao(): Promise<Sessao> {
  const { data } = await api.get<MeResposta>('/auth/me/')
  return {
    id: data.id,
    email: data.email,
    nomeCompleto: data.nome_completo ?? '',
    papel: data.papel,
    papelExibicao: data.papel_display,
    clinica: {
      schema: data.clinica.schema,
      nomeFantasia: data.clinica.nome_fantasia,
      modulos: data.clinica.modulos ?? {
        google_calendar: true,
        whatsapp: true,
        financeiro: true,
        estoque: true,
      },
    },
  }
}

/**
 * Contexto da sessão: usuário logado (nome, papel) e a clínica (tenant).
 * Só busca quando há sessão; o cache do Query serve de store compartilhado.
 */
export function useSessao() {
  const query = useQuery({
    queryKey: ['sessao'],
    queryFn: buscarSessao,
    enabled: tokenStore.autenticado,
    staleTime: 5 * 60_000,
    retry: false,
  })

  // Título da aba: "NomeClínica - PróClínica" (ou só "PróClínica" deslogado).
  const nomeClinica = query.data?.clinica.nomeFantasia
  useEffect(() => {
    document.title = nomeClinica ? `${nomeClinica} - PróClínica` : 'PróClínica'
  }, [nomeClinica])

  return {
    usuario: query.data ?? null,
    carregando: query.isLoading,
    erro: query.isError,
  }
}
