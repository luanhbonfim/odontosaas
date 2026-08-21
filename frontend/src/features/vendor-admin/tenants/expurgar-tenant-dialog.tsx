import { useState, useEffect } from 'react'
import { AlertOctagon, Loader2, DatabaseBackup } from 'lucide-react'
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
import {
  type ClinicaListItem,
  useExpurgarTenant,
} from './use-vendor-tenants'

type Props = {
  clinica: ClinicaListItem | null
  aoFechar: () => void
}

export function ExpurgarTenantDialog({ clinica, aoFechar }: Props) {
  const [schemaDigitado, setSchemaDigitado] = useState('')
  const [justificativa, setJustificativa] = useState('')

  const expurgar = useExpurgarTenant()

  // Reseta os campos toda vez que a clínica mudar ou o modal abrir
  useEffect(() => {
    setSchemaDigitado('')
    setJustificativa('')
  }, [clinica])

  function fecharEResetar() {
    setSchemaDigitado('')
    setJustificativa('')
    aoFechar()
  }

  if (!clinica) return null

  const schemaCorreto = clinica.schema_name
  const podeConfirmar = schemaDigitado.trim() === schemaCorreto && justificativa.trim().length >= 5

  async function handleExpurgar() {
    if (!clinica || !podeConfirmar) return
    try {
      await expurgar.mutateAsync({
        id: clinica.id,
        confirmacao_schema: schemaDigitado.trim(),
        justificativa: justificativa.trim(),
      })
      toast.success(`Backup pg_dump gerado e schema "${schemaCorreto}" expurgado com sucesso!`)
      fecharEResetar()
    } catch (excecao: unknown) {
      const err = excecao as { mensagem?: string; erro?: string; [key: string]: unknown }
      const msg = err?.mensagem || err?.erro || (typeof err === 'string' ? err : 'Falha ao expurgar clínica.')
      toast.error(String(msg))
    }
  }

  return (
    <Dialog
      open={Boolean(clinica)}
      onOpenChange={(open) => {
        if (!open) fecharEResetar()
      }}
    >
      <DialogContent className="dark bg-[#111D3B] border-red-900/60 text-slate-100 sm:max-w-md shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-400">
            <AlertOctagon className="size-6 shrink-0" />
            <DialogTitle className="text-white text-base">
              Expurgo Físico &amp; Destruição de Schema
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-300 text-xs mt-2 leading-relaxed">
            Esta operação realizará um <strong>backup completo pg_dump com SHA-256</strong> e executará um{' '}
            <span className="text-red-400 font-mono font-bold">DROP SCHEMA CASCADE</span> no PostgreSQL para a clínica{' '}
            <strong className="text-white">{clinica.nome_fantasia}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/50 text-xs text-red-200 flex items-start gap-2">
            <DatabaseBackup className="size-4 text-red-400 shrink-0 mt-0.5" />
            <span>
              Ação irreversível restrita a SuperAdmins. Todos os dados serão desanexados permanentemente da plataforma.
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-schema" className="text-xs font-medium text-slate-200">
              Digite <span className="font-mono text-[#D4AF37] font-bold">{schemaCorreto}</span> para confirmar:
            </Label>
            <Input
              id="confirm-schema"
              value={schemaDigitado}
              onChange={(e) => setSchemaDigitado(e.target.value)}
              placeholder={schemaCorreto}
              className="bg-[#0B132B]/80 border-red-900/40 text-white font-mono text-xs focus-visible:border-red-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="justificativa-expurgo" className="text-xs font-medium text-slate-200">
              Justificativa Obrigatória (mínimo 5 caracteres):
            </Label>
            <Input
              id="justificativa-expurgo"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: Cancelamento contratual e solicitação de expurgo LGPD"
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
            onClick={handleExpurgar}
            disabled={!podeConfirmar || expurgar.isPending}
            className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-md cursor-pointer disabled:opacity-30"
          >
            {expurgar.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Gerando Backup &amp; Dropando...
              </>
            ) : (
              'Confirmar Expurgo Físico'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
