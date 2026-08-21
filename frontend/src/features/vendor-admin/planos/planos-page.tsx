import { useState } from 'react'
import { Plus, Search, Package, Edit2, Trash2, Check, Building2, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/common/status-badge'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { toast } from 'sonner'
import {
  useDeletarPlano,
  useVendorPlanos,
} from './use-vendor-planos'
import { PlanoFormDrawer } from './plano-form-drawer'

export function PlanosPage() {
  const [busca, setBusca] = useState('')

  const { data: planos, isLoading } = useVendorPlanos(busca)
  const deletar = useDeletarPlano()

  const listaPlanos = planos || []
  const totalClinicasVinculadas = listaPlanos.reduce((acc, p) => acc + (p.total_clinicas || 0), 0)

  return (
    <div className="space-y-6 text-slate-100 animate-fadeIn">
      <PageHeader
        titulo="Planos de Assinatura"
        descricao="Gerenciamento comercial dos pacotes de recursos, módulos e limites oferecidos às clínicas."
        acoes={
          <PlanoFormDrawer
            trigger={
              <Button className="font-semibold bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 shadow-md cursor-pointer">
                <Plus className="size-4 mr-2" />
                Novo Plano
              </Button>
            }
          />
        }
      />

      {/* KPI Cards Rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Total de Planos</p>
              <p className="text-2xl font-bold text-white mt-0.5">{listaPlanos.length}</p>
            </div>
            <Package className="size-7 text-[#D4AF37]" />
          </CardContent>
        </Card>

        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Planos Ativos</p>
              <p className="text-2xl font-bold text-emerald-400 mt-0.5">
                {listaPlanos.filter((p) => p.ativo).length}
              </p>
            </div>
            <Check className="size-7 text-emerald-400" />
          </CardContent>
        </Card>

        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Clínicas Vinculadas</p>
              <p className="text-2xl font-bold text-[#D4AF37] mt-0.5">{totalClinicasVinculadas}</p>
            </div>
            <Building2 className="size-7 text-[#D4AF37]" />
          </CardContent>
        </Card>
      </div>

      {/* Barra de Busca */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome do plano..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 bg-[#111D3B] border-[#1E2D56] text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Tabela de Planos */}
      <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-400 border-b border-[#1E2D56] font-medium bg-[#0B132B]/50">
                <tr>
                  <th className="py-3 px-4">Nome do Plano</th>
                  <th className="py-3 px-4">Preço Mensal</th>
                  <th className="py-3 px-4">Anuidade</th>
                  <th className="py-3 px-4">Limites (Dentistas / Pacientes)</th>
                  <th className="py-3 px-4">Módulos Inclusos</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Clínicas</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2D56]/60 text-slate-200">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="py-4 px-4">
                        <Skeleton className="h-6 w-full bg-[#1A2A4E]" />
                      </td>
                    </tr>
                  ))
                ) : listaPlanos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Nenhum plano comercial cadastrado.
                    </td>
                  </tr>
                ) : (
                  listaPlanos.map((p) => (
                    <tr key={p.id} className="hover:bg-[#152345]/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                        <Package className="size-4 text-[#D4AF37]" />
                        <span>{p.nome}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-white">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          Number(p.preco_mensal)
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">
                        {p.preco_anual
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                              Number(p.preco_anual)
                            )
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="text-[#D4AF37] font-semibold">{p.limite_dentistas}</span> dentistas &bull;{' '}
                        <span>{p.limite_pacientes_ativos}</span> pac. &bull;{' '}
                        <span>{Math.round(p.limite_armazenamento_mb / 1024)}GB</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            title="Financeiro"
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              p.modulo_financeiro_ativo
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                                : 'bg-[#0B132B] text-slate-500 border border-[#1E2D56]'
                            }`}
                          >
                            Fin
                          </span>
                          <span
                            title="Estoque"
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              p.modulo_estoque_ativo
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                                : 'bg-[#0B132B] text-slate-500 border border-[#1E2D56]'
                            }`}
                          >
                            Est
                          </span>
                          <span
                            title="Google Agenda"
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              p.sync_google_ativo
                                ? 'bg-blue-950/60 text-blue-300 border border-blue-800/40'
                                : 'bg-[#0B132B] text-slate-500 border border-[#1E2D56]'
                            }`}
                          >
                            Google
                          </span>
                          <span
                            title="WhatsApp"
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              p.whatsapp_waha_ativo
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                                : 'bg-[#0B132B] text-slate-500 border border-[#1E2D56]'
                            }`}
                          >
                            WA
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge
                          variante={p.ativo ? 'sucesso' : 'neutro'}
                          className="bg-[#0B132B] border-[#1E2D56] text-slate-200"
                        >
                          {p.ativo ? 'Ativo' : 'Desativado'}
                        </StatusBadge>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-xs bg-[#0B132B] px-2 py-0.5 rounded-full border border-[#1E2D56] text-slate-200">
                          <Users className="size-3 text-[#D4AF37]" />
                          {p.total_clinicas || 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <PlanoFormDrawer
                            plano={p}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-300 hover:text-white hover:bg-[#1A2A4E] cursor-pointer"
                                title="Editar plano"
                              >
                                <Edit2 className="size-3.5" />
                              </Button>
                            }
                          />
                          <ConfirmDialog
                            titulo={`Excluir Plano "${p.nome}"?`}
                            descricao="Esta ação desativará permanentemente este pacote comercial da plataforma."
                            rotuloConfirmar="Excluir Plano"
                            destrutivo
                            onConfirmar={() => {
                              deletar.mutate(p.id, {
                                onSuccess: () => toast.success(`Plano "${p.nome}" excluído.`),
                                onError: () => toast.error('Não é possível excluir um plano com clínicas vinculadas.'),
                              })
                            }}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={p.total_clinicas > 0}
                                className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-950/30 cursor-pointer disabled:opacity-30"
                                title={
                                  p.total_clinicas > 0
                                    ? 'Não é possível excluir: há clínicas usando este plano'
                                    : 'Excluir plano'
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
