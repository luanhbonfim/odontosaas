import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { BellRing, Info } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BotaoVendorPrimario } from '../ui/vendor-ui'
import {
  type ConfigAvisoVencimento,
  useConfigAvisoVencimento,
  useSalvarConfigAvisoVencimento,
} from './use-config-aviso-vencimento'

/** Ícone "ⓘ" com tooltip explicativo no hover/foco (mesmo padrão de
 * `configuracoes-login-page.tsx`, sem dependência compartilhada). */
function InfoDica({ texto }: { texto: string }) {
  return (
    <span className="group/dica relative inline-flex align-middle">
      <Info
        tabIndex={0}
        aria-label={texto}
        className="size-3.5 shrink-0 cursor-help text-slate-500 outline-none transition-colors hover:text-[#D4AF37] focus-visible:text-[#D4AF37]"
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-56 -translate-x-1/2 rounded-md border border-[#1E2D56] bg-[#0B132B] px-2.5 py-1.5 text-[11px] leading-snug text-slate-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover/dica:opacity-100 group-focus-within/dica:opacity-100"
      >
        {texto}
      </span>
    </span>
  )
}

export function ConfiguracaoAvisoVencimentoPage() {
  const { data, isLoading } = useConfigAvisoVencimento()
  const salvar = useSalvarConfigAvisoVencimento()
  const [form, setForm] = useState<ConfigAvisoVencimento | null>(null)
  const id = useId()

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  async function onSalvar() {
    if (!form) return
    try {
      await salvar.mutateAsync(form)
      toast.success('Configuração salva. Efeito em até ~30s.')
    } catch {
      toast.error('Falha ao salvar. Verifique o valor (faixa permitida).')
    }
  }

  if (isLoading || !form) {
    return <div className="p-8 text-sm text-slate-400">Carregando configuração…</div>
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <BellRing className="size-5 text-[#D4AF37]" />
        <h1 className="text-xl font-bold text-white tracking-tight">Aviso de Vencimento</h1>
      </div>
      <p className="text-xs text-slate-400">
        Define, para todas as clínicas, com quantos dias de antecedência o aviso de vencimento
        aparece pro tenant (barra no topo e tela "Meu Plano"). Ação restrita a SuperAdmin e
        auditada.
      </p>

      <div className="p-4 rounded-lg bg-[#0B132B]/60 border border-[#1E2D56] space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor={id} className="text-slate-200">
              Dias de antecedência do aviso
            </Label>
            <InfoDica texto="Quantos dias antes do vencimento da assinatura o aviso passa a aparecer pro tenant. Faixa: 1 a 90 dias." />
          </div>
          <Input
            id={id}
            type="number"
            min={1}
            max={90}
            className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs focus-visible:border-[#D4AF37]"
            value={form.dias_antecedencia}
            onChange={(e) =>
              setForm((f) => (f ? { ...f, dias_antecedencia: Number(e.target.value) } : f))
            }
          />
        </div>
      </div>

      <div className="flex justify-end">
        <BotaoVendorPrimario onClick={onSalvar} disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando…' : 'Salvar configuração'}
        </BotaoVendorPrimario>
      </div>
    </div>
  )
}
