import { zodResolver } from '@hookform/resolvers/zod'
import { Receipt } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { CabecalhoDrawer, Campo, classeCampoSelect, CorpoDrawer } from '@/components/common/form-kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetTrigger } from '@/components/ui/sheet'
import { useFornecedores } from '@/features/estoque/use-fornecedores'
import type { ErroApi } from '@/lib/api/client'

import { ROTULO_FORMA_PAGAMENTO } from './formato'
import {
  type LancamentoEntrada,
  type LancamentoFinanceiro,
  useAtualizarLancamento,
  useCriarLancamento,
} from './use-lancamentos'

const schema = z.object({
  descricao: z.string().min(1, 'Informe a descrição'),
  valor: z
    .string()
    .min(1, 'Informe o valor')
    .refine((v) => Number(v) > 0, 'O valor deve ser maior que zero'),
  vencimento: z.string(),
  forma_pagamento: z.string(),
  fornecedor: z.string(),
})

type FormValues = z.infer<typeof schema>

function valoresIniciais(lancamento?: LancamentoFinanceiro): FormValues {
  return {
    descricao: lancamento?.descricao ?? '',
    valor: lancamento?.valor ?? '',
    vencimento: lancamento?.vencimento ?? '',
    forma_pagamento: lancamento?.forma_pagamento ?? '',
    fornecedor: lancamento?.fornecedor ? String(lancamento.fornecedor) : '',
  }
}

type Props = {
  trigger: ReactNode
  /** Modo criar: tipo obrigatório (a página já sabe qual — Receber ou Pagar). */
  tipo?: 'RECEITA' | 'DESPESA'
  /** Modo editar: lançamento existente (o tipo vem dele). */
  lancamento?: LancamentoFinanceiro
}

/** Criar/editar um lançamento manual (RECEITA ou DESPESA) — não usado para
 * lançamentos gerados automaticamente (consulta/guia/fatura/compra de
 * insumo), que só têm Quitar/Estornar. */
export function LancamentoFormDrawer({ trigger, tipo, lancamento }: Props) {
  const [aberto, setAberto] = useState(false)
  const criar = useCriarLancamento()
  const atualizar = useAtualizarLancamento()
  const { data: fornecedores } = useFornecedores()
  const edicao = Boolean(lancamento)
  const tipoEfetivo = lancamento?.tipo ?? tipo ?? 'RECEITA'

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresIniciais(lancamento),
  })

  useEffect(() => {
    if (aberto) reset(valoresIniciais(lancamento))
  }, [aberto, lancamento, reset])

  async function onSubmit(valores: FormValues) {
    const dados: LancamentoEntrada = {
      tipo: tipoEfetivo,
      descricao: valores.descricao,
      valor: valores.valor,
      vencimento: valores.vencimento || null,
      forma_pagamento: valores.forma_pagamento || undefined,
      fornecedor:
        tipoEfetivo === 'DESPESA' && valores.fornecedor ? Number(valores.fornecedor) : null,
    }
    try {
      if (edicao && lancamento) await atualizar.mutateAsync({ id: lancamento.id, dados })
      else await criar.mutateAsync(dados)
      toast.success(edicao ? 'Lançamento atualizado.' : 'Lançamento registrado.')
      setAberto(false)
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível salvar o lançamento.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <CabecalhoDrawer
          icone={Receipt}
          titulo={edicao ? 'Editar lançamento' : 'Novo lançamento'}
          descricao={
            tipoEfetivo === 'RECEITA'
              ? 'Conta a receber manual — não vinculada a consulta ou guia.'
              : 'Conta a pagar manual — não vinculada a uma compra de insumo.'
          }
        />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4">
          <CorpoDrawer>
            <Campo id="descricao" label="Descrição" obrigatorio erro={errors.descricao?.message}>
              <Input
                id="descricao"
                aria-required="true"
                aria-invalid={errors.descricao ? true : undefined}
                {...register('descricao')}
              />
            </Campo>

            <Campo id="valor" label="Valor" obrigatorio erro={errors.valor?.message}>
              <Input
                id="valor"
                inputMode="decimal"
                aria-required="true"
                aria-invalid={errors.valor ? true : undefined}
                {...register('valor')}
              />
            </Campo>

            <Campo id="vencimento" label="Vencimento (opcional)">
              <Input id="vencimento" type="date" {...register('vencimento')} />
            </Campo>

            <Campo id="forma_pagamento" label="Forma de pagamento (opcional)">
              <select
                id="forma_pagamento"
                className={classeCampoSelect}
                {...register('forma_pagamento')}
              >
                <option value="">Não informado</option>
                {Object.entries(ROTULO_FORMA_PAGAMENTO).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </Campo>

            {tipoEfetivo === 'DESPESA' && (
              <Campo id="fornecedor" label="Fornecedor (opcional)">
                <select id="fornecedor" className={classeCampoSelect} {...register('fornecedor')}>
                  <option value="">Não informado</option>
                  {(fornecedores ?? []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </CorpoDrawer>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </SheetClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
