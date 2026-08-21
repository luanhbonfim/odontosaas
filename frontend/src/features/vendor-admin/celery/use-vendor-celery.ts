import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorApi, type ErroVendorApi } from '../vendor-api-client'

export interface PeriodicTaskItem {
  id: number
  name: string
  task: string
  enabled: boolean
  description: string
  interval_display: string
  crontab_display: string
  total_run_count: number
  last_run_at: string | null
  every?: number
  period?: string
  crontab_minute?: string
  crontab_hour?: string
  crontab_day_of_week?: string
}

export interface CeleryClusterStatus {
  redis_conectado: boolean
  tamanho_fila_celery: number
  workers_ativos: Array<{ nome: string; tarefas_ativas: number }>
  total_workers: number
}

export interface AtualizarFrequenciaPayload {
  id: number
  every?: number
  period?: string
  crontab_minute?: string
  crontab_hour?: string
  crontab_day_of_week?: string
}

export function useVendorCelery() {
  const queryClient = useQueryClient()

  // 1. Listagem de Periodic Tasks com polling de 5s
  const tasksQuery = useQuery({
    queryKey: ['vendor-celery-tasks'],
    queryFn: async () => {
      const resp = await vendorApi.get<PeriodicTaskItem[]>('/plataforma-admin/celery/tarefas/')
      return resp.data
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  })

  // 2. Status do Cluster Redis & Workers
  const statusQuery = useQuery({
    queryKey: ['vendor-celery-status'],
    queryFn: async () => {
      const resp = await vendorApi.get<CeleryClusterStatus>('/plataforma-admin/celery/tarefas/status/')
      return resp.data
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  })

  // 3. Alternar Enabled da Tarefa
  const alternarEnabledMutation = useMutation<PeriodicTaskItem, ErroVendorApi, { id: number; enabled: boolean }>({
    mutationFn: async ({ id, enabled }) => {
      const resp = await vendorApi.patch<PeriodicTaskItem>(`/plataforma-admin/celery/tarefas/${id}/`, { enabled })
      return resp.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-celery-tasks'] })
    },
  })

  // 4. Atualizar Intervalo / Cron
  const atualizarFrequenciaMutation = useMutation<PeriodicTaskItem, ErroVendorApi, AtualizarFrequenciaPayload>({
    mutationFn: async ({ id, ...payload }) => {
      const resp = await vendorApi.patch<PeriodicTaskItem>(`/plataforma-admin/celery/tarefas/${id}/`, payload)
      return resp.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-celery-tasks'] })
    },
  })

  // 5. Disparar Tarefa Manualmente
  const dispararTarefaMutation = useMutation<
    { mensagem: string; task_name: string; task_id: string },
    ErroVendorApi,
    number
  >({
    mutationFn: async (id) => {
      const resp = await vendorApi.post<{ mensagem: string; task_name: string; task_id: string }>(
        `/plataforma-admin/celery/tarefas/${id}/disparar/`
      )
      return resp.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-celery-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['vendor-celery-status'] })
    },
  })

  return {
    tarefas: tasksQuery.data || [],
    carregandoTarefas: tasksQuery.isLoading,
    recarregarTarefas: tasksQuery.refetch,
    statusCluster: statusQuery.data,
    carregandoStatus: statusQuery.isLoading,
    alternarEnabled: alternarEnabledMutation.mutateAsync,
    alternandoId: alternarEnabledMutation.variables?.id,
    atualizarFrequencia: atualizarFrequenciaMutation.mutateAsync,
    salvandoFrequencia: atualizarFrequenciaMutation.isPending,
    dispararTarefa: dispararTarefaMutation.mutateAsync,
    disparandoId: dispararTarefaMutation.variables,
  }
}
