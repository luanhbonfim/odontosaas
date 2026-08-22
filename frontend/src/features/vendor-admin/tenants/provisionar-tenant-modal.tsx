import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Globe, Shield, User, Loader2, Sparkles, Check, Edit3 } from 'lucide-react'
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
  classeCampoSelect,
} from '@/components/common/form-kit'
import { mascararCnpj, mascararCpf, mascararTelefone } from '@/lib/utils/mascaras'
import { useVendorPlanos, type PlanoAssinaturaVendor } from '../planos/use-vendor-planos'
import { useProvisionarTenant, type ProvisionarTenantInput } from './use-vendor-tenants'

const schema = z.object({
  // 1. Dados do Responsável / Assinante (Contato)
  responsavel_nome: z.string().min(2, 'Informe o nome completo do responsável'),
  responsavel_cpf: z
    .string()
    .min(14, 'Informe um CPF válido (11 dígitos)')
    .max(14, 'CPF inválido'),
  responsavel_telefone: z.string().min(10, 'Informe o telefone/WhatsApp do responsável'),
  responsavel_email: z.string().email('Informe um e-mail de contato válido'),

  // 2. Dados da Clínica (Obrigatórios)
  nome_fantasia: z.string().min(2, 'Informe o nome fantasia da clínica'),
  razao_social: z.string().min(2, 'Informe a razão social da clínica'),
  cnpj: z.string().min(18, 'Informe um CNPJ válido (14 dígitos)'),
  telefone_clinica: z.string().optional(),

  // 3. Schema PostgreSQL & Domínio (Gerados automaticamente com override manual)
  schema_name: z
    .string()
    .min(1, 'Informe o nome do schema')
    .regex(/^[a-z0-9_]+$/, 'Use apenas letras minúsculas, números e underline')
    .max(63, 'Máximo de 63 caracteres'),
  dominio: z
    .string()
    .min(1, 'Informe o domínio de acesso da clínica')
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
      'Domínio inválido: use apenas letras minúsculas, números e hífen (sem underline), ex.: minha-clinica.proclinica.cloud',
    ),

  // 4. Plano Comercial & Início de Contrato (Obrigatório)
  plano_id: z.number({ message: 'Selecione um plano comercial para a clínica' }).min(1, 'Selecione um plano comercial'),
  data_inicio_contrato: z.string().min(1, 'Informe a data de início do contrato'),
})

type FormValues = z.infer<typeof schema>

function normalizarSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
}

/**
 * Domínio base da plataforma, derivado do host do próprio painel:
 *   - dev:  localhost              (painel em localhost:5173)
 *   - prod: proclinica.cloud       (painel em ops-xxxx.proclinica.cloud → remove o 1º rótulo)
 * Assim o provisionamento nunca sai com `.localhost` fixo em produção.
 */
function dominioBasePlataforma(): string {
  const host = window.location.hostname
  const partes = host.split('.')
  return partes.length >= 3 ? partes.slice(1).join('.') : host
}

/** Rótulo DNS-safe a partir do schema (subdomínio não aceita `_`; troca por `-`). */
function rotuloDns(schema: string): string {
  return schema.replace(/_/g, '-').replace(/^-+|-+$/g, '')
}

