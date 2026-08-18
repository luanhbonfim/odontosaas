import { zodResolver } from '@hookform/resolvers/zod'
import { UserRound, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  CabecalhoDrawer,
  Campo,
  classeCampoSelect,
  CorpoDrawer,
  LinhaToggle,
  SecaoForm,
} from '@/components/common/form-kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetTrigger } from '@/components/ui/sheet'
import { useSessao } from '@/features/auth/use-sessao'
import { useDentistas } from '@/features/dentistas/use-dentistas'
import type { ErroApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import {
  ACESSO_PAPEL,
  papeisGerenciaveis,
  type Usuario,
  type UsuarioEntrada,
  useAtualizarUsuario,
  useCriarUsuario,
} from './use-usuarios'

const schema = z.object({
  nome_completo: z.string().min(1, 'Informe o nome'),
  email: z.string().min(1, 'Informe o e-mail').email('E-mail inválido'),
  papel: z.enum(['ADMIN', 'DENTISTA_GERENTE', 'DENTISTA', 'RECEPCAO']),
  senha: z.string(),
  ativo: z.boolean(),
  dentista: z.string(),
})

type FormValues = z.infer<typeof schema>

/** Papéis cujo login representa um profissional (podem ser atrelados a um dentista). */
const PAPEIS_DENTISTA = ['DENTISTA', 'DENTISTA_GERENTE']

function valoresIniciais(usuario?: Usuario): FormValues {
  return {
    nome_completo: usuario?.nome_completo ?? '',
    email: usuario?.email ?? '',
    papel: usuario?.papel ?? 'RECEPCAO',
    senha: '',
    ativo: usuario?.ativo ?? true,
    dentista: usuario?.dentista_id ? String(usuario.dentista_id) : '',
  }
}

export function UsuarioFormDrawer({ trigger, usuario }: { trigger: ReactNode; usuario?: Usuario }) {
  const [aberto, setAberto] = useState(false)
  const criar = useCriarUsuario()
  const atualizar = useAtualizarUsuario()
  const { data: dentistas } = useDentistas()
  const { usuario: sessao } = useSessao()
  const edicao = Boolean(usuario)
  // Auto-edição: editando o próprio cadastro só se altera nome e senha.
  const souEu = Boolean(usuario && sessao && usuario.id === sessao.id)

  // Só é possível atribuir perfis abaixo do seu (Admin atribui todos).
  const papeisDisponiveis = papeisGerenciaveis(sessao?.papel)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresIniciais(usuario),
  })

  const papelSelecionado = watch('papel')
  const dentistaSelecionado = watch('dentista')
  // Disponíveis p/ vínculo: sem login OU o próprio deste usuário (que será trocado).
  const dentistasDisponiveis = (dentistas ?? []).filter(
    (d) => !d.usuario || d.usuario === usuario?.id,
  )
  const nomeDentistaVinculado =
    dentistas?.find((d) => String(d.id) === dentistaSelecionado)?.nome_completo ??
    usuario?.dentista_nome ??
    'Dentista'

  useEffect(() => {
    if (aberto) reset(valoresIniciais(usuario))
  }, [aberto, usuario, reset])

  async function onSubmit(valores: FormValues) {
    // Na criação a senha é obrigatória; na edição, só troca se preenchida.
    if (!edicao && !valores.senha) {
      setError('senha', { message: 'Informe a senha' })
      return
    }
    // Auto-edição: só nome e senha (o backend também barra papel/bloqueio próprio).
    const dados: Partial<UsuarioEntrada> = souEu
      ? { nome_completo: valores.nome_completo }
      : {
          nome_completo: valores.nome_completo,
          email: valores.email,
          papel: valores.papel,
          ativo: valores.ativo,
          // Vínculo com o profissional só vale para papéis de dentista; senão, desfaz.
          dentista: PAPEIS_DENTISTA.includes(valores.papel)
            ? valores.dentista
              ? Number(valores.dentista)
              : null
            : null,
        }
    if (valores.senha) dados.senha = valores.senha

    try {
      if (edicao && usuario) await atualizar.mutateAsync({ id: usuario.id, dados })
      else await criar.mutateAsync(dados as UsuarioEntrada)
      toast.success(edicao ? 'Usuário atualizado.' : 'Usuário criado.')
      setAberto(false)
    } catch (excecao) {
      const erro = excecao as ErroApi
      if (erro.campos?.email) setError('email', { message: erro.campos.email[0] })
      else if (erro.campos?.senha) setError('senha', { message: erro.campos.senha[0] })
      else if (erro.campos?.dentista) setError('dentista', { message: erro.campos.dentista[0] })
      else toast.error(erro.mensagem ?? 'Não foi possível salvar.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <CabecalhoDrawer
          icone={UserRound}
          titulo={souEu ? 'Meu cadastro' : edicao ? 'Editar usuário' : 'Novo usuário'}
          descricao={
            souEu
              ? 'Você está editando o seu próprio cadastro — apenas nome e senha.'
              : 'Membro da equipe da clínica.'
          }
        />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4">
          <CorpoDrawer>
            <SecaoForm titulo="Dados">
              <Campo
                id="nome_completo"
                label="Nome"
                obrigatorio
                erro={errors.nome_completo?.message}
              >
                <Input
                  id="nome_completo"
                  placeholder="Nome completo"
                  aria-required="true"
                  aria-invalid={errors.nome_completo ? true : undefined}
                  {...register('nome_completo')}
                />
              </Campo>
              <Campo id="email" label="E-mail" obrigatorio erro={errors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  aria-required="true"
                  aria-invalid={errors.email ? true : undefined}
                  readOnly={souEu}
                  className={cn(souEu && 'cursor-not-allowed opacity-60')}
                  {...register('email')}
                />
              </Campo>
            </SecaoForm>

            {!souEu && (
              <SecaoForm titulo="Acesso">
                <Campo id="papel" label="Perfil" obrigatorio>
                  <select id="papel" className={classeCampoSelect} {...register('papel')}>
                    {papeisDisponiveis.map((papel) => (
                      <option key={papel.valor} value={papel.valor}>
                        {papel.rotulo}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1.5 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Acesso deste perfil:</span>{' '}
                    <span>{ACESSO_PAPEL[papelSelecionado]}</span>
                  </div>
                </Campo>

                {/* Vínculo com o profissional: só para papéis de dentista. */}
                {PAPEIS_DENTISTA.includes(papelSelecionado) && (
                  <Campo
                    id="dentista"
                    label="Dentista vinculado"
                    erro={errors.dentista?.message}
                    ajuda={
                      dentistaSelecionado
                        ? undefined
                        : 'Atrela este login ao cadastro do dentista (opcional).'
                    }
                  >
                    {dentistaSelecionado ? (
                      <div className="flex items-center justify-between rounded-md border bg-muted px-3 py-1.5 text-sm">
                        <span className="font-medium">{nomeDentistaVinculado}</span>
                        <button
                          type="button"
                          aria-label="Remover vínculo do dentista"
                          className="cursor-pointer text-muted-foreground hover:text-destructive"
                          onClick={() => setValue('dentista', '', { shouldDirty: true })}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <select id="dentista" className={classeCampoSelect} {...register('dentista')}>
                        <option value="">Sem vínculo</option>
                        {dentistasDisponiveis.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nome_completo} — CRO {d.cro}
                          </option>
                        ))}
                      </select>
                    )}
                  </Campo>
                )}
              </SecaoForm>
            )}

            <SecaoForm titulo="Segurança">
              <Campo
                id="senha"
                label={edicao ? 'Nova senha (opcional)' : 'Senha'}
                obrigatorio={!edicao}
                erro={errors.senha?.message}
                ajuda={edicao ? 'Deixe em branco para manter a senha atual.' : undefined}
              >
                <Input
                  id="senha"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={errors.senha ? true : undefined}
                  {...register('senha')}
                />
              </Campo>
            </SecaoForm>

            {!souEu && (
              <LinhaToggle
                titulo="Usuário ativo"
                ajuda="Inativos não conseguem entrar no sistema."
                {...register('ativo')}
              />
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
