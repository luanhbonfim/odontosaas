import { useEffect, useState } from 'react'
import { Loader2, Package } from 'lucide-react'
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
import { classeCampoSelect } from '@/components/common/form-kit'
import { type VigenciaModo, useTrocarPlano } from './use-vendor-tenants'

type PlanoOpcao = { id: number; nome: string; preco_mensal: string | number; periodicidade?: string | null }

type Props = {
  aberto: boolean
  aoFechar: () => void
  tenantId: number
  planoAtualId: number | null
  planos: PlanoOpcao[]
}

const OPCOES_VIGENCIA: { valor: VigenciaModo; titulo: string; ajuda: string }[] = [
  {
    valor: 'agora',
    titulo: 'Sim — aplicar a partir de hoje',
    ajuda: 'Recalcula o vencimento pela periodicidade do novo plano, a contar de hoje, e reativa a clínica.',
  },
  {
    valor: 'manter',
    titulo: 'Não — manter o vencimento atual',
    ajuda: 'Apenas troca o plano; a data de vencimento não muda.',
  },
  {
    valor: 'proximo_ciclo',
    titulo: 'A partir do próximo vencimento',
    ajuda: 'A nova vigência passa a valer somando o período do novo plano ao vencimento atual.',
  },
]

export function TrocarPlanoModal({ aberto, aoFechar, tenantId, planoAtualId, planos }: Props) {
  const trocar = useTrocarPlano(tenantId)
  const [planoId, setPlanoId] = useState<number | null>(planoAtualId)
  const [modo, setModo] = useState<VigenciaModo>('manter')

  useEffect(() => {
    if (aberto) {
      setPlanoId(planoAtualId)
      setModo('manter')
    }
  }, [aberto, planoAtualId])

  async function confirmar() {
    if (!planoId) {
      toast.error('Selecione o novo plano.')
      return
    }
    try {
      await trocar.mutateAsync({ plano_id: planoId, vigencia_modo: modo })
      toast.success('Plano trocado com sucesso.')
      aoFechar()
    } catch (e) {
      const err = e as { response?: { data?: { erro?: string; detalhes?: string } } }
      toast.error(err?.response?.data?.erro || err?.response?.data?.detalhes || 'Falha ao trocar o plano.')
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="dark bg-[#111D3B] border-[#1E2D56] text-slate-100 sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Package className="size-5 text-[#D4AF37]" />
            <DialogTitle className="text-white">Trocar Plano Comercial</DialogTitle>
          </div>
          <DialogDescription className="text-slate-300 text-xs mt-1">
            Selecione o novo plano e defina se a vigência de vencimento deve ser aplicada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="trocar-plano-select" className="text-xs font-medium text-slate-200">
              Novo plano
            </Label>
            <select
              id="trocar-plano-select"
              className={classeCampoSelect}
              value={planoId ?? ''}
              onChange={(e) => setPlanoId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Selecione…</option>
              {planos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} (R$ {Number(p.preco_mensal).toFixed(2)}/mês [{p.periodicidade || 'MENSAL'}])
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-200">Deseja aplicar a nova vigência de vencimento?</p>
            <div className="space-y-2">
              {OPCOES_VIGENCIA.map((op) => (
                <label
                  key={op.valor}
                  htmlFor={`vigencia-modo-${op.valor}`}
                  aria-label={op.titulo}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors ${
                    modo === op.valor
                      ? 'border-[#D4AF37]/50 bg-[#D4AF37]/10'
                      : 'border-[#1E2D56] hover:bg-[#152345]'
                  }`}
                >
                  <input
                    id={`vigencia-modo-${op.valor}`}
                    type="radio"
                    name="vigencia-modo"
                    className="mt-0.5 accent-[#D4AF37]"
                    checked={modo === op.valor}
                    onChange={() => setModo(op.valor)}
                  />
                  <span>
                    <span className="block text-xs font-medium text-slate-100">{op.titulo}</span>
                    <span className="block text-[10px] text-slate-400">{op.ajuda}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar} className="text-slate-300 hover:text-white">
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={trocar.isPending || !planoId}
            className="bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 font-bold disabled:opacity-60"
          >
            {trocar.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Confirmar troca
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
