import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Package, Loader2, DollarSign, Users, Database, Layers } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CabecalhoDrawer,
  CorpoDrawer,
  SecaoForm,
  Campo,
  LinhaToggle,
  classeCampoSelect,
} from '@/components/common/form-kit'
import {
  type PlanoAssinaturaVendor,
  useAtualizarPlano,
  useCriarPlano,
} from './use-vendor-planos'

const schema = z.object({
  nome: z.string().min(1, 'Informe o nome do plano'),
  periodicidade: z.enum(['MENSAL', 'ANUAL', 'PERMANENTE']),
  preco_mensal: z.number().min(0, 'Preço mensal inválido'),
  preco_anual: z.number().min(0, 'Preço anual inválido').nullable().optional(),
  limite_dentistas: z.number().int().min(1, 'Mínimo de 1 dentista'),
  limite_usuarios: z.number().int().min(1, 'Mínimo de 1 usuário'),
  limite_pacientes_ativos: z.number().int().min(0, 'Limite de pacientes inválido'),
  limite_armazenamento_mb: z.number().int().min(100, 'Mínimo de 100 MB'),
  modulo_financeiro_ativo: z.boolean(),
  modulo_estoque_ativo: z.boolean(),
  sync_google_ativo: z.boolean(),
  whatsapp_waha_ativo: z.boolean(),
  ativo: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function valoresIniciais(plano?: PlanoAssinaturaVendor): FormValues {
  return {
    nome: plano?.nome ?? '',
    periodicidade: plano?.periodicidade ?? 'MENSAL',
    preco_mensal: plano ? Number(plano.preco_mensal) : 199,
    preco_anual: plano?.preco_anual ? Number(plano.preco_anual) : null,
    limite_dentistas: plano?.limite_dentistas ?? 5,
    limite_usuarios: plano?.limite_usuarios ?? 10,
    limite_pacientes_ativos: plano?.limite_pacientes_ativos ?? 1000,
    limite_armazenamento_mb: plano?.limite_armazenamento_mb ?? 5120,
    modulo_financeiro_ativo: plano?.modulo_financeiro_ativo ?? true,
    modulo_estoque_ativo: plano?.modulo_estoque_ativo ?? true,
    sync_google_ativo: plano?.sync_google_ativo ?? true,
    whatsapp_waha_ativo: plano?.whatsapp_waha_ativo ?? true,
    ativo: plano?.ativo ?? true,
  }
}

type Props = {
  trigger: ReactNode
  plano?: PlanoAssinaturaVendor
}

export function PlanoFormDrawer({ trigger, plano }: Props) {
  const [aberto, setAberto] = useState(false)
  const edicao = Boolean(plano)

  const criar = useCriarPlano()
  const atualizar = useAtualizarPlano()

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
    try {
      if (edicao && plano) {
        await atualizar.mutateAsync({ id: plano.id, dados: valores })
        toast.success('Plano atualizado com sucesso.')
      } else {
        await criar.mutateAsync(valores)
        toast.success('Plano criado com sucesso.')
      }
      setAberto(false)
    } catch (excecao: unknown) {
      const err = excecao as { mensagem?: string }
      toast.error(err?.mensagem ?? 'Falha ao salvar dados do plano.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="dark flex flex-col sm:max-w-lg bg-[#111D3B] border-[#1E2D56] text-slate-100 p-6 overflow-hidden">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <CabecalhoDrawer
            icone={Package}
            titulo={edicao ? `Editar ${plano?.nome}` : 'Novo Plano Comercial'}
            descricao="Defina os preços, limites de capacidade e módulos inclusos para as clínicas."
          />

          <CorpoDrawer className="mt-6 space-y-6">
            {/* Precificação e Identificação */}
            <SecaoForm titulo="Identificação & Preços" icone={DollarSign}>
              <Campo id="plano-nome" label="Nome do Plano" obrigatorio erro={errors.nome?.message}>
                <Input
                  id="plano-nome"
                  {...register('nome')}
                  placeholder="Ex: Plano Gold / Odonto Pro"
                  className="bg-[#0B132B]/80 border-[#1E2D56] text-white focus-visible:border-[#D4AF37]"
                />
              </Campo>

              <Campo id="plano-periodicidade" label="Ciclo de Cobrança / Renovação" obrigatorio erro={errors.periodicidade?.message}>
                <select
                  id="plano-periodicidade"
                  {...register('periodicidade')}
                  className={`${classeCampoSelect} bg-[#0B132B]/80 border-[#1E2D56] text-white`}
                >
                  <option value="MENSAL">Mensal (Renovação a cada 30 dias)</option>
                  <option value="ANUAL">Anual (Renovação a cada 365 dias)</option>
                  <option value="PERMANENTE">Permanente (Vitalício / Sem Vencimento)</option>
                </select>
              </Campo>

              <div className="grid grid-cols-2 gap-3">
                <Campo id="plano-preco-mensal" label="Mensalidade (R$)" obrigatorio erro={errors.preco_mensal?.message}>
                  <Input
                    id="plano-preco-mensal"
                    type="number"
                    step="0.01"
                    {...register('preco_mensal', { valueAsNumber: true })}
                    className="bg-[#0B132B]/80 border-[#1E2D56] text-white"
                  />
                </Campo>

                <Campo id="plano-preco-anual" label="Anuidade (R$)" erro={errors.preco_anual?.message} ajuda="Opcional com desconto">
                  <Input
                    id="plano-preco-anual"
                    type="number"
                    step="0.01"
                    {...register('preco_anual', {
                      setValueAs: (v) => (v === '' || Number.isNaN(Number(v)) ? null : Number(v)),
                    })}
                    placeholder="Sem anuidade"
                    className="bg-[#0B132B]/80 border-[#1E2D56] text-white"
                  />
                </Campo>
              </div>
            </SecaoForm>

            {/* Limites de Capacidade */}
            <SecaoForm titulo="Limites de Capacidade" icone={Users}>
              <div className="grid grid-cols-2 gap-3">
                <Campo id="plano-dentistas" label="Limite Dentistas" obrigatorio erro={errors.limite_dentistas?.message}>
                  <Input
                    id="plano-dentistas"
                    type="number"
                    {...register('limite_dentistas', { valueAsNumber: true })}
                    className="bg-[#0B132B]/80 border-[#1E2D56] text-white"
                  />
                </Campo>

                <Campo id="plano-usuarios" label="Limite Usuários" obrigatorio erro={errors.limite_usuarios?.message}>
                  <Input
                    id="plano-usuarios"
                    type="number"
                    {...register('limite_usuarios', { valueAsNumber: true })}
                    className="bg-[#0B132B]/80 border-[#1E2D56] text-white"
                  />
                </Campo>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Campo id="plano-pacientes" label="Pacientes Ativos" obrigatorio erro={errors.limite_pacientes_ativos?.message}>
                  <Input
                    id="plano-pacientes"
                    type="number"
                    {...register('limite_pacientes_ativos', { valueAsNumber: true })}
                    className="bg-[#0B132B]/80 border-[#1E2D56] text-white"
                  />
                </Campo>

                <Campo id="plano-storage" label="Armazenamento (MB)" obrigatorio erro={errors.limite_armazenamento_mb?.message}>
                  <Input
                    id="plano-storage"
                    type="number"
                    {...register('limite_armazenamento_mb', { valueAsNumber: true })}
                    className="bg-[#0B132B]/80 border-[#1E2D56] text-white"
                  />
                </Campo>
              </div>
            </SecaoForm>

            {/* Módulos Habilitados */}
            <SecaoForm titulo="Módulos & Recursos" icone={Layers}>
              <div className="space-y-2">
                <LinhaToggle
                  titulo="Módulo Financeiro"
                  ajuda="Contas a pagar/receber, fluxo de caixa e relatórios DRE."
                  {...register('modulo_financeiro_ativo')}
                  className="bg-[#0B132B]/60 border-[#1E2D56]"
                />

                <LinhaToggle
                  titulo="Módulo de Estoque"
                  ajuda="Controle de insumos, movimentações e alertas de estoque baixo."
                  {...register('modulo_estoque_ativo')}
                  className="bg-[#0B132B]/60 border-[#1E2D56]"
                />

                <LinhaToggle
                  titulo="Integração Google Calendar"
                  ajuda="Sincronização bidirecional de consultas por dentista."
                  {...register('sync_google_ativo')}
                  className="bg-[#0B132B]/60 border-[#1E2D56]"
                />

                <LinhaToggle
                  titulo="Notificações WhatsApp (WAHA)"
                  ajuda="Confirmação de consultas, lembretes e avisos automáticos."
                  {...register('whatsapp_waha_ativo')}
                  className="bg-[#0B132B]/60 border-[#1E2D56]"
                />
              </div>
            </SecaoForm>

            {/* Status do Plano */}
            <SecaoForm titulo="Disponibilidade" icone={Database}>
              <LinhaToggle
                titulo="Plano Ativo para Novas Vendas"
                ajuda="Quando desativado, não aparecerá na lista de provisionamento de novos clientes."
                {...register('ativo')}
                className="bg-[#0B132B]/60 border-[#1E2D56]"
              />
            </SecaoForm>
          </CorpoDrawer>

          <SheetFooter className="mt-auto border-t border-[#1E2D56] pt-4 flex gap-2">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="border-[#1E2D56] text-slate-300 hover:bg-[#1A2A4E] hover:text-white">
                Cancelar
              </Button>
            </SheetClose>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 font-bold shadow-md cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                'Salvar Plano'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
