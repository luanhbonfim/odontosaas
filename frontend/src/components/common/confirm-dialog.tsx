import * as AlertDialog from '@radix-ui/react-alert-dialog'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

type ConfirmDialogProps = {
  trigger: ReactNode
  titulo: string
  descricao?: string
  rotuloConfirmar?: string
  destrutivo?: boolean
  onConfirmar: () => void
}

/** Diálogo de confirmação para ações sensíveis (excluir, cancelar consulta, etc.). */
export function ConfirmDialog({
  trigger,
  titulo,
  descricao,
  rotuloConfirmar = 'Confirmar',
  destrutivo = false,
  onConfirmar,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-6 text-card-foreground shadow-lg">
          <AlertDialog.Title className="text-lg font-semibold">{titulo}</AlertDialog.Title>
          {descricao && (
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              {descricao}
            </AlertDialog.Description>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">Cancelar</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={destrutivo ? 'destructive' : 'default'} onClick={onConfirmar}>
                {rotuloConfirmar}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
