import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft,
  Building2,
  Globe,
  Shield,
  Calendar,
  MessageSquare,
  Activity,
  UserCheck,
  RefreshCw,
  Save,
  ShieldCheck,
  Clock,
  ExternalLink,
  XCircle,
  User,
  Users,
  CheckCircle2,
  AlertTriangle,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/common/status-badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { VENDOR_BASE_PATH } from '../constants'
import { urlDaClinica } from '../url-clinica'
import { mascararCnpj, mascararCpf, mascararTelefone } from '@/lib/utils/mascaras'
import { useVendorPlanos } from '../planos/use-vendor-planos'
import {
  type ErroOperacional,
  type RegistroAuditoria,
  useVendorTenantDetalhes,
  useAtualizarTenant,
  useRenovarTenant,
  useImpersonateTenant,
  useEncerrarSuporte,
  useGoogleParams,
  useWhatsAppParams,
  useTenantMetricas,
  useTenantErros,
  useTenantAuditoria,
  useTenantSuporte,
} from './use-vendor-tenants'

type AbaAtiva = 'geral' | 'assinatura' | 'google' | 'whatsapp' | 'metricas' | 'suporte' | 'auditoria'

// Schema para atualização de dados gerais e responsáveis
const schemaGeral = z.object({
  nome_fantasia: z.string().min(1, 'Nome fantasia obrigatório'),
  razao_social: z.string().optional(),
  cnpj: z.string().optional(),
  telefone: z.string().optional(),
  responsavel_nome: z.string().optional(),
  responsavel_cpf: z.string().optional(),
  responsavel_telefone: z.string().optional(),
  responsavel_email: z.string().optional(),
})

// Schema para atualização de assinatura e overrides
const schemaAssinatura = z.object({
  plano_assinatura: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
  vigencia_fim: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  override_limite_dentistas: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v))),
  override_limite_usuarios: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v))),
})

