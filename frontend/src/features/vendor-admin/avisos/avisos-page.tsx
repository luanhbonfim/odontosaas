import { Plus, Megaphone, Edit2, Trash2, Check } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/common/status-badge'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { toast } from 'sonner'
import { iconeAviso } from '@/features/avisos/icones'
import { useDeletarAviso, useVendorAvisos } from './use-vendor-avisos'
import { AvisoFormDrawer } from './aviso-form-drawer'

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export function AvisosPage() {
  const { data: avisos, isLoading } = useVendorAvisos()
  const deletar = useDeletarAviso()

  const listaAvisos = avisos || []

  // Próxima posição livre no carrossel, calculada só entre os avisos ainda
  // vigentes — se o de ordem 0 já venceu, o próximo criado já nasce depois
  // do que está realmente ativo (editável em seguida).
  const hoje = new Date().toISOString().slice(0, 10)
  const vigentes = listaAvisos.filter((a) => a.ativo && a.vigente_ate >= hoje)
  const ordemSugerida = vigentes.length > 0 ? Math.max(...vigentes.map((a) => a.ordem)) + 1 : 0

  return (
    <div className="space-y-6 text-slate-100 animate-fadeIn">
      <PageHeader
        titulo="Avisos & Novidades"
        descricao="Carrossel exibido em popup às clínicas logo após o login — anuncie atualizações do sistema."
        acoes={
          <AvisoFormDrawer
            ordemSugerida={ordemSugerida}
            trigger={
              <Button className="font-semibold bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 shadow-md cursor-pointer">
                <Plus className="size-4 mr-2" />
                Novo Aviso
              </Button>
            }
          />
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Total de Avisos</p>
              <p className="text-2xl font-bold text-white mt-0.5">{listaAvisos.length}</p>
            </div>
            <Megaphone className="size-7 text-[#D4AF37]" />
          </CardContent>
        </Card>

        <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Ativos</p>
              <p className="text-2xl font-bold text-emerald-400 mt-0.5">
                {listaAvisos.filter((a) => a.ativo).length}
              </p>
            </div>
            <Check className="size-7 text-emerald-400" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#1E2D56] bg-[#111D3B] text-slate-100">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-400 border-b border-[#1E2D56] font-medium bg-[#0B132B]/50">
                <tr>
                  <th className="py-3 px-4">Título</th>
                  <th className="py-3 px-4">Publicado em</th>
                  <th className="py-3 px-4">Vigente até</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2D56]/60 text-slate-200">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="py-4 px-4">
                        <Skeleton className="h-6 w-full bg-[#1A2A4E]" />
                      </td>
                    </tr>
                  ))
                ) : listaAvisos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Nenhum aviso cadastrado.
                    </td>
                  </tr>
                ) : (
                  listaAvisos.map((a) => {
                    const IconeAviso = iconeAviso(a.icone)
                    return (
                    <tr key={a.id} className="hover:bg-[#152345]/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                        <IconeAviso className="size-4 text-[#D4AF37]" />
                        <span>{a.titulo}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">
                        {formatarData(a.publicado_em)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">
                        {formatarData(a.vigente_ate)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge
                          variante={a.ativo ? 'sucesso' : 'neutro'}
                          className="bg-[#0B132B] border-[#1E2D56] text-slate-200"
                        >
                          {a.ativo ? 'Ativo' : 'Desativado'}
                        </StatusBadge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <AvisoFormDrawer
                            aviso={a}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-300 hover:text-white hover:bg-[#1A2A4E] cursor-pointer"
                                title="Editar aviso"
                              >
                                <Edit2 className="size-3.5" />
                              </Button>
                            }
                          />
                          <ConfirmDialog
                            titulo={`Excluir aviso "${a.titulo}"?`}
                            descricao="Some do carrossel imediatamente. Esta ação não pode ser desfeita."
                            rotuloConfirmar="Excluir"
                            destrutivo
                            onConfirmar={() => {
                              deletar.mutate(a.id, {
                                onSuccess: () => toast.success(`Aviso "${a.titulo}" excluído.`),
                                onError: () => toast.error('Não foi possível excluir o aviso.'),
                              })
                            }}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-950/30 cursor-pointer"
                                title="Excluir aviso"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            }
                          />
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
    </div>
  )
}