function gerarOpcoesSugestoes(nome: string): { schema: string; dominio: string; rotulo: string }[] {
  const base = normalizarSlug(nome)
  if (!base) return []

  const bd = dominioBasePlataforma()
  const dom = (schema: string) => `${rotuloDns(schema)}.${bd}`

  const semPrefixo = base.replace(/^(clinica|consultorio|dr|dra|instituto|centro|odontologia)_+/, '')
  const opcoes: { schema: string; dominio: string; rotulo: string }[] = [
    { schema: base, dominio: dom(base), rotulo: 'Direto do Nome' },
  ]

  if (semPrefixo && semPrefixo !== base) {
    opcoes.push({ schema: semPrefixo, dominio: dom(semPrefixo), rotulo: 'Simplificado' })
    opcoes.push({ schema: `clinica_${semPrefixo}`, dominio: dom(`clinica_${semPrefixo}`), rotulo: 'Prefixo Clínica' })
  } else {
    opcoes.push({ schema: `clinica_${base}`, dominio: dom(`clinica_${base}`), rotulo: 'Prefixo Clínica' })
    opcoes.push({ schema: `${base}_odonto`, dominio: dom(`${base}_odonto`), rotulo: 'Sufixo Odonto' })
  }

  // Deduplica opções mantendo as 3 primeiras únicas
  const unicas: { schema: string; dominio: string; rotulo: string }[] = []
  const vistos = new Set<string>()
  for (const op of opcoes) {
    if (!vistos.has(op.schema)) {
      vistos.add(op.schema)
      unicas.push(op)
    }
  }

  return unicas.slice(0, 3)
}

// Máscaras vêm do módulo compartilhado (fonte única) — ver lib/utils/mascaras.
// Aliases mantêm os nomes usados nos handlers abaixo.
const formatarCpf = mascararCpf
const formatarCnpj = mascararCnpj
const formatarTelefone = mascararTelefone

type Props = {
  trigger: ReactNode
}

