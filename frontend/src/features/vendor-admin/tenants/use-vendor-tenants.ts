import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { vendorApi } from '../vendor-api-client'

export type DominioItem = {
  id: number
  domain: string
  is_primary: boolean
}

export type ClinicaListItem = {
  id: number
  schema_name: string
  nome_fantasia: string
  razao_social: string
  cnpj: string | null
  telefone: string
  responsavel_nome?: string
  responsavel_cpf?: string
  responsavel_telefone?: string
  responsavel_email?: string | null
  plano_assinatura: number | null
  plano_nome: string
  status_assinatura: 'ATIVA' | 'TRIAL' | 'INADIMPLENTE' | 'CANCELADA'
  status_efetivo?: 'ATIVA' | 'TRIAL' | 'INADIMPLENTE' | 'CANCELADA' | 'VENCIDA' | 'BLOQUEADA'
  vigencia_fim?: string | null
  dias_restantes_vigencia?: number | null
  ativo: boolean
  criado_em: string
  dominios: DominioItem[]
  limite_dentistas_efetivo: number
  limite_usuarios_efetivo: number
  modulos_efetivos?: {
    google_calendar: boolean
    sync_google?: boolean
    whatsapp: boolean
    whatsapp_waha?: boolean
    financeiro: boolean
    estoque: boolean
    [chave: string]: boolean | undefined
  }
}

export type ClinicaDetailItem = ClinicaListItem & {
  gateway_customer_id: string | null
  gateway_subscription_id: string | null
  vigencia_fim: string | null
  dias_restantes_vigencia?: number | null
  override_limite_dentistas: number | null
  override_limite_usuarios: number | null
  override_recursos: Record<string, unknown>
}

export type ProvisionarTenantInput = {
  schema_name: string
  nome_fantasia: string
  dominio: string
  plano_id: number
  razao_social?: string
  cnpj?: string | null
  responsavel_nome?: string
  responsavel_cpf?: string
  responsavel_telefone?: string
  responsavel_email?: string | null
  data_inicio_contrato?: string | null
  vigencia_fim?: string | null
  admin_email?: string | null
  admin_senha?: string | null
}

export type AlternarStatusInput = {
  ativo?: boolean
  status_assinatura?: 'ATIVA' | 'TRIAL' | 'INADIMPLENTE' | 'CANCELADA'
  justificativa?: string
}

export type GoogleCredencial = {
  id: number
  dentista_id: number | null
  dentista_nome: string
  calendar_id: string
  token_valido: boolean
  watch_ativo: boolean
}

export type GoogleParams = {
  intervalo_minutos: number
  ultima_sincronizacao: string | null
  credenciais: GoogleCredencial[]
}

export type WhatsAppParams = {
  session_name: string
  status_waha: string
  numero_clinica: string
  dias_antecedencia: number
  horario_envio: string
  cancelar_nao_confirmadas: boolean
  cancelar_horas_antes: number
  reforcar_confirmacao: boolean
  mensagem_reforco: string
  enviar_agradecimento: boolean
  enviar_reagendamento: boolean
  reagendamento_minutos: number
  enviar_cancelamento: boolean
  simular_digitacao: boolean
  segundos_digitacao: number
}

export type MetricasOperacionais = {
  total_pacientes: number
  total_agendamentos: number
  total_dentistas: number
  total_usuarios: number
  total_procedimentos: number
  total_lancamentos: number
  storage_usado_mb: number
  ultimo_agendamento: string | null
  ultimo_login: string | null
}

export type ErroOperacional = {
  id: number
  modulo: string
  tipo_erro: string
  mensagem: string
  origem: string
  criado_em: string
}

const CHAVE_TENANTS = ['vendor-tenants']

