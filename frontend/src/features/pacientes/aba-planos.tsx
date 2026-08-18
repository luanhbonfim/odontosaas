import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { CreditCard, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import {
  CabecalhoDrawer,
  Campo,
  classeCampoSelect,
  CorpoDrawer,
  LinhaToggle,
} from '@/components/common/form-kit'
import { DateText } from '@/components/common/formato'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetTrigger } from '@/components/ui/sheet'
import { useConvenios } from '@/features/convenios/use-convenios'
import type { ErroApi } from '@/lib/api/client'

import { BadgeStatus } from './status'
import {
  type Plano,
  type PlanoEntrada,
  useAtualizarPlano,
  useCriarPlano,
  usePlanosDoPaciente,
  useRemoverPlano,
} from './use-paciente-detalhe'

const traco = <span className="text-muted-foreground">—</span>

/** Data de hoje (local) no formato YYYY-MM-DD, p/ input de data e comparação. */
function hojeLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Status exibido do plano: "Vencido" (derivado da validade) tem prioridade;
 * senão Ativo/Desativado — o usuário só controla esse par. */
function statusEfetivo(plano: Plano): string {
  if (plano.vencido) return 'VENCIDO'
  return plano.status === 'ATIVO' ? 'ATIVO' : 'DESATIVADO'
}

export function AbaPlanos({ pacienteId }: { pacienteId: number }) {
  const { data, isLoading } = usePlanosDoPaciente(pacienteId)
  const remover = useRemoverPlano(pacienteId)

  async function excluir(plano: Plano) {
    try {
      await remover.mutateAsync(plano.id)
      toast.success('Plano excluído.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível excluir o plano.')
    }
  }

  const colunas: ColumnDef<Plano, unknown>[] = [
    { id: 'convenio', header: 'Convênio', cell: ({ row }) => row.original.convenio_nome || traco },
    {
      id: 'carteirinha',
      header: 'Carteirinha',
      cell: ({ row }) => row.original.numero_carteirinha || traco,
    },
    {
      id: 'validade',
      header: 'Validade',
      cell: ({ row }) => (row.original.validade ? <DateText iso={row.original.validade} /> : traco),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <BadgeStatus status={statusEfetivo(row.original)} />,
    },
    {
      id: 'acoes',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {/* Vencido só permite renovar; caso contrário, editar. */}
          {row.original.vencido ? (
            <RenovarPlanoDrawer
              pacienteId={pacienteId}
              plano={row.original}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  title="Renovar validade"
                  aria-label={`Renovar plano ${row.original.convenio_nome}`}
                >
                  <RotateCcw />
                </Button>
              }
            />
          ) : (
            <PlanoFormDrawer
              pacienteId={pacienteId}
              plano={row.original}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  title="Editar plano"
                  aria-label={`Editar plano ${row.original.convenio_nome}`}
                >
                  <Pencil />
                </Button>
              }
            />
          )}
          <ConfirmDialog
            titulo="Excluir plano?"
            descricao={`Remove o plano ${row.original.convenio_nome}. Esta ação não pode ser desfeita.`}
            rotuloConfirmar="Excluir"
            destrutivo
            onConfirmar={() => excluir(row.original)}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                title="Excluir plano"
                aria-label={`Excluir plano ${row.original.convenio_nome}`}
              >
                <Trash2 className="text-destructive" />
              </Button>
            }
          />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PlanoFormDrawer
          pacienteId={pacienteId}
          trigger={
            <Button size="sm">
              <Plus /> Adicionar plano
            </Button>
          }
        />
      </div>

      <DataTable
        columns={colunas}
        data={data ?? []}
        carregando={isLoading}
        vazio="Nenhum plano cadastrado."
      />
    </div>
  )
}

