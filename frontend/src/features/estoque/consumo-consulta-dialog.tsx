import { Plus, Trash2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { classeCampoSelect } from '@/components/common/form-kit'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { ErroApi } from '@/lib/api/client'

import {
  useConsumosDaConsulta,
  useCriarConsumo,
  useInsumos,
  useRemoverConsumo,
} from './use-estoque'

/**
 * Insumos consumidos numa consulta. Disponível em EM_ATENDIMENTO e REALIZADA —
 * o backend dá baixa automática no estoque ao realizar, e ajusta na hora se
 * editado depois (consulta já realizada).
 */
export function ConsumoConsultaDialog({
  consultaId,
  trigger,
}: {
  consultaId: number
  trigger: ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const { data: consumos, isLoading } = useConsumosDaConsulta(aberto ? consultaId : 0)
  const { data: insumos } = useInsumos()
  const criar = useCriarConsumo(consultaId)
  const remover = useRemoverConsumo(consultaId)

  const [insumoId, setInsumoId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [erro, setErro] = useState('')

  async function adicionar() {
    setErro('')
    if (!insumoId) {
      setErro('Selecione um insumo.')
      return
    }
    if (!quantidade || Number(quantidade) <= 0) {
      setErro('Informe uma quantidade maior que zero.')
      return
    }
    try {
      await criar.mutateAsync({ consulta: consultaId, insumo: Number(insumoId), quantidade })
      setInsumoId('')
      setQuantidade('')
    } catch (excecao) {
      setErro((excecao as ErroApi).mensagem ?? 'Não foi possível registrar o consumo.')
    }
  }

  async function excluir(id: number) {
    try {
      await remover.mutateAsync(id)
      toast.success('Consumo removido.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível remover o consumo.')
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insumos consumidos</DialogTitle>
          <DialogDescription>
            Materiais usados neste atendimento — a baixa no estoque acontece automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (consumos ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum insumo registrado ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {(consumos ?? []).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span>
                    {c.insumo_nome} — <span className="tabular-nums">{c.quantidade}</span>
                  </span>
                  <ConfirmDialog
                    titulo="Remover consumo?"
                    descricao={`O insumo ${c.insumo_nome} volta ao estoque.`}
                    rotuloConfirmar="Remover"
                    destrutivo
                    onConfirmar={() => excluir(c.id)}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Remover"
                        aria-label={`Remover ${c.insumo_nome}`}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-end gap-2 border-t pt-3">
            <div className="flex-1 space-y-1.5">
              <select
                aria-label="Insumo"
                className={classeCampoSelect}
                value={insumoId}
                onChange={(e) => setInsumoId(e.target.value)}
              >
                <option value="">Selecione um insumo…</option>
                {(insumos ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
              </select>
            </div>
            <Input
              aria-label="Quantidade"
              placeholder="Qtd."
              className="w-20"
              inputMode="decimal"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={adicionar} disabled={criar.isPending}>
              <Plus /> Adicionar
            </Button>
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setAberto(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
