import { useEffect, useState } from 'react'
import { Loader2, Wallet } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { classeCampoSelect } from '@/components/common/form-kit'
import { useRenovarTenant } from './use-vendor-tenants'

const FORMAS_PAGAMENTO = [
  { valor: 'PIX', rotulo: 'Pix' },
  { valor: 'BOLETO', rotulo: 'Boleto' },
  { valor: 'CARTAO', rotulo: 'Cartão' },
  { valor: 'DINHEIRO', rotulo: 'Dinheiro' },
  { valor: 'TRANSFERENCIA', rotulo: 'Transferência' },
]

type Props = {
  aberto: boolean
  aoFechar: () => void
  tenantId: number
}

/** Confirmação rápida antes de renovar — valor/forma de pagamento/observação
 * são todos opcionais (não impedem renovar), mas ficam registrados no
 * histórico da clínica quando informados. */
export function RenovarAssinaturaModal({ aberto, aoFechar, tenantId }: Props) {
  const renovar = useRenovarTenant()
  const [valor, setValor] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [observacao, setObservacao] = useState('')

  useEffect(() => {
    if (aberto) {
      setValor('')
      setFormaPagamento('')
      setObservacao('')
    }
  }, [aberto])

  async function confirmar() {
    try {
      await renovar.mutateAsync({
        id: tenantId,
        dados: {
          valor: valor || undefined,
          forma_pagamento: formaPagamento || undefined,
          observacao: observacao || undefined,
        },
      })
      toast.success('Assinatura renovada — vigência estendida e clínica reativada.')
      aoFechar()
    } catch {
      toast.error('Falha ao renovar a assinatura.')
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="dark bg-[#111D3B] border-[#1E2D56] text-slate-100 sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Wallet className="size-5 text-[#D4AF37]" />
            <DialogTitle className="text-white">Renovar Assinatura</DialogTitle>
          </div>
          <DialogDescription className="text-slate-300 text-xs mt-1">
            Estende a vigência a partir da data atual de vencimento (não perde dias já pagos).
            Valor e forma de pagamento são opcionais — só ficam registrados no histórico da
            clínica se informados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="renovar-valor" className="text-xs font-medium text-slate-200">
              Valor recebido (opcional)
            </Label>
            <Input
              id="renovar-valor"
              inputMode="decimal"
              placeholder="Ex.: 299.90"
              className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-sm focus-visible:border-[#D4AF37]"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="renovar-forma" className="text-xs font-medium text-slate-200">
              Forma de pagamento (opcional)
            </Label>
            <select
              id="renovar-forma"
              className={classeCampoSelect}
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
            >
              <option value="">Não informado</option>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="renovar-obs" className="text-xs font-medium text-slate-200">
              Observação (opcional)
            </Label>
            <Input
              id="renovar-obs"
              placeholder="Ex.: pago via link enviado por WhatsApp"
              className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-sm focus-visible:border-[#D4AF37]"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar} className="text-slate-300 hover:text-white">
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={renovar.isPending}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-60"
          >
            {renovar.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Confirmar renovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