export function useVendorTenants(filtro?: { busca?: string; status?: string; plano?: string }) {
  return useQuery<ClinicaListItem[]>({
    queryKey: [...CHAVE_TENANTS, filtro],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (filtro?.busca) params.search = filtro.busca
      if (filtro?.status && filtro.status !== 'TODOS') params.status_assinatura = filtro.status
      if (filtro?.plano && filtro.plano !== 'TODOS') params.plano = filtro.plano
      const { data } = await vendorApi.get('/plataforma-admin/tenants/', { params })
      return data
    },
  })
}

export function useVendorTenantDetalhes(id: number) {
  return useQuery<ClinicaDetailItem>({
    queryKey: [...CHAVE_TENANTS, id],
    queryFn: async () => {
      const { data } = await vendorApi.get(`/plataforma-admin/tenants/${id}/`)
      return data
    },
    enabled: Boolean(id),
  })
}

export function useProvisionarTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dados: ProvisionarTenantInput) => {
      const { data } = await vendorApi.post('/plataforma-admin/tenants/provisionar/', dados)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVE_TENANTS })
    },
  })
}

export function useAtualizarTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<ClinicaDetailItem> }) => {
      const { data } = await vendorApi.patch(`/plataforma-admin/tenants/${id}/`, dados)
      return data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: CHAVE_TENANTS })
      queryClient.invalidateQueries({ queryKey: [...CHAVE_TENANTS, id] })
    },
  })
}

export function useAlternarStatusTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: AlternarStatusInput }) => {
      const { data } = await vendorApi.post(`/plataforma-admin/tenants/${id}/alternar_status/`, dados)
      return data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: CHAVE_TENANTS })
      queryClient.invalidateQueries({ queryKey: [...CHAVE_TENANTS, id] })
    },
  })
}

/** Renova a vigência da clínica (conforme a periodicidade do plano) e a reativa. */
export function useRenovarTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await vendorApi.post(`/plataforma-admin/tenants/${id}/renovar/`)
      return data
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: CHAVE_TENANTS })
      queryClient.invalidateQueries({ queryKey: [...CHAVE_TENANTS, id] })
    },
  })
}

export function useExpurgarTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      confirmacao_schema,
      justificativa,
    }: {
      id: number
      confirmacao_schema: string
      justificativa: string
    }) => {
      const { data } = await vendorApi.post(`/plataforma-admin/tenants/${id}/expurgar/`, {
        confirmacao_schema,
        justificativa,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVE_TENANTS })
    },
  })
}

export function useResetAdminSenha() {
  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id: number
      dados: { novo_email?: string; nova_senha?: string }
    }) => {
      const { data } = await vendorApi.post(`/plataforma-admin/tenants/${id}/reset_admin_senha/`, dados)
      return data
    },
  })
}

export function useImpersonateTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      justificativa,
      user_id,
      email,
      reacesso,
    }: {
      id: number
      justificativa: string
      user_id?: number
      email?: string
      reacesso?: boolean
    }) => {
      const { data } = await vendorApi.post(`/plataforma-admin/tenants/${id}/impersonate/`, {
        justificativa,
        user_id,
        email,
        reacesso,
      })
      return data as {
        access: string
        refresh?: string
        usuario_impersonado: string
        read_only: boolean
        dominio?: string
        expires_in_seconds?: number
      }
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-tenant-suporte', id] })
      queryClient.invalidateQueries({ queryKey: ['vendor-tenant-auditoria', id] })
      queryClient.invalidateQueries({ queryKey: [...CHAVE_TENANTS, id] })
      queryClient.invalidateQueries({ queryKey: CHAVE_TENANTS })
    },
  })
}

export function useGoogleParams(tenantId: number) {
  const queryClient = useQueryClient()
  const query = useQuery<GoogleParams>({
    queryKey: ['vendor-tenant-google', tenantId],
    queryFn: async () => {
      const { data } = await vendorApi.get(`/plataforma-admin/tenants/${tenantId}/google/`)
      return data
    },
    enabled: Boolean(tenantId),
  })

  const salvar = useMutation({
    mutationFn: async (dados: { intervalo_minutos: number }) => {
      const { data } = await vendorApi.patch(`/plataforma-admin/tenants/${tenantId}/google/`, dados)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-tenant-google', tenantId] })
    },
  })

  return { ...query, salvar }
}

