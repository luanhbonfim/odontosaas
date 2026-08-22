import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Lock,
  DollarSign,
  Activity,
  PlusCircle,
  Database,
  Clock,
  ArrowRight,
  ShieldCheck,
  Server,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/common/status-badge'
import { BotaoVendorPrimario } from './ui/vendor-ui'
import { vendorApi } from './vendor-api-client'
import { VENDOR_BASE_PATH } from './constants'
import { ProvisionarTenantModal } from './tenants/provisionar-tenant-modal'

export type ClinicaItem = {
  id: number
  schema_name: string
  nome_fantasia: string
  razao_social: string
  cnpj: string
  ativo: boolean
  status_assinatura: string
  plano_assinatura: {
    id: number
    nome: string
    preco_mensal: number
  } | null
  vigencia_fim: string | null
  criado_em: string
}

export function VendorDashboardPage() {
  const { data: tenants, isLoading: carregandoTenants } = useQuery<ClinicaItem[]>({
    queryKey: ['vendor-tenants'],
    queryFn: async () => {
      const { data } = await vendorApi.get('/plataforma-admin/tenants/')
      return data
    },
  })

  const { data: statusCelery, isLoading: carregandoCelery } = useQuery({
    queryKey: ['vendor-celery-status'],
    queryFn: async () => {
      const { data } = await vendorApi.get('/plataforma-admin/celery/tarefas/status/')
      return data
    },
    refetchInterval: 15000,
  })

  const listaTenants = tenants || []
  const hoje = new Date().toISOString().split('T')[0]
  const data15Dias = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const totalClinicas = listaTenants.length
  const clinicasVencidas = listaTenants.filter((t) => t.vigencia_fim && t.vigencia_fim < hoje)
  const clinicasAVencer = listaTenants.filter(
    (t) => t.ativo && t.vigencia_fim && t.vigencia_fim >= hoje && t.vigencia_fim <= data15Dias
  )
  const clinicasBloqueadas = listaTenants.filter((t) => !t.ativo)
  const clinicasInadimplentes = listaTenants.filter((t) => t.status_assinatura === 'INADIMPLENTE')
  const clinicasAtivas = listaTenants.filter(
    (t) => t.ativo && (!t.vigencia_fim || t.vigencia_fim >= hoje) && (t.status_assinatura === 'ATIVA' || t.status_assinatura === 'TRIAL')
  ).length

  // MRR estimado somando mensalidade dos planos de clínicas ativas
  const mrrEstimado = listaTenants
    .filter((t) => t.ativo && (!t.vigencia_fim || t.vigencia_fim >= hoje) && t.status_assinatura === 'ATIVA' && t.plano_assinatura?.preco_mensal)
    .reduce((acc, t) => acc + Number(t.plano_assinatura?.preco_mensal || 0), 0)

  return (
    <div className="space-y-8 animate-fadeIn text-slate-100">
      {/* Welcome Banner Dark Navy */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-[#111D3B] border border-[#1E2D56] shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Visão Geral da Plataforma
            </h1>
            <ShieldCheck className="size-6 text-[#D4AF37]" />
          </div>
          <p className="text-sm text-slate-300">
            Painel consolidado de clínicas, faturamento, banco de dados e automações Celery.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ProvisionarTenantModal
            trigger={
              <BotaoVendorPrimario className="cursor-pointer">
                <PlusCircle className="size-4 mr-2" />
                Provisionar Clínica
              </BotaoVendorPrimario>
            }
          />
        </div>
      </div>

      {/* Banner de Alerta de Vencimentos e Atenção Comercial */}
      {(clinicasVencidas.length > 0 || clinicasAVencer.length > 0) && (
        <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-red-950/80 via-amber-950/70 to-[#111D3B] border border-amber-500/50 shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <AlertTriangle className="size-5 animate-pulse" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  Atenção Comercial: Vencimentos de Planos
                  {clinicasVencidas.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-600 text-white shadow-xs">
                      {clinicasVencidas.length} {clinicasVencidas.length === 1 ? 'VENCIDA' : 'VENCIDAS'}
                    </span>
                  )}
                  {clinicasAVencer.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-600 text-white shadow-xs">
                      {clinicasAVencer.length} A VENCER
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-300">
                  {clinicasVencidas.length > 0
                    ? `${clinicasVencidas.length} clínica(s) com vigência expirada sob bloqueio automático do sistema.`
                    : ''}{' '}
                  {clinicasAVencer.length > 0
                    ? `${clinicasAVencer.length} clínica(s) expiram nos próximos 15 dias.`
                    : ''}
                </p>
              </div>
            </div>

            <Button
              asChild
              size="sm"
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer shadow-sm"
            >
              <Link to={`${VENDOR_BASE_PATH}/tenants`}>
                Ver Clínicas <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </div>

          {/* Chips das Clínicas com Vencimento Próximo ou Expirado */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
            {[...clinicasVencidas, ...clinicasAVencer].slice(0, 6).map((c) => {
              const expirada = Boolean(c.vigencia_fim && c.vigencia_fim < hoje)
              return (
                <Link
                  key={c.id}
                  to={`${VENDOR_BASE_PATH}/tenants/${c.id}`}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs whitespace-nowrap transition-all hover:scale-102 ${
                    expirada
                      ? 'bg-red-950/70 border-red-700/80 text-red-200 hover:bg-red-900/80'
                      : 'bg-amber-950/60 border-amber-700/70 text-amber-200 hover:bg-amber-900/80'
                  }`}
                >
                  {expirada ? <Clock className="size-3 text-red-400" /> : <AlertTriangle className="size-3 text-amber-400" />}
                  <span className="font-semibold text-white">{c.nome_fantasia}</span>
                  <span className="text-[10px] opacity-80 font-mono">
                    {expirada
                      ? `Expirou em ${new Date(c.vigencia_fim + 'T12:00:00').toLocaleDateString('pt-BR')}`
                      : `Vence em ${new Date(c.vigencia_fim + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* KPI Cards Dark Navy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Clínicas */}
        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Clínicas
            </CardTitle>
            <Building2 className="size-4 text-[#D4AF37]" />
          </CardHeader>
          <CardContent>
            {carregandoTenants ? (
              <Skeleton className="h-8 w-20 bg-[#1A2A4E]" />
            ) : (
              <div className="text-2xl font-bold text-white tracking-tight">{totalClinicas}</div>
            )}
            <p className="text-[11px] text-slate-400 mt-1">Schemas provisionados</p>
          </CardContent>
        </Card>

        {/* Clínicas Ativas */}
        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Ativas
            </CardTitle>
            <CheckCircle2 className="size-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            {carregandoTenants ? (
              <Skeleton className="h-8 w-20 bg-[#1A2A4E]" />
            ) : (
              <div className="text-2xl font-bold text-emerald-400 tracking-tight">{clinicasAtivas}</div>
            )}
            <p className="text-[11px] text-slate-400 mt-1">Vigência ativa e regular</p>
          </CardContent>
        </Card>

        {/* A Vencer (Próximos 15 dias) */}
        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              A Vencer (15d)
            </CardTitle>
            <Clock className="size-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            {carregandoTenants ? (
              <Skeleton className="h-8 w-20 bg-[#1A2A4E]" />
            ) : (
              <div className="text-2xl font-bold text-amber-400 tracking-tight">{clinicasAVencer.length}</div>
            )}
            <p className="text-[11px] text-slate-400 mt-1">Próximas renovações</p>
          </CardContent>
        </Card>

        {/* Planos Vencidos */}
        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Planos Vencidos
            </CardTitle>
            <AlertCircle className="size-4 text-red-400" />
          </CardHeader>
          <CardContent>
            {carregandoTenants ? (
              <Skeleton className="h-8 w-20 bg-[#1A2A4E]" />
            ) : (
              <div className="text-2xl font-bold text-red-400 tracking-tight">{clinicasVencidas.length}</div>
            )}
            <p className="text-[11px] text-slate-400 mt-1">Vigência expirada</p>
          </CardContent>
        </Card>

        {/* Inadimplentes / Bloqueadas */}
        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Bloqueadas
            </CardTitle>
            <Lock className="size-4 text-red-400" />
          </CardHeader>
          <CardContent>
            {carregandoTenants ? (
              <Skeleton className="h-8 w-20 bg-[#1A2A4E]" />
            ) : (
              <div className="text-2xl font-bold text-red-400 tracking-tight">
                {clinicasBloqueadas.length + clinicasInadimplentes.length}
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-1">Sob bloqueio no middleware</p>
          </CardContent>
        </Card>

        {/* MRR Estimado */}
        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              MRR Estimado
            </CardTitle>
            <DollarSign className="size-4 text-[#D4AF37]" />
          </CardHeader>
          <CardContent>
            {carregandoTenants ? (
              <Skeleton className="h-8 w-24 bg-[#1A2A4E]" />
            ) : (
              <div className="text-xl font-bold text-white tracking-tight truncate">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mrrEstimado)}
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-1">Receita recorrente ativa</p>
          </CardContent>
        </Card>
      </div>

      {/* Cluster & Automation Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Celery Cluster & Redis */}
        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Server className="size-4 text-[#D4AF37]" />
              Saúde do Cluster
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Status do Redis Broker e workers Celery.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0B132B]/80 border border-[#1E2D56]">
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    statusCelery?.redis_conectado ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                  }`}
                />
                <span className="text-xs font-medium text-slate-200">Redis Broker</span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {statusCelery?.redis_conectado ? 'CONECTADO' : 'OFFLINE'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0B132B]/80 border border-[#1E2D56]">
              <div className="flex items-center gap-2.5">
                <Activity className="size-4 text-[#D4AF37]" />
                <span className="text-xs font-medium text-slate-200">Workers Celery</span>
              </div>
              <span className="text-xs font-semibold text-[#D4AF37]">
                {carregandoCelery ? '...' : `${statusCelery?.total_workers_online || 0} online`}
              </span>
            </div>

            <Button asChild className="w-full text-xs cursor-pointer bg-[#16254A] hover:bg-[#1E3364] border border-[#1E2D56] text-white shadow-xs">
              <Link to={`${VENDOR_BASE_PATH}/celery`}>
                <Clock className="size-3.5 mr-2 text-[#D4AF37]" />
                Ver Agendamentos do Beat
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Quick Tools */}
        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Zap className="size-4 text-[#D4AF37]" />
              Ferramentas de Sustentação
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Acesso rápido aos consoles operacionais do vendor.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              to={`${VENDOR_BASE_PATH}/studio`}
              className="p-4 rounded-xl bg-[#0B132B]/70 border border-[#1E2D56] hover:border-[#D4AF37]/50 hover:bg-[#132145] transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <Database className="size-5 text-[#D4AF37] group-hover:scale-110 transition-transform" />
                <ArrowRight className="size-4 text-slate-500 group-hover:text-[#D4AF37] transition-colors" />
              </div>
              <h3 className="text-sm font-semibold text-white">Database Studio</h3>
              <p className="text-xs text-slate-400 mt-1">
                Console SQL seguro sob role isolado <code className="text-[#D4AF37]">odonto_studio_ro</code>.
              </p>
            </Link>

            <Link
              to={`${VENDOR_BASE_PATH}/auditoria`}
              className="p-4 rounded-xl bg-[#0B132B]/70 border border-[#1E2D56] hover:border-[#D4AF37]/50 hover:bg-[#132145] transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <ShieldCheck className="size-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <ArrowRight className="size-4 text-slate-500 group-hover:text-[#D4AF37] transition-colors" />
              </div>
              <h3 className="text-sm font-semibold text-white">Trilha de Auditoria</h3>
              <p className="text-xs text-slate-400 mt-1">
                Histórico imutável de todas as ações executadas por operadores.
              </p>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Clinics Table */}
      <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-white">Clínicas Recentes</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Últimas instâncias provisionadas na plataforma.
            </CardDescription>
          </div>
          <Button asChild variant="ghost" className="text-[#D4AF37] hover:text-[#D4AF37]/80 hover:bg-transparent text-xs">
            <Link to={`${VENDOR_BASE_PATH}/tenants`}>
              Ver todas <ArrowRight className="size-3.5 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-400 border-b border-[#1E2D56] font-medium">
                <tr>
                  <th className="pb-3 px-2">Clínica</th>
                  <th className="pb-3 px-2">Schema</th>
                  <th className="pb-3 px-2">Plano</th>
                  <th className="pb-3 px-2">Status</th>
                  <th className="pb-3 px-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2D56]/60 text-slate-200">
                {listaTenants.slice(0, 5).map((t) => (
                  <tr key={t.id} className="hover:bg-[#152345]/50 transition-colors">
                    <td className="py-3 px-2 font-medium text-white">{t.nome_fantasia}</td>
                    <td className="py-3 px-2 font-mono text-[#D4AF37] text-[11px]">{t.schema_name}</td>
                    <td className="py-3 px-2 text-slate-300">{t.plano_assinatura?.nome || 'Sem Plano'}</td>
                    <td className="py-3 px-2">
                      {(() => {
                        const vencida = Boolean(t.vigencia_fim && t.vigencia_fim < hoje)
                        if (!t.ativo) {
                          return (
                            <StatusBadge variante="erro" className="bg-red-950/60 border-red-800 text-red-300">
                              BLOQUEADA
                            </StatusBadge>
                          )
                        }
                        if (vencida) {
                          return (
                            <StatusBadge variante="erro" className="bg-red-950/70 border-red-700 text-red-200">
                              VENCIDA
                            </StatusBadge>
                          )
                        }
                        if (t.status_assinatura === 'INADIMPLENTE') {
                          return (
                            <StatusBadge variante="erro" className="bg-red-950/50 border-red-800 text-red-300">
                              INADIMPLENTE
                            </StatusBadge>
                          )
                        }
                        if (t.status_assinatura === 'TRIAL') {
                          return (
                            <StatusBadge variante="pendente" className="bg-amber-950/50 border-amber-800 text-amber-300">
                              TRIAL
                            </StatusBadge>
                          )
                        }
                        return (
                          <StatusBadge variante="sucesso" className="bg-[#0B132B] border-[#1E2D56] text-emerald-300">
                            ATIVA
                          </StatusBadge>
                        )
                      })()}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <Button asChild variant="ghost" size="sm" className="text-xs text-[#D4AF37] hover:text-white hover:bg-[#1A2A4E] border border-transparent hover:border-[#1E2D56]">
                        <Link to={`${VENDOR_BASE_PATH}/tenants/${t.id}`}>Gerenciar</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {listaTenants.length === 0 && !carregandoTenants && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Nenhuma clínica cadastrada no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