const schema = z.object({
  convenio: z.string().min(1, 'Selecione um convênio'),
  numero_carteirinha: z.string(),
  validade: z.string(),
  ativo: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function valoresIniciais(plano?: Plano): FormValues {
  return {
    convenio: plano?.convenio ? String(plano.convenio) : '',
    numero_carteirinha: plano?.numero_carteirinha ?? '',
    validade: plano?.validade ?? '',
    // Só Ativo/Desativado; "Vencido" é automático pela validade.
    ativo: plano ? plano.status === 'ATIVO' : true,
  }
}

/** Cadastro/edição de plano num drawer lateral (estilo Equipe). */
function PlanoFormDrawer({
  pacienteId,
  plano,
  trigger,
}: {
  pacienteId: number
  plano?: Plano
  trigger: ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const criar = useCriarPlano(pacienteId)
  const atualizar = useAtualizarPlano(pacienteId)
  const { data: convenios } = useConvenios()
  const edicao = Boolean(plano)
  // Só convênios ativos no seletor — mantendo o já vinculado ao editar (mesmo inativo).
  const convenioAtual = plano?.convenio ?? null
  const conveniosDisponiveis = (convenios ?? []).filter((c) => c.ativo || c.id === convenioAtual)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresIniciais(plano),
  })

  useEffect(() => {
    if (aberto) reset(valoresIniciais(plano))
  }, [aberto, plano, reset])

  async function onSubmit(valores: FormValues) {
    const dados: PlanoEntrada = {
      convenio: Number(valores.convenio),
      numero_carteirinha: valores.numero_carteirinha,
      validade: valores.validade || null,
      status: valores.ativo ? 'ATIVO' : 'SUSPENSO',
    }
    try {
      if (edicao && plano) await atualizar.mutateAsync({ id: plano.id, dados })
      else await criar.mutateAsync(dados)
      toast.success(edicao ? 'Plano atualizado.' : 'Plano adicionado.')
      setAberto(false)
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível salvar o plano.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <CabecalhoDrawer
          icone={CreditCard}
          titulo={edicao ? 'Editar plano' : 'Novo plano'}
          descricao="Convênio do paciente — usado no faturamento das consultas."
        />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4">
          <CorpoDrawer>
            <Campo
              id="convenio"
              label="Convênio"
              obrigatorio
              erro={errors.convenio?.message}
              ajuda={
                conveniosDisponiveis.length === 0 ? (
                  <>
                    Nenhum convênio cadastrado. Cadastre em{' '}
                    <Link to="/convenios" className="underline">
                      Convênios
                    </Link>
                    .
                  </>
                ) : undefined
              }
            >
              <select
                id="convenio"
                className={classeCampoSelect}
                aria-invalid={!!errors.convenio}
                {...register('convenio')}
              >
                <option value="">Selecione…</option>
                {conveniosDisponiveis.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="numero_carteirinha" label="Carteirinha">
                <Input
                  id="numero_carteirinha"
                  placeholder="Número da carteirinha"
                  {...register('numero_carteirinha')}
                />
              </Campo>
              <Campo id="validade" label="Validade" ajuda="Deixe em branco se não expira.">
                <Input id="validade" type="date" {...register('validade')} />
              </Campo>
            </div>

            <LinhaToggle
              titulo="Plano ativo"
              ajuda="Planos vencidos precisam ser renovados para faturar."
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

/** Renovação da validade de um plano vencido num drawer lateral. */
function RenovarPlanoDrawer({
  pacienteId,
  plano,
  trigger,
}: {
  pacienteId: number
  plano: Plano
  trigger: ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const [validade, setValidade] = useState('')
  const [erro, setErro] = useState('')
  const atualizar = useAtualizarPlano(pacienteId)
  const hoje = hojeLocal()

  useEffect(() => {
    if (aberto) {
      setValidade('')
      setErro('')
    }
  }, [aberto])

  async function renovar() {
    setErro('')
    if (!validade || validade < hoje) {
      setErro('Informe uma nova validade a partir de hoje.')
      return
    }
    try {
      await atualizar.mutateAsync({ id: plano.id, dados: { validade, status: 'ATIVO' } })
      toast.success('Plano renovado.')
      setAberto(false)
    } catch (excecao) {
      setErro((excecao as ErroApi).mensagem ?? 'Não foi possível renovar o plano.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <CabecalhoDrawer
          icone={RotateCcw}
          titulo="Renovar plano"
          descricao="Convênio vencido — defina a nova validade para reativá-lo."
        />

        <div className="flex flex-1 flex-col gap-4">
          <CorpoDrawer>
            <Campo id="nova-validade" label="Nova validade" obrigatorio erro={erro || undefined}>
              <Input
                id="nova-validade"
                type="date"
                min={hoje}
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
              />
            </Campo>
          </CorpoDrawer>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </SheetClose>
            <Button type="button" onClick={renovar}>
              Renovar
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  )
}
