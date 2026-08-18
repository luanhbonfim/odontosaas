import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import type { ErroApi } from '@/lib/api/client'

import { DentistaFormDrawer } from './dentista-form-drawer'
import { type Dentista, useRemoverDentista } from './use-dentistas'

/** Ações da linha na listagem de dentistas: editar + excluir (com confirmação). */
export function AcoesDentista({ dentista }: { dentista: Dentista }) {
  const remover = useRemoverDentista()

  async function excluir() {
    try {
      await remover.mutateAsync(dentista.id)
      toast.success('Dentista excluído.')
    } catch (excecao) {
      toast.error(
        (excecao as ErroApi).mensagem ??
          'Não foi possível excluir. Se houver registros vinculados, inative pelo cadastro.',
      )
    }
  }

  return (
    <div className="flex justify-end gap-1">
      <DentistaFormDrawer
        dentista={dentista}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            title="Editar dentista"
            aria-label={`Editar ${dentista.nome_completo}`}
          >
            <Pencil />
          </Button>
        }
      />
      <ConfirmDialog
        titulo="Excluir dentista?"
        descricao={`Remove ${dentista.nome_completo} permanentemente. Esta ação não pode ser desfeita.`}
        rotuloConfirmar="Excluir"
        destrutivo
        onConfirmar={excluir}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            title="Excluir dentista"
            aria-label={`Excluir ${dentista.nome_completo}`}
          >
            <Trash2 className="text-destructive" />
          </Button>
        }
      />
    </div>
  )
}
