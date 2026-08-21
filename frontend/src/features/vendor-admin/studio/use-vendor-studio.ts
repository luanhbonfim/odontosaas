import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { vendorApi, type ErroVendorApi } from '../vendor-api-client'

export interface SchemaInfo {
  schema_name: string
  total_tabelas: number
}

export interface ColunaInfo {
  nome: string
  tipo: string
  nullable: boolean
  default: string | null
  is_pk: boolean
}

export interface TabelaInfo {
  tabela: string
  colunas: ColunaInfo[]
}

export interface QueryResultado {
  schema: string
  modo: 'RO' | 'RW'
  colunas: string[]
  linhas: (string | number | boolean | null)[][]
  total_linhas: number
  linhas_afetadas: number
  truncado: boolean
  duracao_ms: number
}

export interface StudioExecutePayload {
  schema: string
  sql: string
  modo: 'RO' | 'RW'
  justificativa?: string
  limite_linhas?: number
}

export interface HistoricoItem {
  id: string
  sql: string
  schema: string
  modo: 'RO' | 'RW'
  sucesso: boolean
  duracao_ms?: number
  linhas?: number
  erro?: string
  dataHora: string
}

const STORAGE_KEY_HISTORICO = 'odonto_studio_query_history_v1'

export function useVendorStudio(schemaAtual: string) {
  const [historico, setHistorico] = useState<HistoricoItem[]>(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_HISTORICO)
      return salvo ? JSON.parse(salvo) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORICO, JSON.stringify(historico.slice(0, 50)))
    } catch {
      // Falha silenciosa de quota de storage
    }
  }, [historico])

  function adicionarAoHistorico(item: Omit<HistoricoItem, 'id' | 'dataHora'>) {
    const novo: HistoricoItem = {
      ...item,
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      dataHora: new Date().toISOString(),
    }
    setHistorico((antigo) => [novo, ...antigo.slice(0, 49)])
  }

  function limparHistorico() {
    setHistorico([])
    localStorage.removeItem(STORAGE_KEY_HISTORICO)
  }

  // 1. Lista de Schemas
  const schemasQuery = useQuery({
    queryKey: ['vendor-studio-schemas'],
    queryFn: async () => {
      const resp = await vendorApi.get<{ schemas: SchemaInfo[] }>('/plataforma-admin/studio/schemas/')
      return resp.data.schemas
    },
  })

  // 2. Dicionário de Tabelas do Schema Selecionado
  const tablesQuery = useQuery({
    queryKey: ['vendor-studio-tables', schemaAtual],
    queryFn: async () => {
      if (!schemaAtual) return []
      const resp = await vendorApi.get<{ schema: string; tabelas: TabelaInfo[] }>('/plataforma-admin/studio/tables/', {
        params: { schema: schemaAtual },
      })
      return resp.data.tabelas
    },
    enabled: Boolean(schemaAtual),
  })

  // 3. Execução de Query SQL
  const executeMutation = useMutation<QueryResultado, ErroVendorApi, StudioExecutePayload>({
    mutationFn: async (payload) => {
      const resp = await vendorApi.post<QueryResultado>('/plataforma-admin/studio/executar/', payload)
      return resp.data
    },
    onSuccess: (dados, vars) => {
      adicionarAoHistorico({
        sql: vars.sql,
        schema: vars.schema,
        modo: vars.modo,
        sucesso: true,
        duracao_ms: dados.duracao_ms,
        linhas: dados.total_linhas || dados.linhas_afetadas,
      })
    },
    onError: (erro, vars) => {
      adicionarAoHistorico({
        sql: vars.sql,
        schema: vars.schema,
        modo: vars.modo,
        sucesso: false,
        erro: erro.mensagem,
      })
    },
  })

  return {
    schemas: schemasQuery.data || [],
    carregandoSchemas: schemasQuery.isLoading,
    tabelas: tablesQuery.data || [],
    carregandoTabelas: tablesQuery.isLoading,
    recarregarTabelas: tablesQuery.refetch,
    executarQuery: executeMutation.mutateAsync,
    executando: executeMutation.isPending,
    erroExecucao: executeMutation.error,
    resultadoAtual: executeMutation.data,
    limparResultado: executeMutation.reset,
    historico,
    limparHistorico,
  }
}
