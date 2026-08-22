import { useState } from 'react'
import { AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { BotaoVendorSecundario } from '../ui/vendor-ui'

interface JustificativaEscritaModalProps {
  aberto: boolean
  aoFechar: () => void
  aoConfirmar: (justificativa: string) => Promise<void> | void
  schema: string
  sql: string
  executando: boolean
}

export function JustificativaEscritaModal({
  aberto,
  aoFechar,
  aoConfirmar,
  schema,
  sql,
  executando,
}: JustificativaEscritaModalProps) {
  const [justificativa, setJustificativa] = useState('')
  const [erroValidacao, setErroValidacao] = useState('')

  function handleConfirmar() {
    const textoLimpo = justificativa.trim()
    if (textoLimpo.length < 10) {
      setErroValidacao('A justificativa é obrigatória e deve ter pelo menos 10 caracteres.')
      return
    }
    setErroValidacao('')
    aoConfirmar(textoLimpo)
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !executando && !v && aoFechar()}>
      <DialogContent className="max-w-lg border-red-500/40 bg-[#111D3B] text-slate-100">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
              <ShieldAlert className="size-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-100">
                Confirmar Execução em Modo de Escrita (RW)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Esta operação modificará dados diretamente no banco de dados.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
            <div className="flex items-center gap-2 font-semibold text-red-200">
              <AlertTriangle className="size-4 shrink-0 text-red-400" />
              <span>Atenção: Ação Crítica de Superadministrador</span>
            </div>
            <p className="mt-1 leading-relaxed">
              O comando será executado no schema <strong className="text-white">"{schema}"</strong> sob transação explícita com timeout de 15 segundos.
              Toda instrução é gravada na trilha de auditoria da plataforma.
            </p>
          </div>

          <div>
            <Label className="text-xs font-medium text-slate-300">Prévia do Comando SQL:</Label>
            <pre className="mt-1 max-h-28 overflow-x-auto rounded-md bg-[#0B132B] p-2.5 font-mono text-xs text-amber-300 border border-[#1E2D56]">
              {sql}
            </pre>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="input-justificativa" className="text-xs font-medium text-slate-200">
              Justificativa da Intervenção <span className="text-red-400">* (mínimo 10 caracteres)</span>:
            </Label>
            <textarea
              id="input-justificativa"
              rows={3}
              placeholder="Ex: Correção manual de status de fatura solicitada pelo suporte no chamado #1234."
              value={justificativa}
              onChange={(e) => {
                setJustificativa(e.target.value)
                if (e.target.value.trim().length >= 10) setErroValidacao('')
              }}
              className="w-full rounded-md border border-[#1E2D56] bg-[#0B132B]/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            {erroValidacao && <p className="text-xs text-red-400">{erroValidacao}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <BotaoVendorSecundario type="button" onClick={aoFechar} disabled={executando}>
            Cancelar
          </BotaoVendorSecundario>
          <Button
            type="button"
            onClick={handleConfirmar}
            disabled={executando || justificativa.trim().length < 10}
            className="bg-red-600 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {executando ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Executando DML...
              </>
            ) : (
              'Confirmar & Executar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
