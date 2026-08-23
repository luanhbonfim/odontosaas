import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { InputCpf, InputTelefone } from '@/components/common/campos-mascarados'
import { Cpf, DateText, PhoneText } from '@/components/common/formato'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSessao } from '@/features/auth/use-sessao'
import { useDentistas } from '@/features/dentistas/use-dentistas'
import type { ErroApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import {
  type Paciente,
  type PacienteEntrada,
  useAtualizarPaciente,
  useCriarPaciente,
} from './use-pacientes'

const schema = z.object({
  nome_completo: z.string().min(1, 'Informe o nome'),
  cpf: z.string().refine((v) => v.replace(/\D/g, '').length === 11, 'CPF deve ter 11 dígitos'),
  data_nascimento: z.string(),
  telefone_whatsapp: z.string(),
  email: z.string().email('E-mail inválido').or(z.literal('')),
  endereco: z.string(),
  dentista_responsavel: z.string(),
  dentistas_compartilhados: z.array(z.number()),
  ativo: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function valoresIniciais(paciente?: Paciente): FormValues {
  return {
    nome_completo: paciente?.nome_completo ?? '',
    cpf: paciente?.cpf ?? '',
    data_nascimento: paciente?.data_nascimento ?? '',
    telefone_whatsapp: paciente?.telefone_whatsapp ?? '',
    email: paciente?.email ?? '',
    endereco: paciente?.endereco ?? '',
    dentista_responsavel: paciente?.dentista_responsavel
      ? String(paciente.dentista_responsavel)
      : '',
    dentistas_compartilhados: paciente?.dentistas_compartilhados ?? [],
    ativo: paciente?.ativo ?? true,
  }
}

const Obrigatorio = () => (
  <span aria-hidden="true" className="text-destructive">
    {' '}
    *
  </span>
)
const traco = <span className="text-muted-foreground">—</span>
const classeSelect = cn(
  'h-9 w-full cursor-pointer rounded-md border bg-transparent px-3 text-sm',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
)

/** Aba "Dados": visão read-only com botão Editar, ou o formulário (edição/criação). */
export function AbaDados({ paciente, modoCriacao }: { paciente?: Paciente; modoCriacao: boolean }) {
  const [editando, setEditando] = useState(false)

  if (modoCriacao || editando) {
    return (
      <FormDados
        paciente={paciente}
        modoCriacao={modoCriacao}
        onCancelar={() => setEditando(false)}
      />
    )
  }
  if (!paciente) return null
  return <VisaoDados paciente={paciente} onEditar={() => setEditando(true)} />
}

function VisaoDados({ paciente, onEditar }: { paciente: Paciente; onEditar: () => void }) {
  const linhas: [string, ReactNode][] = [
    ['Nome', paciente.nome_completo],
    ['CPF', paciente.cpf ? <Cpf valor={paciente.cpf} /> : traco],
    ['Nascimento', paciente.data_nascimento ? <DateText iso={paciente.data_nascimento} /> : traco],
    [
      'Telefone',
      paciente.telefone_whatsapp ? <PhoneText valor={paciente.telefone_whatsapp} /> : traco,
    ],
    ['E-mail', paciente.email || traco],
    ['Endereço', paciente.endereco || traco],
    ['Dentista responsável', paciente.dentista_responsavel_nome || traco],
    [
      'Compartilhado com',
      paciente.dentistas_compartilhados_nomes?.length
        ? paciente.dentistas_compartilhados_nomes.join(', ')
        : traco,
    ],
    [
      'Status',
      paciente.ativo ? (
        <StatusBadge variante="sucesso">Ativo</StatusBadge>
      ) : (
        <StatusBadge variante="neutro">Inativo</StatusBadge>
      ),
    ],
  ]
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="mb-4 flex">
          <Button variant="outline" size="sm" onClick={onEditar} className="w-full sm:ml-auto sm:w-auto">
            <Pencil /> Editar
          </Button>
        </div>
        {/* Pares rótulo/valor com divisória sutil no mobile (fica mais legível que só empilhado). */}
        <div className="grid gap-x-8 sm:grid-cols-2 sm:gap-y-4">
          {linhas.map(([rotulo, valor]) => (
            <div
              key={rotulo}
              className="flex flex-col gap-0.5 border-b py-2 last:border-b-0 sm:border-b-0 sm:py-0"
            >
              <span className="text-xs text-muted-foreground">{rotulo}</span>
              <span className="text-sm font-medium">{valor}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function FormDados({
  paciente,
  modoCriacao,
  onCancelar,
}: {
  paciente?: Paciente
  modoCriacao: boolean
  onCancelar: () => void
}) {
  const navigate = useNavigate()
  const criar = useCriarPaciente()
  const atualizar = useAtualizarPaciente()
  const { data: dentistas } = useDentistas()
  const { usuario } = useSessao()
  // Dentista comum não define responsável/compartilhamento (o backend ignora e
  // se auto-atribui ao cadastrar). Dentista gerente e demais papéis podem.
  const ehDentistaComum = usuario?.papel === 'DENTISTA'

  const {
    register,
    control,
    watch,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresIniciais(paciente),
  })

  // Responsável selecionado (reativo): não pode aparecer como opção de compartilhamento.
  const responsavelSelecionado = watch('dentista_responsavel')
  const responsavelIdAtual = responsavelSelecionado ? Number(responsavelSelecionado) : null

  async function onSubmit(valores: FormValues) {
    const responsavelId = valores.dentista_responsavel ? Number(valores.dentista_responsavel) : null
    const dados: PacienteEntrada = {
      nome_completo: valores.nome_completo,
      cpf: valores.cpf.replace(/\D/g, ''),
      data_nascimento: valores.data_nascimento || null,
      telefone_whatsapp: valores.telefone_whatsapp,
      email: valores.email,
      endereco: valores.endereco,
      dentista_responsavel: responsavelId,
      // Nunca compartilha com o próprio responsável.
      dentistas_compartilhados: (valores.dentistas_compartilhados ?? []).filter(
        (id) => id !== responsavelId,
      ),
      ativo: valores.ativo,
    }
    try {
      if (modoCriacao) {
        const novo = await criar.mutateAsync(dados)
        toast.success('Paciente criado.')
        navigate(`/pacientes/${novo.id}`)
      } else if (paciente) {
        await atualizar.mutateAsync({ id: paciente.id, dados })
        toast.success('Paciente atualizado.')
        onCancelar()
      }
    } catch (excecao) {
      const erro = excecao as ErroApi
      if (erro.campos?.cpf) setError('cpf', { message: erro.campos.cpf[0] })
      else if (erro.campos?.email) setError('email', { message: erro.campos.email[0] })
      else toast.error(erro.mensagem ?? 'Não foi possível salvar.')
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome_completo">
              Nome
              <Obrigatorio />
            </Label>
            <Input
              id="nome_completo"
              aria-required="true"
              aria-invalid={!!errors.nome_completo}
              {...register('nome_completo')}
            />
            {errors.nome_completo && (
              <p className="text-xs text-destructive">{errors.nome_completo.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cpf">
                CPF
                <Obrigatorio />
              </Label>
              <Controller
                control={control}
                name="cpf"
                render={({ field }) => (
                  <InputCpf
                    id="cpf"
                    aria-required="true"
                    aria-invalid={!!errors.cpf}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
              {errors.cpf && <p className="text-xs text-destructive">{errors.cpf.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data_nascimento">Nascimento</Label>
              <Input id="data_nascimento" type="date" {...register('data_nascimento')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="telefone_whatsapp">Telefone</Label>
              <Controller
                control={control}
                name="telefone_whatsapp"
                render={({ field }) => (
                  <InputTelefone
                    id="telefone_whatsapp"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" aria-invalid={!!errors.email} {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="endereco">Endereço</Label>
            <Input id="endereco" {...register('endereco')} />
          </div>

          {!ehDentistaComum && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="dentista_responsavel">Dentista responsável</Label>
                <select
                  id="dentista_responsavel"
                  className={classeSelect}
                  {...register('dentista_responsavel')}
                >
                  <option value="">Sem responsável definido</option>
                  {(dentistas ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome_completo}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  O dentista responsável faz as tratativas e enxerga este paciente na sua visão.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="compartilhar">Compartilhado com</Label>
                <p className="text-xs text-muted-foreground">
                  Outros dentistas que também atendem este paciente (ex.: responsável de férias).
                </p>
                <Controller
                  control={control}
                  name="dentistas_compartilhados"
                  render={({ field }) => {
                    const disponiveis = (dentistas ?? []).filter(
                      (d) => d.id !== responsavelIdAtual && !field.value.includes(d.id),
                    )
                    const selecionados = (dentistas ?? []).filter(
                      (d) => field.value.includes(d.id) && d.id !== responsavelIdAtual,
                    )
                    return (
                      <div className="space-y-2">
                        <select
                          id="compartilhar"
                          className={classeSelect}
                          value=""
                          onChange={(evento) => {
                            const id = Number(evento.target.value)
                            if (id) field.onChange([...field.value, id])
                          }}
                        >
                          <option value="">Adicionar dentista…</option>
                          {disponiveis.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.nome_completo}
                            </option>
                          ))}
                        </select>
                        {selecionados.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {selecionados.map((d) => (
                              <span
                                key={d.id}
                                className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs"
                              >
                                {d.nome_completo}
                                <button
                                  type="button"
                                  aria-label={`Remover ${d.nome_completo}`}
                                  className="cursor-pointer text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    field.onChange(field.value.filter((id) => id !== d.id))
                                  }
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
              </div>
            </>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 cursor-pointer accent-primary"
              {...register('ativo')}
            />
            Ativo
          </label>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => (modoCriacao ? navigate('/pacientes') : onCancelar())}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
