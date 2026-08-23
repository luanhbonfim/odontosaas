import { useQuery } from '@tanstack/react-query'

export type PlanoPublico = {
  id: number
  nome: string
  periodicidade: 'MENSAL' | 'ANUAL' | 'PERMANENTE'
  preco_mensal: string
  preco_anual: string | null
  limite_dentistas: number | null
  limite_usuarios: number | null
  limite_pacientes_ativos: number | null
  limite_armazenamento_mb: number
  modulo_financeiro_ativo: boolean
  modulo_estoque_ativo: boolean
  sync_google_ativo: boolean
  whatsapp_waha_ativo: boolean
}

// Fallback estático usado quando o endpoint público falha ou está indisponível,
// para que a seção de planos nunca fique vazia.
export const PLANOS_FALLBACK: PlanoPublico[] = [
  {
    id: -1,
    nome: 'Básico',
    periodicidade: 'MENSAL',
    preco_mensal: '149.00',
    preco_anual: '1430.00',
    limite_dentistas: 2,
    limite_usuarios: 4,
    limite_pacientes_ativos: 500,
    limite_armazenamento_mb: 2048,
    modulo_financeiro_ativo: false,
    modulo_estoque_ativo: false,
    sync_google_ativo: true,
    whatsapp_waha_ativo: false,
  },
  {
    id: -2,
    nome: 'Profissional',
    periodicidade: 'MENSAL',
    preco_mensal: '299.00',
    preco_anual: '2870.00',
    limite_dentistas: 6,
    limite_usuarios: 12,
    limite_pacientes_ativos: 3000,
    limite_armazenamento_mb: 10240,
    modulo_financeiro_ativo: true,
    modulo_estoque_ativo: true,
    sync_google_ativo: true,
    whatsapp_waha_ativo: true,
  },
  {
    id: -3,
    nome: 'Enterprise',
    periodicidade: 'MENSAL',
    preco_mensal: '599.00',
    preco_anual: '5750.00',
    limite_dentistas: null,
    limite_usuarios: null,
    limite_pacientes_ativos: null,
    limite_armazenamento_mb: 51200,
    modulo_financeiro_ativo: true,
    modulo_estoque_ativo: true,
    sync_google_ativo: true,
    whatsapp_waha_ativo: true,
  },
]

async function buscarPlanosPublicos(): Promise<PlanoPublico[]> {
  // Endpoint ANÔNIMO: não usar o client com JWT (evita injeção de token e o
  // evento de sessão-expirada no 401). fetch de mesma origem (Vite faz proxy).
  const resposta = await fetch('/api/plataforma/planos/', {
    headers: { Accept: 'application/json' },
  })
  if (!resposta.ok) {
    throw new Error(`Falha ao carregar planos (${resposta.status})`)
  }
  const dados: unknown = await resposta.json()
  if (!Array.isArray(dados) || dados.length === 0) {
    throw new Error('Resposta de planos vazia ou inválida')
  }
  return dados as PlanoPublico[]
}

/**
 * Carrega os planos públicos da plataforma com cache de 1 hora.
 * Em caso de erro, o consumidor deve usar `PLANOS_FALLBACK`.
 */
export function usePlanosPublicos() {
  return useQuery({
    queryKey: ['planos-publicos'],
    queryFn: buscarPlanosPublicos,
    staleTime: 60 * 60 * 1000, // 1 hora
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
