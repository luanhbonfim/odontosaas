import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { CabecalhoDrawer, Campo, CorpoDrawer, LinhaToggle } from '@/components/common/form-kit'
import { StatusBadge } from '@/components/common/status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetTrigger } from '@/components/ui/sheet'
import type { ErroApi } from '@/lib/api/client'

import {
  type Fornecedor,
  type FornecedorEntrada,
  useAtualizarFornecedor,
  useCriarFornecedor,
  useFornecedores,
  useRemoverFornecedor,
} from './use-fornecedores'

export function FornecedoresPage() {
  const { data, isLoading, isError } = useFornecedores()
  const remover = useRemoverFornecedor()

  async function excluir(fornecedor: Fornecedor) {
    try {
      await remover.mutateAsync(fornecedor.id)
      toast.success('Fornecedor excluído.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível excluir o fornecedor.')
    }
  }

  const acoesFornecedor = (fornecedor: Fornecedor) => (
    <div className="flex items-center justify-end gap-1">
      <FornecedorFormDrawer
        fornecedor={fornecedor}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            title="Editar fornecedor"
            aria-label={`Editar ${fornecedor.nome}`}
          >
            <Pencil />
          </Button>
        }
      />
      <ConfirmDialog
        titulo="Excluir fornecedor?"
        descricao={`Remove ${fornecedor.nome}. Compras já registradas mantêm o histórico.`}
        rotuloConfirmar="Excluir"
        destrutivo
        onConfirmar={() => excluir(fornecedor)}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            title="Excluir fornecedor"
            aria-label={`Excluir ${fornecedor.nome}`}
          >
            <Trash2 className="text-destructive" />
          </Button>
        }
      />
    </div>
  )

  const colunas: ColumnDef<Fornecedor, unknown>[] = [
    { accessorKey: 'nome', header: 'Nome' },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.ativo ? (
          <StatusBadge variante="sucesso">Ativo</StatusBadge>
        ) : (
          <StatusBadge variante="neutro">Inativo</StatusBadge>
        ),
    },
    {
      id: 'acoes',
      header: '',
      cell: ({ row }) => acoesFornecedor(row.original),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Fornecedores"
        descricao="Catálogo de quem a clínica compra insumos. Usado nas compras registradas em Movimentações."
        acoes={
          <FornecedorFormDrawer
            trigger={
              <Button>
                <Plus /> Adicionar fornecedor
              </Button>
            }
          />
        }
      />

      {isError ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Não foi possível carregar os fornecedores. Tente novamente.
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={colunas}
          data={data ?? []}
          carregando={isLoading}
          vazio="Nenhum fornecedor cadastrado."
          cardMobile={(fornecedor) => (
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-semibold break-words">{fornecedor.nome}</p>
                <div className="flex shrink-0 items-center gap-1">{acoesFornecedor(fornecedor)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {fornecedor.ativo ? (
                  <StatusBadge variante="sucesso">Ativo</StatusBadge>
                ) : (
                  <StatusBadge variante="neutro">Inativo</StatusBadge>
                )}
              </div>
            </div>
          )}
        />
      )}
    </div>
  )
}

const schema = z.object({
  nome: z.string().min(1, 'Informe o nome do fornecedor'),
  ativo: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function valoresIniciais(fornecedor?: Fornecedor): FormValues {
  return { nome: fornecedor?.nome ?? '', ativo: fornecedor?.ativo ?? true }
}

function FornecedorFormDrawer({ trigger, fornecedor }: { trigger: ReactNode; fornecedor?: Fornecedor }) {
  const [aberto, setAberto] = useState(false)
  const criar = useCriarFornecedor()
  const atualizar = useAtualizarFornecedor()
  const edicao = Boolean(fornecedor)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresIniciais(fornecedor),
  })

  useEffect(() => {
    if (aberto) reset(valoresIniciais(fornecedor))
  }, [aberto, fornecedor, reset])

  async function onSubmit(valores: FormValues) {
    const dados: FornecedorEntrada = { nome: valores.nome, ativo: valores.ativo }
    try {
      if (edicao && fornecedor) await atualizar.mutateAsync({ id: fornecedor.id, dados })
      else await criar.mutateAsync(dados)
      toast.success(edicao ? 'Fornecedor atualizado.' : 'Fornecedor adicionado.')
      setAberto(false)
    } catch (excecao) {
      const erro = excecao as ErroApi
      if (erro.campos?.nome) setError('nome', { message: erro.campos.nome[0] })
      else toast.error(erro.mensagem ?? 'Não foi possível salvar o fornecedor.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <CabecalhoDrawer
          icone={Truck}
          titulo={edicao ? 'Editar fornecedor' : 'Novo fornecedor'}
          descricao="Loja/distribuidora de quem a clínica compra insumos."
        />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4">
          <CorpoDrawer>
            <Campo id="nome" label="Nome" obrigatorio erro={errors.nome?.message}>
              <Input
                id="nome"
                placeholder="ex.: Dental Center, Distribuidora Odonto…"
                aria-required="true"
                aria-invalid={errors.nome ? true : undefined}
                {...register('nome')}
              />
            </Campo>

            <LinhaToggle
              titulo="Fornecedor ativo"
              ajuda="Inativos não aparecem para novas compras."
              {...register('ativo')}
            />
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
