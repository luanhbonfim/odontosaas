import { Ban, CircleCheck, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { useSessao } from '@/features/auth/use-sessao'
import type { ErroApi } from '@/lib/api/client'

import { UsuarioFormDrawer } from './usuario-form-drawer'
import { podeGerenciar, type Usuario, useAtualizarUsuario, useExcluirUsuario } from './use-usuarios'

/** Ações da linha: editar, bloquear/reativar acesso e excluir definitivamente. */
export function AcoesUsuario({ usuario }: { usuario: Usuario }) {
  const atualizar = useAtualizarUsuario()
  const excluir = useExcluirUsuario()
  const { usuario: sessao } = useSessao()

  const souEu = usuario.id === sessao?.id
  // Hierarquia: gerencia cargos abaixo do seu; a si mesmo, só edita (nome/senha).
  const gerenciavel = Boolean(usuario.papel && podeGerenciar(sessao?.papel, usuario.papel))
  if (!souEu && !gerenciavel) {
    return <span className="text-muted-foreground">—</span>
  }

  async function definirAcesso(ativo: boolean) {
    try {
      await atualizar.mutateAsync({ id: usuario.id, dados: { ativo } })
      toast.success(ativo ? 'Acesso reativado.' : 'Acesso bloqueado.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível alterar o acesso.')
    }
  }

  async function excluirUsuario() {
    try {
      await excluir.mutateAsync(usuario.id)
      toast.success('Usuário excluído.')
    } catch (excecao) {
      toast.error(
        (excecao as ErroApi).mensagem ??
          'Não foi possível excluir. Se houver registros vinculados, bloqueie o acesso pelo cadastro.',
      )
    }
  }

  return (
    <div className="flex justify-end gap-1">
      <UsuarioFormDrawer
        usuario={usuario}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            title="Editar usuário"
            aria-label={`Editar ${usuario.email}`}
          >
            <Pencil />
          </Button>
        }
      />
      {/* Bloquear/reativar e excluir só para cargos abaixo — nunca a si mesmo. */}
      {!souEu && gerenciavel && (
        <>
          {usuario.ativo ? (
            <ConfirmDialog
              titulo="Bloquear acesso?"
              descricao={`${usuario.email} não conseguirá mais entrar até ser reativado.`}
              rotuloConfirmar="Bloquear"
              destrutivo
              onConfirmar={() => definirAcesso(false)}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  title="Bloquear acesso"
                  aria-label={`Bloquear ${usuario.email}`}
                >
                  <Ban className="text-destructive" />
                </Button>
              }
            />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              title="Reativar acesso"
              aria-label={`Reativar ${usuario.email}`}
              onClick={() => definirAcesso(true)}
            >
              <CircleCheck className="text-success" />
            </Button>
          )}
          <ConfirmDialog
            titulo="Excluir usuário?"
            descricao={`Remove ${usuario.email} permanentemente. Esta ação não pode ser desfeita.`}
            rotuloConfirmar="Excluir"
            destrutivo
            onConfirmar={excluirUsuario}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                title="Excluir usuário"
                aria-label={`Excluir ${usuario.email}`}
              >
                <Trash2 className="text-destructive" />
              </Button>
            }
          />
        </>
      )}
    </div>
  )
}
