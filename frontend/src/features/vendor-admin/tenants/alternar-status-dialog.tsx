import { useState, useEffect } from 'react'
import { AlertTriangle, Lock, Unlock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { classeCampoSelect } from '@/components/common/form-kit'
import {
  type ClinicaListItem,
  useAlternarStatusTenant,
} from './use-vendor-tenants'

type Props = {
  clinica: ClinicaListItem | null
  aoFechar: () => void
}

export function AlternarStatusDialog({ clinica, aoFechar }: Props) {
  const [novoStatus, setNovoStatus] = useState<string>('ATIVA')
  const [novoAtivo, setNovoAtivo] = useState<boolean>(true)
  const [justificativa, setJustificativa] = useState('')

  const alternar = useAlternarStatusTenant()

  // Sincroniza estado quando a clínica abre/muda
  useEffect(() => {
    if (clinica) {
      setNovoStatus(clinica.status_assinatura)
      setNovoAtivo(clinica.ativo)
      setJustificativa('')
    }
  }, [clinica])

  if (!clinica) return null

  async function handleSalvar() {
    if (!clinica) return
    try {
      await alternar.mutateAsync({
        id: clinica.id,
        dados: {
          status_assinatura: novoStatus as 'ATIVA' | 'TRIAL' | 'INADIMPLENTE' | 'CANCELADA',
          ativo: novoAtivo,
          justificativa: justificativa || undefined,
        },
      })
      toast.success(`Status da clínica "${clinica.nome_fantasia}" atualizado com sucesso!`)
      aoFechar()
    } catch (excecao: unknown) {
      const err = excecao as { response?: { data?: { erro?: string; detalhes?: string; mensagem?: string } }; mensagem?: string }
      const msg = err?.response?.data?.detalhes || err?.response?.data?.erro || err?.response?.data?.mensagem || err?.mensagem || 'Falha ao alterar status da clínica.'
      toast.error(msg)
    }
  }

  return (
    <Dialog open={Boolean(clinica)} onOpenChange={(open) => !open && aoFechar()}>
      <DialogContent className="dark bg-[#111D3B] border-[#1E2D56] text-slate-100 sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-[#D4AF37]" />
            <DialogTitle className="text-white">Gerenciar Status &amp; Acesso</DialogTitle>
          </div>
          <DialogDescription className="text-slate-300 text-xs mt-1">
            Alterar o status comercial ou bloquear o acesso da clínica <strong className="text-white">{clinica.nome_fantasia}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="status-assinatura" className="text-xs font-medium text-slate-200">
              Status da Assinatura
            </Label>
            <select
              id="status-assinatura"
              value={novoStatus}
              onChange={(e) => setNovoStatus(e.target.value)}
              className={`${classeCampoSelect} bg-[#0B132B]/80 border-[#1E2D56] text-white`}
            >
              <option value="ATIVA">ATIVA — Regular e faturamento ativo</option>
              <option value="TRIAL">TRIAL — Período de testes</option>
              <option value="INADIMPLENTE">INADIMPLENTE — Bloqueio automático por middleware</option>
              <option value="CANCELADA">CANCELADA — Contrato encerrado</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status-bloqueio" className="text-xs font-medium text-slate-200">
              Bloqueio de Acesso (Flag Ativo)
            </Label>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0B132B]/80 border border-[#1E2D56]">
              {novoAtivo ? <Unlock className="size-5 text-emerald-400" /> : <Lock className="size-5 text-red-400" />}
              <div className="flex-1">
                <p className="text-xs font-semibold text-white">
                  {novoAtivo ? 'Clínica Liberada' : 'Acesso Bloqueado'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {novoAtivo ? 'Usuários e dentistas podem acessar' : 'Usuários recebem 403 Forbidden ao tentar login'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNovoAtivo(!novoAtivo)}
                className={`text-xs ${
                  novoAtivo
                    ? 'border-red-800 text-red-300 hover:bg-red-950/40'
                    : 'border-emerald-800 text-emerald-300 hover:bg-emerald-950/40'
                }`}
              >
                {novoAtivo ? 'Bloquear' : 'Desbloquear'}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="justificativa" className="text-xs font-medium text-slate-200">
              Justificativa / Motivo (Opcional)
            </Label>
            <Input
              id="justificativa"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: Regularização de pagamento / Solicitação do cliente"
              className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-end border-t border-[#1E2D56] pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={aoFechar}
            className="border-[#1E2D56] text-slate-300 hover:bg-[#1A2A4E]"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSalvar}
            disabled={alternar.isPending}
            className="bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 font-bold shadow-md cursor-pointer"
          >
            {alternar.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              'Aplicar Alterações'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
