import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export type MeuPlanoData = {
  clinica: {
    nome_fantasia: string
    razao_social: string
    cnpj: string | null
    schema_name: string
    responsavel_nome: string
    responsavel_email: string | null
    responsavel_telefone: string
  }
  plano: {
    id: number | null
    nome: string
    periodicidade: 'MENSAL' | 'ANUAL' | 'PERMANENTE'
    periodicidade_display: string
    preco_mensal: number
    preco_anual: number | null
  }
  status: {
    status_assinatura: string
    status_efetivo: string
    ativo: boolean
    vigencia_fim: string | null
    dias_restantes: number | null
    vencido: boolean
  }
  capacidade: {
    dentistas: {
      atual: number
      limite: number | null
      ilimitado: boolean
      percentual: number
      atingiu_limite: boolean
    }
    usuarios: {
      atual: number
      limite: number | null
      ilimitado: boolean
      percentual: number
      atingiu_limite: boolean
    }
    pacientes: {
      atual: number
      limite: number | null
      ilimitado: boolean
      percentual: number
      atingiu_limite: boolean
    }
    armazenamento_mb: {
      atual_mb: number
      limite_mb: number
      percentual: number
    }
  }
  modulos: {
    financeiro: boolean
    estoque: boolean
    sync_google: boolean
    whatsapp_waha: boolean
  }
  upgrade: {
    contato_comercial_email: string
    contato_comercial_whatsapp: string
    whatsapp_url: string
  }
}

export function useMeuPlano() {
  return useQuery<MeuPlanoData>({
    queryKey: ['meu-plano'],
    queryFn: async () => {
      const resp = await api.get<MeuPlanoData>('/meu-plano/')
      return resp.data
    },
  })
}
