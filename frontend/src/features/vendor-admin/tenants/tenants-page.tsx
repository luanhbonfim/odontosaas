import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Lock,
  Globe,
  SlidersHorizontal,
  Trash2,
  ExternalLink,
  ChevronRight,
  Clock,
} from 'lucide-react'
import { urlDaClinica } from '../url-clinica'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/common/status-badge'
import { classeCampoSelect } from '@/components/common/form-kit'
import { BotaoVendorPrimario } from '../ui/vendor-ui'
import { VENDOR_BASE_PATH } from '../constants'
import {
  type ClinicaListItem,
  useVendorTenants,
} from './use-vendor-tenants'
import { ProvisionarTenantModal } from './provisionar-tenant-modal'
import { AlternarStatusDialog } from './alternar-status-dialog'
import { ExpurgarTenantDialog } from './expurgar-tenant-dialog'

export function TenantsPage() {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('TODOS')

  const [clinicaStatus, setClinicaStatus] = useState<ClinicaListItem | null>(null)
  const [clinicaExpurgar, setClinicaExpurgar] = useState<ClinicaListItem | null>(null)

  const { data: tenants, isLoading } = useVendorTenants({
    busca,
    status: ['TODOS', 'VENCIDA', 'A_VENCER', 'BLOQUEADA'].includes(filtroStatus) ? undefined : filtroStatus,
  })

  const lista = tenants || []
  const hoje = new Date().toISOString().split('T')[0]
  const data15Dias = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const totalVencidas = lista.filter((t) => t.vigencia_fim && t.vigencia_fim < hoje).length
  const totalAVencer = lista.filter(
    (t) => t.ativo && t.vigencia_fim && t.vigencia_fim >= hoje && t.vigencia_fim <= data15Dias
  ).length
  const totalBloqueadas = lista.filter((t) => !t.ativo).length
  const totalAtivas = lista.filter(
    (t) => t.ativo && (!t.vigencia_fim || t.vigencia_fim >= hoje) && (t.status_assinatura === 'ATIVA' || t.status_assinatura === 'TRIAL')
  ).length

  const listaExibida = lista.filter((t) => {
    const vencida = Boolean(t.vigencia_fim && t.vigencia_fim < hoje)
    const aVencer = Boolean(t.ativo && t.vigencia_fim && t.vigencia_fim >= hoje && t.vigencia_fim <= data15Dias)

    if (filtroStatus === 'VENCIDA') return vencida
    if (filtroStatus === 'A_VENCER') return aVencer
    if (filtroStatus === 'BLOQUEADA') return !t.ativo
    if (filtroStatus === 'ATIVA') return t.ativo && (!t.vigencia_fim || t.vigencia_fim >= hoje) && t.status_assinatura === 'ATIVA'
    return true
  })

  return (
    <div className="space-y-6 text-slate-100 animate-fadeIn">
      <PageHeader
        titulo="Clínicas &amp; Instâncias Multi-Tenant"
        descricao="Gerenciamento de schemas PostgreSQL, domínios, limites e ciclo de vida das clínicas da plataforma."
        acoes={
          <ProvisionarTenantModal
            trigger={
              <BotaoVendorPrimario className="cursor-pointer">
                <Plus className="size-4 mr-2" />
                Provisionar Clínica
              </BotaoVendorPrimario>
            }
          />
        }
      />

      {/* KPI Cards Rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Instâncias</p>
              <p className="text-2xl font-bold text-white mt-0.5">{lista.length}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Cadastradas</p>
            </div>
            <Building2 className="size-7 text-[#D4AF37]" />
          </CardContent>
        </Card>

        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Ativas &amp; Em Dia</p>
              <p className="text-2xl font-bold text-emerald-400 mt-0.5">{totalAtivas}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Acesso liberado</p>
            </div>
            <CheckCircle2 className="size-7 text-emerald-400" />
          </CardContent>
        </Card>

        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">A Vencer (15 dias)</p>
              <p className="text-2xl font-bold text-amber-400 mt-0.5">{totalAVencer}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Próximas renovações</p>
            </div>
            <Clock className="size-7 text-amber-400" />
          </CardContent>
        </Card>

        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Planos Vencidos</p>
              <p className="text-2xl font-bold text-red-400 mt-0.5">{totalVencidas}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Vigência expirada</p>
            </div>
            <AlertCircle className="size-7 text-red-400" />
          </CardContent>
        </Card>

        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Bloqueadas / Inativas</p>
              <p className="text-2xl font-bold text-red-400 mt-0.5">{totalBloqueadas}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Acesso suspenso</p>
            </div>
            <Lock className="size-7 text-red-400" />
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input
            placeholder="Buscar por clínica, CNPJ ou schema..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 bg-[#111D3B] border-[#1E2D56] text-white placeholder:text-slate-500 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className={`${classeCampoSelect} bg-[#111D3B] border-[#1E2D56] text-white text-xs w-56`}
          >
            <option value="TODOS">Todos os Status</option>
            <option value="ATIVA">Apenas Ativas &amp; Em Dia</option>
            <option value="VENCIDA">⚠️ Planos Vencidos / Expirados</option>
            <option value="A_VENCER">⏰ A Vencer (Próximos 15 dias)</option>
            <option value="BLOQUEADA">🔒 Bloqueadas / Inativas</option>
            <option value="TRIAL">Apenas em Trial</option>
            <option value="INADIMPLENTE">Inadimplentes</option>
            <option value="CANCELADA">Canceladas</option>
          </select>
        </div>
      </div>

      {/* Tabela de Clínicas */}
      <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-400 border-b border-[#1E2D56] font-medium bg-[#0B132B]/50">
                <tr>
                  <th className="py-3 px-4">Clínica / Razão Social</th>
                  <th className="py-3 px-4">Schema &amp; Domínio</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4">Limites (Dent./Usu.)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2D56]/60 text-slate-200">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="py-4 px-4">
                        <Skeleton className="h-6 w-full bg-[#1A2A4E]" />
                      </td>
                    </tr>
                  ))
                ) : listaExibida.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Nenhuma clínica encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  listaExibida.map((t) => {
                    const dominioPrincipal = t.dominios.find((d) => d.is_primary)?.domain || t.dominios[0]?.domain || `${t.schema_name}.localhost`
                    return (
                      <tr key={t.id} className="hover:bg-[#152345]/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <Link
                            to={`${VENDOR_BASE_PATH}/tenants/${t.id}`}
                            className="font-semibold text-white hover:text-[#D4AF37] transition-colors flex items-center gap-1.5"
                          >
                            <Building2 className="size-4 text-[#D4AF37] shrink-0" />
                            <span>{t.nome_fantasia}</span>
                          </Link>
                          {t.razao_social && (
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{t.razao_social}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          <span className="text-[#D4AF37] font-semibold">{t.schema_name}</span>
                          <div className="flex items-center gap-1 text-slate-400 mt-0.5">
                            <Globe className="size-3 text-slate-500" />
                            <span>{dominioPrincipal}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          {t.plano_nome ? (
                            <span className="font-medium text-white">{t.plano_nome}</span>
                          ) : (
                            <span className="text-slate-500 italic">Sem Plano</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          <span className="text-[#D4AF37] font-bold">{t.limite_dentistas_efetivo}</span> dentistas &bull;{' '}
                          <span>{t.limite_usuarios_efetivo}</span> usuários
                        </td>
                        <td className="py-3.5 px-4">
                          {(() => {
                            const vencida = Boolean(t.vigencia_fim && t.vigencia_fim < hoje)
                            if (!t.ativo) {
                              return (
                                <div className="flex items-center gap-1.5">
                                  <StatusBadge variante="erro" className="bg-red-950/70 border-red-800 text-red-200 font-semibold">
                                    BLOQUEADA
                                  </StatusBadge>
                                  <Lock className="size-3.5 text-red-400" />
                                </div>
                              )
                            }
                            if (vencida) {
                              return (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <StatusBadge variante="erro" className="bg-red-950/80 border-red-700 text-red-200 font-bold">
                                      PLANO VENCIDO
                                    </StatusBadge>
                                    <Clock className="size-3.5 text-red-400" />
                                  </div>
                                  <span className="block text-[10px] text-red-300 font-mono">
                                    Expirou em {new Date(t.vigencia_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
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
                            // Ativa
                            return (
                              <div className="space-y-0.5">
                                <StatusBadge variante="sucesso" className="bg-emerald-950/60 border-emerald-800 text-emerald-300 font-medium">
                                  ATIVA
                                </StatusBadge>
                                {t.vigencia_fim && (
                                  <span className="block text-[10px] text-slate-400 font-mono">
                                    Vigência até {new Date(t.vigencia_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-[#D4AF37] hover:text-white hover:bg-[#1A2A4E] cursor-pointer"
                            >
                              <Link to={`${VENDOR_BASE_PATH}/tenants/${t.id}`}>
                                Detalhes <ChevronRight className="size-3.5 ml-1" />
                              </Link>
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setClinicaStatus(t)}
                              className="h-8 w-8 text-slate-400 hover:text-[#D4AF37] hover:bg-[#1A2A4E] cursor-pointer"
                              title="Alterar status / Bloquear"
                            >
                              <SlidersHorizontal className="size-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setClinicaExpurgar(t)}
                              className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-950/30 cursor-pointer"
                              title="Expurgar clinic (Drop schema com backup)"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>

                            <a
                              href={urlDaClinica(dominioPrincipal)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 text-slate-500 hover:text-white transition-colors"
                              title="Abrir URL do tenant em nova aba"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          </div>
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

      {/* Diálogos de Ciclo de Vida */}
      <AlternarStatusDialog
        clinica={clinicaStatus}
        aoFechar={() => setClinicaStatus(null)}
      />

      <ExpurgarTenantDialog
        clinica={clinicaExpurgar}
        aoFechar={() => setClinicaExpurgar(null)}
      />
    </div>
  )
}
