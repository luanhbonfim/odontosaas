import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type ConfiguracaoNotificacao = components['schemas']['ConfiguracaoNotificacao']
export type TemplateMensagem = components['schemas']['TemplateMensagem']
export type LogNotificacao = components['schemas']['LogNotificacao']

export type ConfigEntrada = {
  dias_antecedencia: number
  horario_envio: string
  enviar_agradecimento: boolean
  enviar_reagendamento: boolean
  reagendamento_minutos: number
  enviar_cancelamento: boolean
  cancelar_nao_confirmadas: boolean
  cancelar_horas_antes: number
  reforcar_confirmacao: boolean
  mensagem_reforco: string
  ativo: boolean
}
export type TemplateEntrada = {
  tipo: string
  corpo: string
  ativo: boolean
  lembrete_tipo?: string
  procedimento?: number | null
  intervalo_meses?: number | null
  horas_antes?: number | null
}

// --- Configuração (uma por clínica) ---
export function useConfiguracao() {
  return useQuery({
    queryKey: ['notificacoes', 'config'],
    queryFn: async () =>
      (await api.get<ConfiguracaoNotificacao[]>('/config-notificacao/')).data[0] ?? null,
  })
}

export function useSalvarConfiguracao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: number; dados: ConfigEntrada }) =>
      id
        ? (await api.patch<ConfiguracaoNotificacao>(`/config-notificacao/${id}/`, dados)).data
        : (await api.post<ConfiguracaoNotificacao>('/config-notificacao/', dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificacoes', 'config'] }),
  })
}

// --- Templates ---
export function useTemplates() {
  return useQuery({
    queryKey: ['notificacoes', 'templates'],
    queryFn: async () => (await api.get<TemplateMensagem[]>('/templates-mensagem/')).data,
  })
}

export function useSalvarTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: number; dados: TemplateEntrada }) =>
      id
        ? (await api.patch<TemplateMensagem>(`/templates-mensagem/${id}/`, dados)).data
        : (await api.post<TemplateMensagem>('/templates-mensagem/', dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificacoes', 'templates'] }),
  })
}

/** Liga/desliga um template (PATCH só do `ativo`). */
export function useAlternarTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) =>
      (await api.patch<TemplateMensagem>(`/templates-mensagem/${id}/`, { ativo })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notificacoes', 'templates'] })
      // A trava do agradecimento depende do estado do template -> revalida a config.
      qc.invalidateQueries({ queryKey: ['notificacoes', 'config'] })
    },
  })
}

export function useRemoverTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/templates-mensagem/${id}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificacoes', 'templates'] }),
  })
}

// --- Fila (projeção do que ainda vai sair) ---
export type FilaItem = {
  tipo: string
  lembrete_tipo?: string
  consulta: number
  paciente_nome: string
  consulta_inicio: string
  previsto_para: string
  atrasado?: boolean
  telefone_ok: boolean
}

/** Mensagens automáticas que ainda vão ser enviadas (confirmações + avisos). */
export function useFila() {
  return useQuery({
    queryKey: ['notificacoes', 'fila'],
    queryFn: async () => (await api.get<FilaItem[]>('/logs-notificacao/fila/')).data,
    refetchInterval: 30_000,
  })
}

// --- Histórico ---
export type FiltrosLog = { direcao?: string; status?: string }

export function useLogs(filtros: FiltrosLog = {}) {
  return useQuery({
    queryKey: ['notificacoes', 'logs', filtros],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (filtros.direcao) params.direcao = filtros.direcao
      if (filtros.status) params.status = filtros.status
      return (await api.get<LogNotificacao[]>('/logs-notificacao/', { params })).data
    },
  })
}

// --- Conexão do WhatsApp (WAHA) — pareamento por QR no app ---
export type StatusWhatsapp = {
  session: string
  status: string
  conectado: boolean
  numero: string | null
}

const CHAVE_WA = ['notificacoes', 'whatsapp', 'status']

/** Status da conexão; faz polling enquanto está iniciando/aguardando o QR. */
export function useWhatsappStatus() {
  return useQuery({
    queryKey: CHAVE_WA,
    queryFn: async () => (await api.get<StatusWhatsapp>('/config-notificacao/whatsapp/')).data,
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return s === 'SCAN_QR_CODE' || s === 'STARTING' ? 3000 : false
    },
  })
}

/** QR de pareamento (data URI). Só busca quando `ativo` e revalida (o QR expira). */
export function useQrWhatsapp(ativo: boolean) {
  return useQuery({
    queryKey: ['notificacoes', 'whatsapp', 'qr'],
    queryFn: async () =>
      (await api.get<{ qr: string }>('/config-notificacao/whatsapp-qr/')).data.qr,
    enabled: ativo,
    refetchInterval: ativo ? 20000 : false,
    retry: false,
  })
}

export function useConectarWhatsapp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      (await api.post<{ status: string }>('/config-notificacao/whatsapp-conectar/', {})).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_WA }),
  })
}

export function useDesconectarWhatsapp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => (await api.post('/config-notificacao/whatsapp-desconectar/', {})).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_WA }),
  })
}

/** Envia/reenvia o pedido de confirmação de uma consulta. */
export function useEnviarConfirmacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (consulta: number) =>
      (await api.post<LogNotificacao>('/logs-notificacao/enviar-confirmacao/', { consulta })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificacoes', 'logs'] }),
  })
}