export function useWhatsAppParams(tenantId: number) {
  const queryClient = useQueryClient()
  const query = useQuery<WhatsAppParams>({
    queryKey: ['vendor-tenant-whatsapp', tenantId],
    queryFn: async () => {
      const { data } = await vendorApi.get(`/plataforma-admin/tenants/${tenantId}/whatsapp/`)
      return data
    },
    enabled: Boolean(tenantId),
  })

  const salvar = useMutation({
    mutationFn: async (dados: Partial<WhatsAppParams>) => {
      const { data } = await vendorApi.patch(`/plataforma-admin/tenants/${tenantId}/whatsapp/`, dados)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-tenant-whatsapp', tenantId] })
    },
  })

  const restart = useMutation({
    mutationFn: async () => {
      const { data } = await vendorApi.post(`/plataforma-admin/tenants/${tenantId}/whatsapp/reiniciar-sessao/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-tenant-whatsapp', tenantId] })
    },
  })

  return { ...query, salvar, restart }
}

export function useTenantMetricas(tenantId: number) {
  return useQuery<MetricasOperacionais>({
    queryKey: ['vendor-tenant-metricas', tenantId],
    queryFn: async () => {
      const { data } = await vendorApi.get(`/plataforma-admin/tenants/${tenantId}/metricas/`)
      return data
    },
    enabled: Boolean(tenantId),
    refetchOnWindowFocus: true,
    refetchInterval: 4000,
  })
}

export function useTenantErros(tenantId: number) {
  return useQuery<ErroOperacional[]>({
    queryKey: ['vendor-tenant-erros', tenantId],
    queryFn: async () => {
      const { data } = await vendorApi.get(`/plataforma-admin/tenants/${tenantId}/erros/`)
      return Array.isArray(data) ? data : data?.results || []
    },
    enabled: Boolean(tenantId),
    refetchOnWindowFocus: true,
    refetchInterval: 4000,
  })
}

export type RegistroAuditoria = {
  id: number
  operador_email: string
  ip_origem: string | null
  acao: string
  acao_display: string
  schema_alvo: string
  detalhes: Record<string, unknown>
  criado_em: string
}

export function useTenantAuditoria(tenantId: number) {
  return useQuery<RegistroAuditoria[]>({
    queryKey: ['vendor-tenant-auditoria', tenantId],
    queryFn: async () => {
      const { data } = await vendorApi.get(`/plataforma-admin/tenants/${tenantId}/auditoria/`)
      return data
    },
    enabled: Boolean(tenantId),
    refetchOnWindowFocus: true,
  })
}

export function useTenantSuporte(tenantId: number) {
  return useQuery<RegistroAuditoria[]>({
    queryKey: ['vendor-tenant-suporte', tenantId],
    queryFn: async () => {
      const { data } = await vendorApi.get(`/plataforma-admin/tenants/${tenantId}/suporte/`)
      return data
    },
    enabled: Boolean(tenantId),
    refetchOnWindowFocus: true,
    refetchInterval: 3000,
  })
}

export function useEncerrarSuporte() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: number | { tenantId: number; registroId?: number }) => {
      const tenantId = typeof args === 'number' ? args : args.tenantId
      const registroId = typeof args === 'object' ? args.registroId : undefined
      const { data } = await vendorApi.post(`/plataforma-admin/tenants/${tenantId}/encerrar_suporte/`, {
        registro_id: registroId,
      })
      return data
    },
    onSuccess: (_, args) => {
      const tenantId = typeof args === 'number' ? args : args.tenantId
      queryClient.invalidateQueries({ queryKey: ['vendor-tenant-suporte', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['vendor-tenant-auditoria', tenantId] })
      queryClient.invalidateQueries({ queryKey: [...CHAVE_TENANTS, tenantId] })
      queryClient.invalidateQueries({ queryKey: CHAVE_TENANTS })
    },
  })
}



