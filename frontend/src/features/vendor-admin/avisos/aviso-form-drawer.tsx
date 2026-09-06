import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Megaphone, Loader2, ImageIcon, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import {
  CabecalhoDrawer,
  CorpoDrawer,
  SecaoForm,
  Campo,
  LinhaToggle,
} from '@/components/common/form-kit'
import { ICONES_AVISO } from '@/features/avisos/icones'
import { BotaoVendorPrimario, BotaoVendorSecundario } from '../ui/vendor-ui'
import { type AvisoVendor, useAtualizarAviso, useCriarAviso } from './use-vendor-avisos'

const classeCampoVendor = 'bg-[#0B132B]/80 border-[#1E2D56] text-white focus-visible:border-[#D4AF37]'

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

const schema = z.object({
  titulo: z.string().min(1, 'Informe o título do aviso'),
  descricao: z.string(),
  imagem_url: z.string(),
  icone: z.string(),
  link_url: z.string(),
  link_rotulo: z.string(),
  publicado_em: z.string().min(1, 'Informe a data de publicação'),
  dias_visibilidade: z.number().int().min(1, 'Mínimo de 1 dia'),
  ordem: z.number().int().min(0),
  ativo: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function valoresIniciais(aviso?: AvisoVendor, ordemSugerida?: number): FormValues {
  return {
    titulo: aviso?.titulo ?? '',
    descricao: aviso?.descricao ?? '',
    imagem_url: aviso?.imagem_url ?? '',
    icone: aviso?.icone ?? 'megafone',
    link_url: aviso?.link_url ?? '',
    link_rotulo: aviso?.link_rotulo ?? '',
    publicado_em: aviso?.publicado_em ?? hoje(),
    dias_visibilidade: aviso?.dias_visibilidade ?? 7,
    ordem: aviso?.ordem ?? ordemSugerida ?? 0,
    ativo: aviso?.ativo ?? true,
  }
}

type Props = {
  trigger: ReactNode
  aviso?: AvisoVendor
  /** Só usada ao criar (sem `aviso`): próxima posição livre no carrossel,
   * calculada a partir dos avisos vigentes — evita ter que descobrir o
   * número manualmente. Continua editável. */
  ordemSugerida?: number
}

export function AvisoFormDrawer({ trigger, aviso, ordemSugerida }: Props) {
  const [aberto, setAberto] = useState(false)
  const edicao = Boolean(aviso)

  const criar = useCriarAviso()
  const atualizar = useAtualizarAviso()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresIniciais(aviso, ordemSugerida),
  })

  useEffect(() => {
    if (aberto) reset(valoresIniciais(aviso, ordemSugerida))
  }, [aberto, aviso, ordemSugerida, reset])

  async function onSubmit(valores: FormValues) {
    try {
      if (edicao && aviso) {
        await atualizar.mutateAsync({ id: aviso.id, dados: valores })
        toast.success('Aviso atualizado com sucesso.')
      } else {
        await criar.mutateAsync(valores)
        toast.success('Aviso criado com sucesso.')
      }
      setAberto(false)
    } catch (excecao: unknown) {
      const err = excecao as { mensagem?: string }
      toast.error(err?.mensagem ?? 'Falha ao salvar o aviso.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="dark flex flex-col sm:max-w-lg bg-[#111D3B] border-[#1E2D56] text-slate-100 p-6 overflow-hidden">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <CabecalhoDrawer
            icone={Megaphone}
            titulo={edicao ? `Editar aviso` : 'Novo aviso'}
            descricao="Aparece em carrossel para os usuários das clínicas logo após o login."
          />

          <CorpoDrawer className="mt-6 space-y-6">
            <SecaoForm titulo="Conteúdo" icone={Megaphone}>
              <Campo id="aviso-titulo" label="Título" obrigatorio erro={errors.titulo?.message}>
                <Input
                  id="aviso-titulo"
                  {...register('titulo')}
                  placeholder="Ex: Novo módulo de Estoque"
                  className={classeCampoVendor}
                />
              </Campo>

              <Campo id="aviso-descricao" label="Descrição" ajuda="Opcional">
                <Input
                  id="aviso-descricao"
                  {...register('descricao')}
                  placeholder="Texto curto explicando a novidade"
                  className={classeCampoVendor}
                />
              </Campo>
            </SecaoForm>

            <SecaoForm titulo="Imagem & Link" icone={ImageIcon}>
              <Campo id="aviso-imagem" label="URL da imagem" ajuda="Opcional — link externo, sem upload">
                <Input
                  id="aviso-imagem"
                  {...register('imagem_url')}
                  placeholder="https://…"
                  className={classeCampoVendor}
                />
              </Campo>

              <Campo
                id="aviso-icone"
                label="Ícone"
                ajuda="Exibido no lugar da imagem quando não houver URL"
              >
                <select
                  id="aviso-icone"
                  {...register('icone')}
                  className={`h-9 w-full rounded-md border px-3 text-sm ${classeCampoVendor}`}
                >
                  {Object.entries(ICONES_AVISO).map(([chave, { rotulo }]) => (
                    <option key={chave} value={chave}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </Campo>

              <div className="grid grid-cols-2 gap-3">
                <Campo id="aviso-link" label="Link (saiba mais)" ajuda="Opcional">
                  <Input
                    id="aviso-link"
                    {...register('link_url')}
                    placeholder="https://…"
                    className={classeCampoVendor}
                  />
                </Campo>
                <Campo id="aviso-link-rotulo" label="Rótulo do botão">
                  <Input
                    id="aviso-link-rotulo"
                    {...register('link_rotulo')}
                    placeholder="Saiba mais"
                    className={classeCampoVendor}
                  />
                </Campo>
              </div>
            </SecaoForm>

            <SecaoForm titulo="Vigência" icone={CalendarClock}>
              <div className="grid grid-cols-2 gap-3">
                <Campo id="aviso-publicado" label="Publicado em" obrigatorio erro={errors.publicado_em?.message}>
                  <Input
                    id="aviso-publicado"
                    type="date"
                    {...register('publicado_em')}
                    className={classeCampoVendor}
                  />
                </Campo>
                <Campo id="aviso-dias" label="Dias visível" obrigatorio erro={errors.dias_visibilidade?.message}>
                  <Input
                    id="aviso-dias"
                    type="number"
                    {...register('dias_visibilidade', { valueAsNumber: true })}
                    className={classeCampoVendor}
                  />
                </Campo>
              </div>

              <Campo id="aviso-ordem" label="Ordem no carrossel" ajuda="Menor número aparece primeiro">
                <Input
                  id="aviso-ordem"
                  type="number"
                  {...register('ordem', { valueAsNumber: true })}
                  className={classeCampoVendor}
                />
              </Campo>

              <LinhaToggle
                titulo="Aviso ativo"
                ajuda="Quando desativado, não aparece no carrossel mesmo dentro do período."
                {...register('ativo')}
                className="bg-[#0B132B]/60 border-[#1E2D56]"
              />
            </SecaoForm>
          </CorpoDrawer>

          <SheetFooter className="mt-auto border-t border-[#1E2D56] pt-4 flex gap-2">
            <SheetClose asChild>
              <BotaoVendorSecundario type="button">Cancelar</BotaoVendorSecundario>
            </SheetClose>
            <BotaoVendorPrimario type="submit" disabled={isSubmitting} className="cursor-pointer">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                'Salvar Aviso'
              )}
            </BotaoVendorPrimario>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