export function ProvisionarTenantModal({ trigger }: Props) {
  const [aberto, setAberto] = useState(false)
  const [sugestoes, setSugestoes] = useState<{ schema: string; dominio: string; rotulo: string }[]>([])
  const { data: planos } = useVendorPlanos()
  const provisionar = useProvisionarTenant()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      responsavel_nome: '',
      responsavel_cpf: '',
      responsavel_telefone: '',
      responsavel_email: '',
      nome_fantasia: '',
      razao_social: '',
      cnpj: '',
      telefone_clinica: '',
      schema_name: '',
      dominio: '',
      plano_id: undefined as unknown as number,
      data_inicio_contrato: new Date().toISOString().split('T')[0],
    },
  })

  const schemaAtual = watch('schema_name')
  const planoIdAtual = watch('plano_id')
  const dataInicioContrato = watch('data_inicio_contrato') || new Date().toISOString().split('T')[0]
  const listaPlanos: PlanoAssinaturaVendor[] = Array.isArray(planos)
    ? planos
    : Array.isArray((planos as unknown as { results?: PlanoAssinaturaVendor[] })?.results)
    ? ((planos as unknown as { results: PlanoAssinaturaVendor[] }).results ?? [])
    : []
  const planoSelecionado = listaPlanos.find((p) => p.id === planoIdAtual)

  function calcularDataVencimento(inicioStr: string, periodicidade?: string) {
    if (!periodicidade || periodicidade === 'PERMANENTE') return 'Sem data de expiração (Vitalício)'
    try {
      const dataInicio = new Date(`${inicioStr}T12:00:00`)
      if (isNaN(dataInicio.getTime())) return 'Data inválida'
      const dias = periodicidade === 'ANUAL' ? 365 : 30
      const dataFim = new Date(dataInicio.getTime() + dias * 24 * 60 * 60 * 1000)
      return dataFim.toLocaleDateString('pt-BR')
    } catch {
      return 'Data inválida'
    }
  }

  // Ao digitar o nome fantasia, recalcula as sugestões inteligentes
  function handleNomeFantasiaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nome = e.target.value
    setValue('nome_fantasia', nome, { shouldValidate: true })

    const opcoes = gerarOpcoesSugestoes(nome)
    setSugestoes(opcoes)

    if (opcoes.length > 0) {
      setValue('schema_name', opcoes[0].schema, { shouldValidate: true })
      setValue('dominio', opcoes[0].dominio, { shouldValidate: true })
    }
  }

  function aplicarSugestao(opcao: { schema: string; dominio: string }) {
    setValue('schema_name', opcao.schema, { shouldValidate: true })
    setValue('dominio', opcao.dominio, { shouldValidate: true })
  }

  function handlePlanoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value ? Number(e.target.value) : undefined
    setValue('plano_id', val as unknown as number, { shouldValidate: true })
  }

  async function onSubmit(valores: FormValues) {
    try {
      const payload: ProvisionarTenantInput = {
        nome_fantasia: valores.nome_fantasia,
        razao_social: valores.razao_social || undefined,
        cnpj: valores.cnpj ? valores.cnpj.replace(/\D/g, '') : null,
        schema_name: valores.schema_name,
        dominio: valores.dominio,
        plano_id: Number(valores.plano_id),
        data_inicio_contrato: valores.data_inicio_contrato || null,
        responsavel_nome: valores.responsavel_nome,
        responsavel_cpf: valores.responsavel_cpf.replace(/\D/g, ''),
        responsavel_telefone: valores.responsavel_telefone,
        responsavel_email: valores.responsavel_email,
        admin_email: valores.responsavel_email,
      }

      await provisionar.mutateAsync(payload)
      toast.success(`Clínica "${valores.nome_fantasia}" provisionada com sucesso!`)
      reset()
      setSugestoes([])
      setAberto(false)
    } catch (excecao: unknown) {
      const err = excecao as { mensagem?: string }
      toast.error(err?.mensagem ?? 'Falha ao provisionar clínica.')
    }
  }

  function handleOpenChange(open: boolean) {
    setAberto(open)
    if (!open) {
      reset({
        responsavel_nome: '',
        responsavel_cpf: '',
        responsavel_telefone: '',
        responsavel_email: '',
        nome_fantasia: '',
        razao_social: '',
        cnpj: '',
        telefone_clinica: '',
        schema_name: '',
        dominio: '',
        plano_id: undefined as unknown as number,
        data_inicio_contrato: new Date().toISOString().split('T')[0],
      })
      setSugestoes([])
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="dark flex flex-col sm:max-w-2xl bg-[#111D3B] border-[#1E2D56] text-slate-100 p-6 overflow-hidden">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <CabecalhoDrawer
            icone={Building2}
            titulo="Provisionar Nova Clínica"
            descricao="Cadastre o responsável assinante, dados da clínica e escolha o schema/domínio sugeridos."
          />

          <CorpoDrawer className="mt-6 space-y-6">
            {/* 1. DADOS DO RESPONSÁVEL / ASSINANTE (OBRIGATÓRIOS) */}
            <SecaoForm titulo="1. Dados do Responsável / Assinante" icone={User}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Campo
                  id="prov-resp-nome"
                  label="Nome Completo do Responsável"
                  obrigatorio
                  erro={errors.responsavel_nome?.message}
                >
                  <Input
                    id="prov-resp-nome"
                    {...register('responsavel_nome')}
                    placeholder="Dr. Carlos Eduardo da Silva"
                    className="bg-[#0B132B]/80 border-[#1E2D56] text-white"
                  />
                </Campo>

                <Campo
                  id="prov-resp-cpf"
                  label="CPF do Responsável"
                  obrigatorio
                  erro={errors.responsavel_cpf?.message}
                >
                  <Input
                    id="prov-resp-cpf"
                    {...register('responsavel_cpf', {
                      onChange: (e) => setValue('responsavel_cpf', formatarCpf(e.target.value)),
                    })}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="bg-[#0B132B]/80 border-[#1E2D56] text-white font-mono text-xs"
                  />
                </Campo>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Campo
                  id="prov-resp-tel"
                  label="Celular / WhatsApp do Responsável"
                  obrigatorio
                  erro={errors.responsavel_telefone?.message}
                >
                  <Input
                    id="prov-resp-tel"
                    {...register('responsavel_telefone', {
                      onChange: (e) => setValue('responsavel_telefone', formatarTelefone(e.target.value)),
                    })}
                    placeholder="(11) 98765-4321"
                    maxLength={15}
                    className="bg-[#0B132B]/80 border-[#1E2D56] text-white"
                  />
                </Campo>

                <Campo
                  id="prov-resp-email"
                  label="E-mail de Contato Principal"
                  obrigatorio
                  erro={errors.responsavel_email?.message}
                >
                  <Input
                    id="prov-resp-email"
                    type="email"
                    {...register('responsavel_email')}
                    placeholder="carlos.silva@email.com"
                    className="bg-[#0B132B]/80 border-[#1E2D56] text-white"
                  />
                </Campo>
              </div>

              <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-900/50 text-xs text-blue-200 flex items-start gap-2.5">
                <Shield className="size-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Login Master Centralizado:</span>
                  <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                    Esta clínica será criada com o usuário Master padrão{' '}
                    <strong className="text-white font-mono">admin@proclinica.com.br</strong> para acesso administrativo unificado a todos os tenants.
                  </p>
                </div>
              </div>
            </SecaoForm>

            {/* 2. DADOS DA CLÍNICA */}
            <SecaoForm titulo="2. Dados da Clínica" icone={Building2}>
              <Campo
                id="prov-nome-fantasia"
                label="Nome Fantasia da Clínica"
                obrigatorio
                erro={errors.nome_fantasia?.message}
                ajuda="Gera automaticamente sugestões de schema e subdomínio"
              >
                <Input
                  id="prov-nome-fantasia"
                  {...register('nome_fantasia', {
                    onChange: handleNomeFantasiaChange,
                  })}
                  placeholder="Odonto Prime Consultórios"
                  className="bg-[#0B132B]/80 border-[#1E2D56] text-white font-medium"
                />
              </Campo>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Campo
                  id="prov-razao"
                  label="Razão Social"
                  obrigatorio
                  erro={errors.razao_social?.message}
                >
                  <Input
                    id="prov-razao"
                    {...register('razao_social')}
                    placeholder="Odonto Prime Serviços Odontológicos LTDA"
                    className="bg-[#0B132B]/80 border-[#1E2D56] text-white"
                  />
                </Campo>

                <Campo
                  id="prov-cnpj"
                  label="CNPJ da Clínica"
                  obrigatorio
                  erro={errors.cnpj?.message}
                >
                  <Input
                    id="prov-cnpj"
                    {...register('cnpj', {
                      onChange: (e) => setValue('cnpj', formatarCnpj(e.target.value)),
                    })}
                    placeholder="00.000.000/0001-00"
                    maxLength={18}
                    className="bg-[#0B132B]/80 border-[#1E2D56] text-white font-mono text-xs"
                  />
                </Campo>
              </div>

              <Campo id="prov-tel-clinica" label="Telefone Fixo / Comercial da Clínica" erro={errors.telefone_clinica?.message}>
                <Input
                  id="prov-tel-clinica"
                  {...register('telefone_clinica', {
                    onChange: (e) => setValue('telefone_clinica', formatarTelefone(e.target.value)),
                  })}
                  placeholder="(11) 3333-4444"
                  maxLength={15}
                  className="bg-[#0B132B]/80 border-[#1E2D56] text-white"
                />
              </Campo>
            </SecaoForm>

            {/* 3. SCHEMA POSTGRESQL & DOMÍNIO */}
            <SecaoForm titulo="3. Schema PostgreSQL & Subdomínio de Acesso" icone={Globe}>
              {sugestoes.length > 0 && (
                <div className="space-y-2 p-3.5 rounded-lg bg-[#0B132B] border border-[#D4AF37]/40 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-[#D4AF37] font-semibold">
                      <Sparkles className="size-4" />
                      <span>Opções Geradas Automaticamente (Clique para selecionar):</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Ou personalize nos campos abaixo</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    {sugestoes.map((op, idx) => {
                      const selecionado = schemaAtual === op.schema
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => aplicarSugestao(op)}
                          className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer relative overflow-hidden ${
                            selecionado
                              ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white ring-1 ring-[#D4AF37]'
                              : 'bg-[#111D3B] border-[#1E2D56] text-slate-300 hover:border-slate-400 hover:bg-[#152345]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              {op.rotulo}
                            </span>
                            {selecionado && <Check className="size-3.5 text-[#D4AF37]" />}
                          </div>
                          <p className="font-mono text-xs font-bold text-[#D4AF37] mt-1">{op.schema}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">{op.dominio}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Campo
                  id="prov-schema"
                  label="Schema PostgreSQL (Isolamento de Base)"
                  obrigatorio
                  erro={errors.schema_name?.message}
                  ajuda="Você pode aceitar a sugestão ou digitar livremente"
                >
                  <div className="relative">
                    <Input
                      id="prov-schema"
                      {...register('schema_name')}
                      placeholder="odontoprime"
                      className="bg-[#0B132B]/80 border-[#1E2D56] text-[#D4AF37] font-mono text-xs pr-8"
                    />
                    <Edit3 className="size-3.5 text-slate-500 absolute right-2.5 top-3 pointer-events-none" />
                  </div>
                </Campo>

                <Campo
                  id="prov-dominio"
                  label="Domínio de Acesso Primário"
                  obrigatorio
                  erro={errors.dominio?.message}
                  ajuda="Endereço onde a clínica fará login"
                >
                  <div className="relative">
                    <Input
                      id="prov-dominio"
                      {...register('dominio')}
                      placeholder={`odontoprime.${dominioBasePlataforma()}`}
                      className="bg-[#0B132B]/80 border-[#1E2D56] text-white font-mono text-xs pr-8"
                    />
                    <Edit3 className="size-3.5 text-slate-500 absolute right-2.5 top-3 pointer-events-none" />
                  </div>
                </Campo>
              </div>
            </SecaoForm>

            {/* 4. PLANO COMERCIAL & INÍCIO DE CONTRATO */}
            <SecaoForm titulo="4. Plano Comercial & Vigência" icone={Shield}>
              <Campo
                id="prov-plano"
                label="Plano de Assinatura Inicial"
                obrigatorio
                erro={errors.plano_id?.message}
                ajuda="Obrigatório selecionar o plano comercial contratado pela clínica"
              >
                <select
                  id="prov-plano"
                  value={planoIdAtual ?? ''}
                  onChange={handlePlanoChange}
                  className={`${classeCampoSelect} bg-[#0B132B] border-[#1E2D56] text-white focus:bg-[#0B132B]`}
                >
                  <option value="" className="bg-[#0B132B] text-slate-400">
                    Selecione um plano comercial...
                  </option>
                  {listaPlanos.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#0B132B] text-white">
                      {p.nome} — R$ {p.preco_mensal}/mês [{p.periodicidade || 'MENSAL'}] ({p.limite_dentistas || 'Ilimitados'} dentistas)
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo
                id="prov-data-inicio"
                label="Data de Início do Contrato"
                obrigatorio
                erro={errors.data_inicio_contrato?.message}
                ajuda="Data a partir da qual o ciclo do plano é contabilizado para o cálculo de vigência"
              >
                <Input
                  id="prov-data-inicio"
                  type="date"
                  {...register('data_inicio_contrato')}
                  className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs font-mono"
                />
              </Campo>

              {planoSelecionado && (
                <div className="p-3 rounded-lg bg-[#0B132B] border border-[#1E2D56] text-xs space-y-1.5 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Ciclo / Periodicidade:</span>
                    <span className="font-semibold text-[#D4AF37]">
                      {planoSelecionado.periodicidade === 'ANUAL'
                        ? 'Anual (365 dias)'
                        : planoSelecionado.periodicidade === 'PERMANENTE'
                        ? 'Permanente (Vitalício / Sem Vencimento)'
                        : 'Mensal (30 dias)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Data de Vencimento Calculada:</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {calcularDataVencimento(dataInicioContrato, planoSelecionado.periodicidade)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#1E2D56]/60">
                    <span>
                      Limites: {planoSelecionado.limite_dentistas || 'Ilimitados'} dentistas •{' '}
                      {planoSelecionado.limite_usuarios || 'Ilimitados'} usuários
                    </span>
                  </div>
                </div>
              )}
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
                  Provisionando Instância...
                </>
              ) : (
                'Criar Instância da Clínica'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