function formatarTelefoneWhatsApp(numero?: string): string {
  if (!numero) return 'Não pareado'
  const limpo = numero.replace(/\D/g, '')
  if (limpo.length === 13 && limpo.startsWith('55')) {
    return `+55 (${limpo.slice(2, 4)}) ${limpo.slice(4, 9)}-${limpo.slice(9)}`
  }
  if (limpo.length === 12 && limpo.startsWith('55')) {
    return `+55 (${limpo.slice(2, 4)}) ${limpo.slice(4, 8)}-${limpo.slice(8)}`
  }
  if (limpo.length === 11) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`
  }
  return numero
}

export function TenantDetalhesPage() {
  const { id } = useParams<{ id: string }>()
  const tenantId = Number(id)

  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('geral')

  // Modais de Ação Rápida
  const [modalImpersonate, setModalImpersonate] = useState(false)
  const [justificativaImpersonate, setJustificativaImpersonate] = useState('')
  const [acessandoPainel, setAcessandoPainel] = useState(false)

  // Queries e Mutations
  const { data: tenant, isLoading } = useVendorTenantDetalhes(tenantId)
  const { data: planos } = useVendorPlanos()
  const atualizar = useAtualizarTenant()
  const renovar = useRenovarTenant()
  const impersonate = useImpersonateTenant()
  const encerrarSuporte = useEncerrarSuporte()

  // Google & WhatsApp Hooks & Estados
  const google = useGoogleParams(tenantId)
  const whatsapp = useWhatsAppParams(tenantId)
  const { data: metricas, isLoading: carregandoMetricas } = useTenantMetricas(tenantId)
  const { data: erros, isLoading: carregandoErros } = useTenantErros(tenantId)
  const { data: auditoria = [], isLoading: carregandoAuditoria } = useTenantAuditoria(tenantId)
  const { data: suporteSessoes = [], isLoading: carregandoSuporte } = useTenantSuporte(tenantId)

  const [intervaloGoogle, setIntervaloGoogle] = useState<number>(15)
  const [reagendamentoMinutos, setReagendamentoMinutos] = useState<number>(1)
  const [simularDigitacao, setSimularDigitacao] = useState<boolean>(true)
  const [segundosDigitacao, setSegundosDigitacao] = useState<number>(4)

  // Sincroniza dados do Google e WhatsApp quando carregados da API
  useEffect(() => {
    if (google.data?.intervalo_minutos !== undefined) {
      setIntervaloGoogle(google.data.intervalo_minutos)
    }
  }, [google.data?.intervalo_minutos])

  useEffect(() => {
    if (whatsapp.data?.reagendamento_minutos !== undefined) {
      setReagendamentoMinutos(whatsapp.data.reagendamento_minutos)
    }
  }, [whatsapp.data?.reagendamento_minutos])

  useEffect(() => {
    if (whatsapp.data?.simular_digitacao !== undefined) {
      setSimularDigitacao(whatsapp.data.simular_digitacao)
    }
    if (whatsapp.data?.segundos_digitacao !== undefined) {
      setSegundosDigitacao(whatsapp.data.segundos_digitacao)
    }
  }, [whatsapp.data?.simular_digitacao, whatsapp.data?.segundos_digitacao])

  // Localiza a sessão ativa se houver
  const sessaoAtivaAtual = Array.isArray(suporteSessoes)
    ? suporteSessoes.find((r) => {
        if (r.detalhes?.encerrado_em) return false
        const dataInicio = new Date(r.criado_em).getTime()
        return dataInicio + 60 * 60 * 1000 > Date.now()
      })
    : null

  const temSessaoAtiva = Boolean(sessaoAtivaAtual)

  const horarioExpiracaoAtiva = sessaoAtivaAtual
    ? new Date(new Date(sessaoAtivaAtual.criado_em).getTime() + 60 * 60 * 1000).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  async function handleEncerrarSuporte(registroId?: number) {
    try {
      await encerrarSuporte.mutateAsync({ tenantId, registroId })
      toast.success(
        registroId
          ? 'Sessão de suporte encerrada com sucesso!'
          : 'Todas as sessões de suporte da clínica foram encerradas!'
      )
    } catch {
      toast.error('Falha ao encerrar sessão de suporte.')
    }
  }

  // Forms
  const formGeral = useForm({
    resolver: zodResolver(schemaGeral),
    defaultValues: {
      nome_fantasia: '',
      razao_social: '',
      cnpj: '',
      telefone: '',
      responsavel_nome: '',
      responsavel_cpf: '',
      responsavel_telefone: '',
      responsavel_email: '',
    },
  })

  const formAssinatura = useForm({
    resolver: zodResolver(schemaAssinatura),
    defaultValues: {
      plano_assinatura: null as number | null,
      vigencia_fim: '',
      override_limite_dentistas: null as number | null,
      override_limite_usuarios: null as number | null,
    },
  })

  // Sincroniza dados nos formulários
  useEffect(() => {
    if (tenant) {
      formGeral.reset({
        nome_fantasia: tenant.nome_fantasia,
        razao_social: tenant.razao_social || '',
        cnpj: tenant.cnpj || '',
        telefone: tenant.telefone || '',
        responsavel_nome: tenant.responsavel_nome || '',
        responsavel_cpf: tenant.responsavel_cpf || '',
        responsavel_telefone: tenant.responsavel_telefone || '',
        responsavel_email: tenant.responsavel_email || '',
      })
      formAssinatura.reset({
        plano_assinatura: tenant.plano_assinatura,
        vigencia_fim: tenant.vigencia_fim ? tenant.vigencia_fim.split('T')[0] : '',
        override_limite_dentistas: tenant.override_limite_dentistas,
        override_limite_usuarios: tenant.override_limite_usuarios,
      })
    }
  }, [tenant, formGeral, formAssinatura])

  if (isLoading) {
    return (
      <div className="space-y-6 text-slate-100 p-6 animate-pulse">
        <Skeleton className="h-10 w-64 bg-[#1A2A4E]" />
        <Skeleton className="h-96 w-full bg-[#111D3B]" />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="p-8 text-center text-slate-400 space-y-4">
        <p>Instância de clínica não encontrada.</p>
        <Button asChild variant="outline">
          <Link to={`${VENDOR_BASE_PATH}/tenants`}>Voltar à listagem</Link>
        </Button>
      </div>
    )
  }

  const dominioPrincipal =
    tenant.dominios?.find((d) => d.is_primary)?.domain ||
    tenant.dominios?.[0]?.domain ||
    `${tenant.schema_name}.localhost`

  const googleHabilitado = tenant.modulos_efetivos?.google_calendar ?? true
  const whatsappHabilitado = tenant.modulos_efetivos?.whatsapp ?? true

  // Submit dos Dados Gerais
  async function onSalvarGeral(dados: z.infer<typeof schemaGeral>) {
    try {
      await atualizar.mutateAsync({ id: tenantId, dados })
      toast.success('Dados cadastrais atualizados com sucesso.')
    } catch {
      toast.error('Erro ao atualizar dados cadastrais.')
    }
  }

  // Submit da Assinatura
  async function onSalvarAssinatura(dados: z.infer<typeof schemaAssinatura>) {
    try {
      await atualizar.mutateAsync({
        id: tenantId,
        dados: {
          plano_assinatura: dados.plano_assinatura || null,
          override_limite_dentistas:
            dados.override_limite_dentistas !== undefined && dados.override_limite_dentistas !== null
              ? Number(dados.override_limite_dentistas)
              : null,
          override_limite_usuarios:
            dados.override_limite_usuarios !== undefined && dados.override_limite_usuarios !== null
              ? Number(dados.override_limite_usuarios)
              : null,
        },
      })
      toast.success('Assinatura e limites atualizados com sucesso.')
    } catch (excecao: unknown) {
      const err = excecao as {
        response?: { data?: { detalhes?: string; erro?: string; mensagem?: string; detail?: string } }
        message?: string
      }
      const msg =
        err?.response?.data?.detalhes ||
        err?.response?.data?.mensagem ||
        err?.response?.data?.erro ||
        err?.response?.data?.detail ||
        'Erro ao salvar limites e assinatura.'
      toast.error(msg)
    }
  }



  // Executar Impersonate Read-Only
  async function handleImpersonate() {
    if (temSessaoAtiva) {
      toast.warning(
        `Já existe uma sessão de suporte ativa até às ${horarioExpiracaoAtiva}. Acesse a Aba 6 para utilizá-la ou encerrá-la.`
      )
      setModalImpersonate(false)
      setAbaAtiva('suporte')
      return
    }

    if (!justificativaImpersonate || justificativaImpersonate.trim().length < 5) {
      toast.error('Informe uma justificativa auditável (mínimo 5 caracteres).')
      return
    }
    try {
      const resp = await impersonate.mutateAsync({
        id: tenantId,
        justificativa: justificativaImpersonate.trim(),
      })
      const alvo = resp.usuario_impersonado || 'administrador da clínica'
      toast.success(`Sessão de suporte read-only gerada para ${alvo}!`)
      setModalImpersonate(false)
      setJustificativaImpersonate('')

      // Redireciona para o subdomínio do tenant abrindo em nova aba com os tokens de suporte
      const params = new URLSearchParams()
      params.set('impersonate_access', resp.access)
      if (resp.refresh) params.set('impersonate_refresh', resp.refresh)

      window.open(
        urlDaClinica(dominioPrincipal, `/login?${params.toString()}`),
        '_blank'
      )
    } catch (excecao: unknown) {
      const err = excecao as {
        response?: { data?: { detalhes?: string; erro?: string; mensagem?: string } }
        message?: string
      }
      const msg =
        err?.response?.data?.detalhes ||
        err?.response?.data?.mensagem ||
        err?.response?.data?.erro ||
        'Falha ao gerar sessão de impersonate.'
      toast.error(msg)
    }
  }

  async function handleAcessarPainelAtivo() {
    setAcessandoPainel(true)
    try {
      const resp = await impersonate.mutateAsync({
        id: tenantId,
        justificativa:
          sessaoAtivaAtual?.detalhes?.justificativa && typeof sessaoAtivaAtual.detalhes.justificativa === 'string'
            ? sessaoAtivaAtual.detalhes.justificativa
            : 'Reacesso à sessão de suporte ativa',
        reacesso: true,
      })
      const params = new URLSearchParams()
      params.set('impersonate_access', resp.access)
      if (resp.refresh) params.set('impersonate_refresh', resp.refresh)

      window.open(
        urlDaClinica(dominioPrincipal, `/login?${params.toString()}`),
        '_blank'
      )
    } catch {
      window.open(urlDaClinica(dominioPrincipal), '_blank')
    } finally {
      setAcessandoPainel(false)
    }
  }

  return (
    <div className="space-y-6 text-slate-100 animate-fadeIn">
      {/* Voltar e Header Principal */}
      <div className="space-y-4">
        <Link
          to={`${VENDOR_BASE_PATH}/tenants`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#D4AF37] transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Voltar para Lista de Clínicas
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-[#111D3B] border border-[#1E2D56] shadow-xl">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Building2 className="size-6 text-[#D4AF37]" />
              <h1 className="text-2xl font-bold text-white tracking-tight">{tenant.nome_fantasia}</h1>
              <span className="font-mono text-xs bg-[#0B132B] text-[#D4AF37] px-2 py-0.5 rounded border border-[#1E2D56]">
                {tenant.schema_name}
              </span>
              {(() => {
                const hoje = new Date().toISOString().split('T')[0]
                const vencida = Boolean(tenant.vigencia_fim && tenant.vigencia_fim < hoje)
                if (!tenant.ativo) {
                  return (
                    <StatusBadge variante="erro" className="bg-red-950/70 border-red-800 text-red-200 font-semibold">
                      BLOQUEADA
                    </StatusBadge>
                  )
                }
                if (vencida) {
                  return (
                    <StatusBadge variante="erro" className="bg-red-950/80 border-red-700 text-red-200 font-bold">
                      PLANO VENCIDO ({tenant.vigencia_fim ? new Date(tenant.vigencia_fim + 'T12:00:00').toLocaleDateString('pt-BR') : ''})
                    </StatusBadge>
                  )
                }
                if (tenant.status_assinatura === 'INADIMPLENTE') {
                  return (
                    <StatusBadge variante="erro" className="bg-red-950/50 border-red-800 text-red-300 font-semibold">
                      INADIMPLENTE
                    </StatusBadge>
                  )
                }
                if (tenant.status_assinatura === 'TRIAL') {
                  return (
                    <StatusBadge variante="pendente" className="bg-amber-950/50 border-amber-800 text-amber-300 font-semibold">
                      TRIAL
                    </StatusBadge>
                  )
                }
                return (
                  <StatusBadge variante="sucesso" className="bg-emerald-950/60 border-emerald-800 text-emerald-300 font-medium">
                    ATIVA
                  </StatusBadge>
                )
              })()}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>Criado em {new Date(tenant.criado_em).toLocaleDateString('pt-BR')}</span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Globe className="size-3 text-slate-500" />
                <a
                  href={urlDaClinica(dominioPrincipal)}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white underline decoration-slate-600"
                >
                  {dominioPrincipal}
                </a>
              </span>
            </p>
          </div>

          {/* Ações de Suporte e Acesso */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => setModalImpersonate(true)}
              className="bg-[#1A2A4E] hover:bg-[#253966] text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-semibold shadow-sm cursor-pointer"
            >
              <UserCheck className="size-3.5 mr-1.5" />
              Impersonate (Suporte RO)
            </Button>
          </div>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex items-center gap-1 border-b border-[#1E2D56] overflow-x-auto pb-px">
        {[
          { id: 'geral', rotulo: '1. Dados Gerais & Domínios', icone: Building2 },
          { id: 'assinatura', rotulo: '2. Assinatura & Overrides', icone: Shield },
          {
            id: 'google',
            rotulo: '3. Google Calendar',
            icone: Calendar,
            naoAplicavel: !googleHabilitado,
          },
          {
            id: 'whatsapp',
            rotulo: '4. WhatsApp (WAHA)',
            icone: MessageSquare,
            naoAplicavel: !whatsappHabilitado,
          },
          { id: 'metricas', rotulo: '5. Métricas & Erros', icone: Activity },
          { id: 'suporte', rotulo: '6. Suporte & Conexões', icone: UserCheck },
          { id: 'auditoria', rotulo: '7. Trilha de Auditoria (Logs)', icone: ShieldCheck },
        ].map((aba) => {
          const Icone = aba.icone
          const ativa = abaAtiva === aba.id
          return (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id as AbaAtiva)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                ativa
                  ? 'border-[#D4AF37] text-white bg-[#111D3B]/70 rounded-t-lg'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#111D3B]/30'
              } ${aba.naoAplicavel ? 'opacity-85' : ''}`}
            >
              <Icone className={`size-3.5 ${ativa ? 'text-[#D4AF37]' : 'text-slate-500'}`} />
              <span>{aba.rotulo}</span>
              {aba.naoAplicavel && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 uppercase tracking-tight">
                  Não Aplicável
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* CONTEÚDO DAS ABAS */}

      {/* ABA 1: Dados Gerais & Domínios */}
      {abaAtiva === 'geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100 lg:col-span-2 shadow-md">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white">Dados Cadastrais da Instância</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Informações cadastrais da pessoa jurídica e dados pessoais de contato do responsável assinante.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={formGeral.handleSubmit(onSalvarGeral)} className="space-y-6">
                {/* Seção Clínica (PJ) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="size-3.5" />
                    Dados da Clínica (Pessoa Jurídica)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="detalhes-nome" className="text-xs text-slate-200 font-medium">
                        Nome Fantasia *
                      </Label>
                      <Input
                        id="detalhes-nome"
                        {...formGeral.register('nome_fantasia')}
                        className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="detalhes-razao" className="text-xs text-slate-200 font-medium">
                        Razão Social
                      </Label>
                      <Input
                        id="detalhes-razao"
                        {...formGeral.register('razao_social')}
                        className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="detalhes-cnpj" className="text-xs text-slate-200 font-medium">
                        CNPJ
                      </Label>
                      <Input
                        id="detalhes-cnpj"
                        inputMode="numeric"
                        {...formGeral.register('cnpj', {
                          onChange: (e) => formGeral.setValue('cnpj', mascararCnpj(e.target.value)),
                        })}
                        placeholder="00.000.000/0000-00"
                        className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="detalhes-tel" className="text-xs text-slate-200 font-medium">
                        Telefone Institucional
                      </Label>
                      <Input
                        id="detalhes-tel"
                        inputMode="tel"
                        {...formGeral.register('telefone', {
                          onChange: (e) => formGeral.setValue('telefone', mascararTelefone(e.target.value)),
                        })}
                        placeholder="(00) 0000-0000"
                        className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Seção Responsável / Assinante */}
                <div className="space-y-3 pt-4 border-t border-[#1E2D56]/60">
                  <h3 className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5">
                    <User className="size-3.5" />
                    Dados Pessoais do Responsável / Assinante
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="resp-nome" className="text-xs text-slate-200 font-medium">
                        Nome Completo do Responsável
                      </Label>
                      <Input
                        id="resp-nome"
                        {...formGeral.register('responsavel_nome')}
                        placeholder="Ex.: Dr. Roberto Silva"
                        className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="resp-cpf" className="text-xs text-slate-200 font-medium">
                        CPF do Responsável
                      </Label>
                      <Input
                        id="resp-cpf"
                        inputMode="numeric"
                        {...formGeral.register('responsavel_cpf', {
                          onChange: (e) => formGeral.setValue('responsavel_cpf', mascararCpf(e.target.value)),
                        })}
                        placeholder="000.000.000-00"
                        className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="resp-tel" className="text-xs text-slate-200 font-medium">
                        Telefone / WhatsApp Pessoal
                      </Label>
                      <Input
                        id="resp-tel"
                        inputMode="tel"
                        {...formGeral.register('responsavel_telefone', {
                          onChange: (e) => formGeral.setValue('responsavel_telefone', mascararTelefone(e.target.value)),
                        })}
                        placeholder="(00) 00000-0000"
                        className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="resp-email" className="text-xs text-slate-200 font-medium">
                        E-mail de Contato
                      </Label>
                      <Input
                        id="resp-email"
                        type="email"
                        {...formGeral.register('responsavel_email')}
                        placeholder="doutor@email.com"
                        className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={atualizar.isPending}
                    className="bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 font-bold text-xs cursor-pointer shadow-md"
                  >
                    <Save className="size-3.5 mr-1.5" />
                    Salvar Dados Gerais
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Domínios Configurados */}
          <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100 shadow-md">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Globe className="size-4 text-[#D4AF37]" />
                Domínios de Acesso
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Hosts resolvidos pelo TenantMainMiddleware.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(tenant.dominios || []).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#0B132B]/80 border border-[#1E2D56]"
                >
                  <div className="overflow-hidden">
                    <p className="text-xs font-mono text-white truncate">{d.domain}</p>
                    <p className="text-[10px] text-slate-500">
                      {d.is_primary ? 'Domínio Primário' : 'Alias Adicional'}
                    </p>
                  </div>
                  {d.is_primary && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                      Primário
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA 2: Assinatura & Overrides */}
      {abaAtiva === 'assinatura' && (
        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100 shadow-md">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-white">Plano Comercial &amp; Vigência</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Configurações de limites e ciclo de faturamento deste tenant.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={formAssinatura.handleSubmit(onSalvarAssinatura)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="assinatura-plano" className="text-xs text-slate-200 font-medium">
                    Plano de Assinatura
                  </Label>
                  <select
                    id="assinatura-plano"
                    {...formAssinatura.register('plano_assinatura', {
                      setValueAs: (v) => (v === '' ? null : Number(v)),
                    })}
                    className="w-full h-9 rounded-md bg-[#0B132B] border border-[#1E2D56] px-3 py-1 text-xs text-white shadow-xs focus:outline-hidden"
                  >
                    <option value="" className="bg-[#0B132B] text-slate-400">Sem Plano Vinculado</option>
                    {planos?.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#0B132B] text-white">
                        {p.nome} (R$ {Number(p.preco_mensal).toFixed(2)}/mês [{p.periodicidade || 'MENSAL'}])
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200 font-medium flex items-center justify-between">
                    <span>Data Final da Vigência (Vencimento)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Calculada pelo Plano</span>
                  </Label>
                  <div className="h-9 rounded-md bg-[#0B132B]/80 border border-[#1E2D56] px-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-3.5 text-[#D4AF37]" />
                      <span className="font-mono text-white font-medium">
                        {tenant.vigencia_fim
                          ? new Date(`${tenant.vigencia_fim.split('T')[0]}T12:00:00`).toLocaleDateString('pt-BR')
                          : 'Sem expiração (Vitalício / Permanente)'}
                      </span>
                    </div>
                    {tenant.vigencia_fim && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          tenant.dias_restantes_vigencia !== null && tenant.dias_restantes_vigencia !== undefined && tenant.dias_restantes_vigencia < 0
                            ? 'bg-red-950/80 text-red-300 border border-red-800/80'
                            : tenant.dias_restantes_vigencia !== null && tenant.dias_restantes_vigencia !== undefined && tenant.dias_restantes_vigencia <= 15
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                        }`}
                      >
                        {tenant.dias_restantes_vigencia !== null && tenant.dias_restantes_vigencia !== undefined && tenant.dias_restantes_vigencia < 0
                          ? `Expirado há ${Math.abs(tenant.dias_restantes_vigencia)} dias`
                          : tenant.dias_restantes_vigencia === 0
                          ? 'Vence hoje'
                          : `${tenant.dias_restantes_vigencia} dias restantes`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Renovar assinatura: estende a vigência conforme a periodicidade do plano e reativa a clínica */}
              <Button
                type="button"
                onClick={async () => {
                  try {
                    await renovar.mutateAsync(tenantId)
                    toast.success('Assinatura renovada — vigência estendida e clínica reativada.')
                  } catch {
                    toast.error('Falha ao renovar a assinatura.')
                  }
                }}
                disabled={renovar.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {renovar.isPending ? 'Renovando…' : 'Renovar assinatura (estende a vigência)'}
              </Button>

              {/* Overrides de Limites */}
              <div className="p-4 rounded-lg bg-[#0B132B]/60 border border-[#1E2D56] space-y-4">
                <h3 className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider">
                  Overrides Manuais de Capacidade
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="override-dentistas" className="text-xs text-slate-200 font-medium">
                      Override: Limite de Dentistas
                    </Label>
                    <Input
                      id="override-dentistas"
                      type="number"
                      placeholder={`Herdado do plano (${tenant.limite_dentistas_efetivo})`}
                      {...formAssinatura.register('override_limite_dentistas')}
                      className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="override-usuarios" className="text-xs text-slate-200 font-medium">
                      Override: Limite de Usuários
                    </Label>
                    <Input
                      id="override-usuarios"
                      type="number"
                      placeholder={`Herdado do plano (${tenant.limite_usuarios_efetivo})`}
                      {...formAssinatura.register('override_limite_usuarios')}
                      className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={atualizar.isPending}
                  className="bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 font-bold text-xs cursor-pointer shadow-md"
                >
                  <Save className="size-3.5 mr-1.5" />
                  Salvar Assinatura &amp; Limites
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ABA 3: Google Calendar */}
      {abaAtiva === 'google' && (
        <div className="space-y-6">
          {!googleHabilitado && (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 flex items-start gap-3 shadow-md">
              <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-300">Módulo Não Aplicável / Desabilitado</h4>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  A sincronização com o Google Calendar não está inclusa no plano comercial contratado por esta clínica ({tenant.plano_nome || 'Sem plano'}). As rotinas de sincronização em segundo plano estão pausadas e as opções abaixo estão bloqueadas.
                </p>
              </div>
            </div>
          )}

          <Card className={`border-[#1E2D56] bg-[#111D3B] text-slate-100 shadow-md ${!googleHabilitado ? 'opacity-80' : ''}`}>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-blue-400" />
                  Sincronização Google Calendar
                </div>
                {!googleHabilitado && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                    NÃO APLICÁVEL
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Defina o intervalo global de sincronização bidirecional das agendas desta clínica.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-end gap-4">
                <div className="space-y-1.5 flex-1 max-w-xs">
                  <Label htmlFor="google-intervalo" className="text-xs text-slate-200 font-medium">
                    Intervalo de Sincronização (Minutos)
                  </Label>
                  <Input
                    id="google-intervalo"
                    type="number"
                    min={1}
                    max={1440}
                    value={intervaloGoogle}
                    onChange={(e) => setIntervaloGoogle(Number(e.target.value))}
                    disabled={!googleHabilitado}
                    className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <Button
                  onClick={async () => {
                    if (!googleHabilitado) return
                    try {
                      await google.salvar.mutateAsync({ intervalo_minutos: intervaloGoogle })
                      toast.success('Intervalo de sincronização atualizado com sucesso!')
                    } catch {
                      toast.error('Erro ao salvar intervalo do Google Calendar.')
                    }
                  }}
                  disabled={!googleHabilitado || google.salvar.isPending}
                  className={`font-bold text-xs shadow-md ${
                    !googleHabilitado
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                      : 'bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 cursor-pointer'
                  }`}
                >
                  <Save className="size-3.5 mr-1.5" />
                  Salvar Intervalo
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Visualização de Contas Google Vinculadas */}
          <Card className={`border-[#1E2D56] bg-[#111D3B] text-slate-100 shadow-md ${!googleHabilitado ? 'opacity-80' : ''}`}>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="size-4 text-[#D4AF37]" />
                Contas Google Vinculadas
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Profissionais e dentistas que conectaram sua conta Google para sincronização de consultas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {google.isLoading ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-10 w-full bg-[#1A2A4E]" />
                  <Skeleton className="h-10 w-full bg-[#1A2A4E]" />
                </div>
              ) : !google.data?.credenciais || google.data.credenciais.length === 0 ? (
                <div className="p-8 text-center rounded-lg bg-[#0B132B]/40 border border-[#1E2D56] text-slate-400">
                  <Calendar className="size-8 text-slate-500 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-medium">Nenhuma conta Google vinculada no momento.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Os dentistas podem conectar suas contas diretamente pelo painel da clínica em Integrações.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[#1E2D56]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B132B]/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-[#1E2D56]">
                      <tr>
                        <th className="px-4 py-3">Profissional / Dentista</th>
                        <th className="px-4 py-3">E-mail da Conta Google</th>
                        <th className="px-4 py-3">Token Google</th>
                        <th className="px-4 py-3">Push Watch (Webhook)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E2D56]/60">
                      {google.data.credenciais.map((c) => (
                        <tr key={c.id} className="hover:bg-[#1A2A4E]/30">
                          <td className="px-4 py-3 font-medium text-white">{c.dentista_nome}</td>
                          <td className="px-4 py-3 font-mono text-slate-200">
                            {c.calendar_id && c.calendar_id !== 'primary' ? (
                              <span className="text-[#D4AF37] font-semibold flex items-center gap-1.5">
                                <Globe className="size-3 text-slate-400" />
                                {c.calendar_id}
                              </span>
                            ) : (
                              <span className="text-slate-400">Conta Primária ({c.calendar_id || 'primary'})</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {c.token_valido ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                                <CheckCircle2 className="size-3" />
                                Conectado / Válido
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/60 border border-amber-800/60 text-amber-300">
                                <AlertTriangle className="size-3" />
                                Token Expirado
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {c.watch_ativo ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-950/60 border border-blue-800/60 text-blue-300">
                                Ativo (Push Google)
                              </span>
                            ) : c.token_valido ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 border border-slate-700 text-slate-300">
                                Polling Ativo (Sync Periódica)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                                Inativo
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA 4: WhatsApp WAHA */}
      {abaAtiva === 'whatsapp' && (
        <div className="space-y-6">
          {!whatsappHabilitado && (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 flex items-start gap-3 shadow-md">
              <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-300">Módulo Não Aplicável / Desabilitado</h4>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  O módulo de notificações e automações por WhatsApp não está incluso no plano comercial contratado por esta clínica ({tenant.plano_nome || 'Sem plano'}). Os disparos automáticos estão suspensos e as opções abaixo estão bloqueadas.
                </p>
              </div>
            </div>
          )}

          {/* Card de Status Informativo da Sessão WAHA */}
          <Card className={`border-[#1E2D56] bg-[#111D3B] text-slate-100 shadow-md ${!whatsappHabilitado ? 'opacity-80' : ''}`}>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <MessageSquare className="size-4 text-emerald-400" />
                  Sessão WAHA do Tenant (Visualização)
                  {!whatsappHabilitado && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 ml-2">
                      NÃO APLICÁVEL
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  Status operacional e identificação da instância de mensageria no servidor WAHA.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (!whatsappHabilitado) return
                  whatsapp.restart.mutate(undefined, {
                    onSuccess: () => toast.success('Comando de reinicialização da sessão WAHA executado!'),
                    onError: () => toast.error('Falha ao reiniciar sessão WAHA.'),
                  })
                }}
                disabled={!whatsappHabilitado || whatsapp.restart.isPending}
                className={`text-xs shadow-sm ${
                  !whatsappHabilitado
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                    : 'bg-[#1A2A4E] hover:bg-[#253966] text-emerald-300 border border-emerald-500/30 cursor-pointer'
                }`}
              >
                <RefreshCw className={`size-3.5 mr-1.5 ${whatsapp.restart.isPending ? 'animate-spin' : ''}`} />
                Reiniciar Sessão WAHA
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-[#0B132B]/80 border border-[#1E2D56]">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 uppercase font-medium">Nome da Sessão:</span>
                  <p className="text-xs font-mono font-bold text-white">
                    {whatsapp.data?.session_name || tenant.schema_name}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 uppercase font-medium">Status no WAHA:</span>
                  <div>
                    {!whatsappHabilitado ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-400">
                        Inativo / Não contratado
                      </span>
                    ) : whatsapp.data?.status_waha === 'WORKING' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                        <CheckCircle2 className="size-3" /> Conectado (WORKING)
                      </span>
                    ) : whatsapp.data?.status_waha === 'SCAN_QR_CODE' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 border border-amber-800/60 text-amber-300">
                        Aguardando QR Code
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-400">
                        {whatsapp.data?.status_waha || 'STOPPED'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 uppercase font-medium">Número Conectado:</span>
                  <p className="text-xs font-mono text-slate-200">
                    {formatarTelefoneWhatsApp(whatsapp.data?.numero_clinica)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card de Configuração Técnica do Vendor (Reagendamento) */}
          <Card className={`border-[#1E2D56] bg-[#111D3B] text-slate-100 shadow-md ${!whatsappHabilitado ? 'opacity-80' : ''}`}>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-[#D4AF37]" />
                  Tempo de Espera para Oferta de Reagendamento
                </div>
                {!whatsappHabilitado && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                    NÃO APLICÁVEL
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Atraso em minutos após o cancelamento ou solicitação para o Celery disparar automaticamente a mensagem de oferta de novos horários.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-end gap-4">
                <div className="space-y-1.5 flex-1 max-w-xs">
                  <Label htmlFor="waha-reagendamento" className="text-xs text-slate-200 font-medium">
                    Intervalo de Reagendamento (Minutos)
                  </Label>
                  <Input
                    id="waha-reagendamento"
                    type="number"
                    min={0}
                    max={1440}
                    value={reagendamentoMinutos}
                    onChange={(e) => setReagendamentoMinutos(Number(e.target.value))}
                    disabled={!whatsappHabilitado}
                    className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <Button
                  onClick={async () => {
                    if (!whatsappHabilitado) return
                    try {
                      await whatsapp.salvar.mutateAsync({ reagendamento_minutos: reagendamentoMinutos })
                      toast.success('Tempo de reagendamento salvo com sucesso!')
                    } catch {
                      toast.error('Erro ao salvar configuração de reagendamento.')
                    }
                  }}
                  disabled={!whatsappHabilitado || whatsapp.salvar.isPending}
                  className={`font-bold text-xs shadow-md ${
                    !whatsappHabilitado
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                      : 'bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 cursor-pointer'
                  }`}
                >
                  <Save className="size-3.5 mr-1.5" />
                  Salvar Intervalo de Reagendamento
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card: Simular digitação ("digitando…") antes de cada mensagem */}
          <Card className={`border-[#1E2D56] bg-[#111D3B] text-slate-100 shadow-md ${!whatsappHabilitado ? 'opacity-80' : ''}`}>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-[#D4AF37]" />
                  Simular Digitação ("digitando…")
                </div>
                {!whatsappHabilitado && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                    NÃO APLICÁVEL
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Antes de cada mensagem, o WhatsApp mostra "digitando…" ao paciente por alguns segundos, deixando o envio mais humano. Defina o tempo por clínica.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <label className="flex items-center gap-2 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    className="size-4 accent-[#D4AF37] cursor-pointer disabled:cursor-not-allowed"
                    checked={simularDigitacao}
                    disabled={!whatsappHabilitado}
                    onChange={(e) => setSimularDigitacao(e.target.checked)}
                  />
                  <span className="text-xs text-slate-200 font-medium">Ativar simulação de digitação</span>
                </label>

                <div className="flex flex-col sm:flex-row items-end gap-4">
                  <div className="space-y-1.5 flex-1 max-w-xs">
                    <Label htmlFor="waha-digitacao" className="text-xs text-slate-200 font-medium">
                      Tempo de digitação (segundos)
                    </Label>
                    <Input
                      id="waha-digitacao"
                      type="number"
                      min={0}
                      max={30}
                      value={segundosDigitacao}
                      onChange={(e) => setSegundosDigitacao(Number(e.target.value))}
                      disabled={!whatsappHabilitado || !simularDigitacao}
                      className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-[10px] text-slate-500">0–30s. Use 0 para não aguardar (efeito só visual).</p>
                  </div>
                  <Button
                    onClick={async () => {
                      if (!whatsappHabilitado) return
                      try {
                        await whatsapp.salvar.mutateAsync({
                          simular_digitacao: simularDigitacao,
                          segundos_digitacao: segundosDigitacao,
                        })
                        toast.success('Configuração de digitação salva com sucesso!')
                      } catch {
                        toast.error('Erro ao salvar a simulação de digitação.')
                      }
                    }}
                    disabled={!whatsappHabilitado || whatsapp.salvar.isPending}
                    className={`font-bold text-xs shadow-md ${
                      !whatsappHabilitado
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                        : 'bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 cursor-pointer'
                    }`}
                  >
                    <Save className="size-3.5 mr-1.5" />
                    Salvar Simulação de Digitação
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA 5: Métricas & Histórico de Erros */}
      {abaAtiva === 'metricas' && (
        <div className="space-y-6">
          {/* Grid de Volumetria */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { rotulo: 'Pacientes', valor: metricas ? (metricas.total_pacientes ?? 0) : 0 },
              { rotulo: 'Agendamentos', valor: metricas ? (metricas.total_agendamentos ?? 0) : 0 },
              { rotulo: 'Dentistas', valor: metricas ? (metricas.total_dentistas ?? 0) : 0 },
              { rotulo: 'Usuários', valor: metricas ? (metricas.total_usuarios ?? 0) : 0 },
              { rotulo: 'Procedimentos', valor: metricas ? (metricas.total_procedimentos ?? 0) : 0 },
              { rotulo: 'Lançamentos Fin.', valor: metricas ? (metricas.total_lancamentos ?? 0) : 0 },
            ].map((kpi, idx) => (
              <Card key={idx} className="border-[#1E2D56] bg-[#111D3B] p-3 text-center">
                <p className="text-[11px] text-slate-400 font-medium">{kpi.rotulo}</p>
                {carregandoMetricas ? (
                  <Skeleton className="h-7 w-12 mx-auto mt-1 bg-[#1A2A4E]" />
                ) : (
                  <p className="text-xl font-bold text-white mt-1">{kpi.valor}</p>
                )}
              </Card>
            ))}
          </div>

          {/* Tabela de Erros Operacionais */}
          <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="size-4 text-[#D4AF37]" />
                Histórico de Erros Operacionais Recentes
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Falhas capturadas automaticamente em rotinas em background e webhooks.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-slate-400 border-b border-[#1E2D56] bg-[#0B132B]/50 font-medium">
                    <tr>
                      <th className="py-2.5 px-4">Data / Hora</th>
                      <th className="py-2.5 px-4">Módulo</th>
                      <th className="py-2.5 px-4">Tipo do Erro</th>
                      <th className="py-2.5 px-4">Mensagem</th>
                      <th className="py-2.5 px-4">Origem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2D56]/60 text-slate-200">
                    {carregandoErros ? (
                      <tr>
                        <td colSpan={5} className="p-4">
                          <Skeleton className="h-6 w-full bg-[#1A2A4E]" />
                        </td>
                      </tr>
                    ) : (!Array.isArray(erros) || erros.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          Nenhum erro operacional registrado para esta clínica.
                        </td>
                      </tr>
                    ) : (
                      erros.map((err: ErroOperacional) => (
                        <tr key={err.id} className="hover:bg-[#152345]/50">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                            {new Date(err.criado_em).toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-[#D4AF37]">{err.modulo}</td>
                          <td className="py-2.5 px-4 font-mono text-red-400">{err.tipo_erro}</td>
                          <td className="py-2.5 px-4 max-w-xs truncate text-slate-300" title={err.mensagem}>
                            {err.mensagem}
                          </td>
                          <td className="py-2.5 px-4 text-slate-400">{err.origem}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA 6: Suporte & Conexões (Impersonate) */}
      {abaAtiva === 'suporte' && (
        <div className="space-y-4">
          <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <UserCheck className="size-4 text-[#D4AF37]" />
                  Sessões de Suporte Técnico (Impersonate)
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  Gere tokens de suporte temporários de 1 hora com proteção de leitura (Read-Only) para inspecionar e auditar o ambiente da clínica.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setModalImpersonate(true)}
                  className="bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 font-bold text-xs shadow-md cursor-pointer"
                >
                  <Plus className="size-3.5 mr-1.5" />
                  Nova Sessão de Suporte
                </Button>
              </div>
            </CardHeader>

            {/* Banner de Sessão Ativa em Destaque */}
            {temSessaoAtiva && sessaoAtivaAtual && (
              <div className="mx-6 mb-4 p-4 rounded-lg bg-amber-950/70 border border-amber-600/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      Sessão de Suporte Ativa no Momento
                    </span>
                  </div>
                  <p className="text-xs text-slate-200">
                    Operador: <strong className="text-white">{sessaoAtivaAtual.operador_email}</strong> • Expira às:{' '}
                    <strong className="text-amber-200">{horarioExpiracaoAtiva}</strong>
                  </p>
                  {Boolean(sessaoAtivaAtual.detalhes?.justificativa) && (
                    <p className="text-[11px] text-slate-300 italic">
                      &quot;{String(sessaoAtivaAtual.detalhes.justificativa)}&quot;
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    size="sm"
                    onClick={handleAcessarPainelAtivo}
                    disabled={acessandoPainel || impersonate.isPending}
                    className="flex-1 sm:flex-none h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer shadow-sm"
                  >
                    <ExternalLink className="size-3.5 mr-1.5" />
                    {acessandoPainel ? 'Acessando...' : 'Acessar Painel'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleEncerrarSuporte(sessaoAtivaAtual.id)}
                    disabled={encerrarSuporte.isPending}
                    className="flex-1 sm:flex-none h-8 text-xs bg-red-700 hover:bg-red-600 text-white font-semibold cursor-pointer shadow-sm"
                  >
                    <XCircle className="size-3.5 mr-1.5" />
                    Encerrar Sessão
                  </Button>
                </div>
              </div>
            )}

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-slate-400 border-b border-[#1E2D56] bg-[#0B132B]/50 font-medium">
                    <tr>
                      <th className="py-2.5 px-4">Início (Data / Hora)</th>
                      <th className="py-2.5 px-4">Operador</th>
                      <th className="py-2.5 px-4">Justificativa da Operação</th>
                      <th className="py-2.5 px-4">Encerramento / Expiração</th>
                      <th className="py-2.5 px-4">Status da Sessão</th>
                      <th className="py-2.5 px-4">Proteção</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2D56]/60 text-slate-200">
                    {carregandoSuporte ? (
                      <tr>
                        <td colSpan={6} className="p-4">
                          <Skeleton className="h-6 w-full bg-[#1A2A4E]" />
                        </td>
                      </tr>
                    ) : (!Array.isArray(suporteSessoes) || suporteSessoes.length === 0) ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Nenhuma sessão de suporte gerada para esta clínica até o momento.
                        </td>
                      </tr>
                    ) : (
                      suporteSessoes.map((reg: RegistroAuditoria) => {
                        const dataInicio = new Date(reg.criado_em)
                        const foiEncerradoManual = Boolean(reg.detalhes?.encerrado_em)
                        const dataEncerramentoManual = reg.detalhes?.encerrado_em
                          ? new Date(reg.detalhes.encerrado_em as string)
                          : null
                        const expiraEmDate = dataEncerramentoManual
                          ? dataEncerramentoManual
                          : reg.detalhes?.expira_em
                          ? new Date(reg.detalhes.expira_em as string)
                          : new Date(dataInicio.getTime() + 60 * 60 * 1000)

                        const isAtiva = !foiEncerradoManual && expiraEmDate.getTime() > Date.now()

                        const justificativaTexto =
                          typeof reg.detalhes?.justificativa === 'string' && reg.detalhes.justificativa.trim()
                            ? reg.detalhes.justificativa
                            : 'Acesso de suporte para diagnóstico e inspeção'

                        return (
                          <tr key={reg.id} className="hover:bg-[#152345]/50">
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                              {dataInicio.toLocaleString('pt-BR')}
                            </td>
                            <td className="py-3 px-4 font-mono text-white font-medium">{reg.operador_email}</td>
                            <td className="py-3 px-4 max-w-sm text-slate-200">
                              <span className="font-medium text-white">{justificativaTexto}</span>
                              {Boolean(reg.detalhes?.usuario_alvo) && (
                                <span className="block text-[10px] text-slate-400 mt-0.5">
                                  Usuário alvo: {String(reg.detalhes.usuario_alvo)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Clock className="size-3 text-slate-500" />
                                <span>{expiraEmDate.toLocaleString('pt-BR')}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {isAtiva ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950/70 px-2 py-0.5 rounded border border-amber-700/60 shadow-xs">
                                  <span className="size-1.5 rounded-full bg-amber-400 animate-ping" />
                                  Ativa (Expira às {expiraEmDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})
                                </span>
                              ) : foiEncerradoManual ? (
                                <span className="text-[10px] font-medium text-red-300 bg-red-950/40 px-2 py-0.5 rounded border border-red-900/50">
                                  Encerrada Manualmente
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400 bg-[#0B132B] px-2 py-0.5 rounded border border-[#1E2D56]">
                                  Expirada / Concluída
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                title="ImpersonateReadOnlyMiddleware bloqueia POST, PUT, PATCH e DELETE com HTTP 403 Forbidden"
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40"
                              >
                                <ShieldCheck className="size-3" />
                                Bloqueio Ativo (Read-Only)
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA 7: Trilha de Auditoria (Logs) */}
      {abaAtiva === 'auditoria' && (
        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="size-4 text-[#D4AF37]" />
              Trilha de Auditoria de Modificações (Logs)
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Histórico auditável completo de ações administrativas, alterações de plano, parâmetros, bloqueios e dados cadastrais.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-slate-400 border-b border-[#1E2D56] bg-[#0B132B]/50 font-medium">
                  <tr>
                    <th className="py-2.5 px-4">Data / Hora</th>
                    <th className="py-2.5 px-4">Operador</th>
                    <th className="py-2.5 px-4">Ação Efetuada</th>
                    <th className="py-2.5 px-4">Dado / Campo Alterado</th>
                    <th className="py-2.5 px-4">Valor Anterior</th>
                    <th className="py-2.5 px-4">Valor Atual (Novo)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2D56]/60 text-slate-200">
                  {carregandoAuditoria ? (
                    <tr>
                      <td colSpan={6} className="p-4">
                        <Skeleton className="h-6 w-full bg-[#1A2A4E]" />
                      </td>
                    </tr>
                  ) : (!Array.isArray(auditoria) || auditoria.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Nenhum registro de log de auditoria encontrado para esta clínica.
                      </td>
                    </tr>
                  ) : (
                    auditoria.map((reg: RegistroAuditoria) => {
                      const dataRegistro = new Date(reg.criado_em)
                      const d = (reg.detalhes as Record<string, unknown>) || {}

                      // Análise de Campos e Valores
                      const camposArr = Array.isArray(d.campos_alterados)
                        ? (d.campos_alterados as string[])
                        : typeof d.campo_alterado === 'string'
                        ? [d.campo_alterado]
                        : []

                      const anteriores = (d.valores_anteriores as Record<string, unknown>) || {}
                      const novos = (d.valores_novos as Record<string, unknown>) || {}

                      const camposChaves = Array.from(
                        new Set([...Object.keys(anteriores), ...Object.keys(novos), ...camposArr])
                      )

                      return (
                        <tr key={reg.id} className="hover:bg-[#152345]/50">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {dataRegistro.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-white font-medium block">{reg.operador_email}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1A2A4E] text-[#D4AF37] border border-[#D4AF37]/30">
                              {reg.acao_display || reg.acao}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {camposChaves.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {camposChaves.map((k) => (
                                  <span
                                    key={k}
                                    className="px-1.5 py-0.5 rounded bg-[#0B132B] border border-[#1E2D56] text-[10px] font-mono text-slate-200"
                                  >
                                    {k}
                                  </span>
                                ))}
                              </div>
                            ) : d.task ? (
                              <span className="font-mono text-[11px] text-slate-200">Tarefa Celery</span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {Object.keys(anteriores).length > 0 ? (
                              <div className="space-y-0.5">
                                {camposChaves.map((k) => {
                                  const v = anteriores[k]
                                  return (
                                    <div key={k} className="text-[11px] font-mono text-red-300">
                                      <span className="text-slate-400 font-sans text-[10px]">{k}: </span>
                                      {v !== undefined && v !== null ? String(v) : 'null'}
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {Object.keys(novos).length > 0 ? (
                              <div className="space-y-0.5">
                                {camposChaves.map((k) => {
                                  const v = novos[k]
                                  return (
                                    <div key={k} className="text-[11px] font-mono text-emerald-300 font-semibold">
                                      <span className="text-slate-400 font-sans text-[10px]">{k}: </span>
                                      {v !== undefined && v !== null ? String(v) : 'null'}
                                    </div>
                                  )
                                })}
                              </div>
                            ) : d.task ? (
                              <span className="font-mono text-emerald-300 text-[11px]">{String(d.task)}</span>
                            ) : camposArr.length > 0 ? (
                              <span className="text-emerald-400 text-[11px]">Atualizado</span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}



      {/* MODAL IMPERSONATE READ-ONLY */}
      <Dialog open={modalImpersonate} onOpenChange={setModalImpersonate}>
        <DialogContent className="dark bg-[#111D3B] border-[#1E2D56] text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <UserCheck className="size-5 text-[#D4AF37]" />
              Sessão de Suporte Técnico (Impersonate Read-Only)
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-xs">
              Gera um token de acesso de 1 hora para diagnosticar o ambiente da clínica{' '}
              <strong className="text-white">{tenant.nome_fantasia}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {temSessaoAtiva && (
              <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-800/80 text-xs text-amber-200 space-y-1.5">
                <p className="font-semibold text-amber-300">⚠️ Já existe uma sessão de suporte ativa:</p>
                <p className="text-slate-300">
                  Esta clínica possui uma sessão ativa até às <strong>{horarioExpiracaoAtiva}</strong>. Encerre-a na Aba 6 antes de iniciar uma nova.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setModalImpersonate(false)
                    setAbaAtiva('suporte')
                  }}
                  className="h-7 text-[11px] bg-amber-900/40 border-amber-700/60 text-amber-200 hover:bg-amber-800/60 cursor-pointer"
                >
                  Ir para Aba 6 (Suporte & Conexões)
                </Button>
              </div>
            )}

            <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-900/50 text-xs text-blue-200 space-y-1">
              <p className="font-semibold text-white">Como funciona a proteção:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                <li>A sessão é aberta com banner superior de alerta fixo.</li>
                <li>Qualquer tentativa de mutação (criação, edição, exclusão) é bloqueada com HTTP 403 pelo servidor.</li>
                <li>A sessão expira automaticamente em 1 hora ou pode ser encerrada a qualquer momento.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="impersonate-just" className="text-xs text-slate-200">
                Justificativa Auditável Obrigatória:
              </Label>
              <Input
                id="impersonate-just"
                value={justificativaImpersonate}
                onChange={(e) => setJustificativaImpersonate(e.target.value)}
                placeholder="Ex: Chamado #4829 — Diagnóstico de agendamento duplicado"
                disabled={temSessaoAtiva}
                className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:justify-end border-t border-[#1E2D56] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalImpersonate(false)}
              className="border-[#1E2D56] text-slate-300 hover:bg-[#1A2A4E]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleImpersonate}
              disabled={impersonate.isPending || temSessaoAtiva || justificativaImpersonate.trim().length < 5}
              className="bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 font-bold"
            >
              Iniciar Sessão de Suporte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
