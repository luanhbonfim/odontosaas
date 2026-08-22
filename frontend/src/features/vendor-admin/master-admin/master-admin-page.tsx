import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  KeyRound,
  ShieldCheck,
  Building2,
  Lock,
  Mail,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Campo } from '@/components/common/form-kit'
import { BotaoVendorPrimario, BotaoVendorSecundario } from '../ui/vendor-ui'
import { useMasterAdminInfo, useAtualizarMasterAdmin } from './use-master-admin'

const schema = z
  .object({
    email: z.string().email('Informe um e-mail válido para o usuário Master'),
    nova_senha: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres'),
    confirmar_senha: z.string().min(8, 'Confirmação de senha obrigatória'),
  })
  .refine((data) => data.nova_senha === data.confirmar_senha, {
    message: 'As senhas digitadas não coincidem',
    path: ['confirmar_senha'],
  })

type FormValues = z.infer<typeof schema>

export function MasterAdminPage() {
  const { data: info, isLoading: carregandoInfo, refetch } = useMasterAdminInfo()
  const atualizarMaster = useAtualizarMasterAdmin()

  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: 'admin@proclinica.com.br',
      nova_senha: '',
      confirmar_senha: '',
    },
  })

  // Sincroniza o e-mail retornado pela API no formulário
  useEffect(() => {
    if (info?.email) {
      setValue('email', info.email)
    }
  }, [info?.email, setValue])

  async function onSubmit(valores: FormValues) {
    try {
      const resp = await atualizarMaster.mutateAsync({
        email: valores.email,
        nova_senha: valores.nova_senha,
      })
      toast.success(resp.mensagem || 'Credenciais do Master Admin sincronizadas com sucesso!')
      reset({
        email: valores.email,
        nova_senha: '',
        confirmar_senha: '',
      })
      refetch()
    } catch (excecao: unknown) {
      const err = excecao as {
        response?: { data?: { erro?: string; detalhes?: string; mensagem?: string } }
        message?: string
      }
      const msg =
        err?.response?.data?.detalhes ||
        err?.response?.data?.erro ||
        err?.response?.data?.mensagem ||
        'Falha ao sincronizar credenciais do Master Admin.'
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-6 text-slate-100 animate-fadeIn">
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-[#111D3B] border border-[#1E2D56] shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
              <KeyRound className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Acesso Master Global</h1>
              <p className="text-xs text-slate-400">
                Gerencie o e-mail e a senha de acesso administrativo unificado a todos os tenants.
              </p>
            </div>
          </div>
        </div>

        <BotaoVendorSecundario
          size="sm"
          onClick={() => refetch()}
          disabled={carregandoInfo}
          className="text-xs cursor-pointer"
        >
          <RefreshCw className={`size-3.5 mr-1.5 ${carregandoInfo ? 'animate-spin' : ''}`} />
          Atualizar Status
        </BotaoVendorSecundario>
      </div>

      {/* Cards de Status e Cobertura Multi-Tenant */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#111D3B] border-[#1E2D56] text-slate-100 shadow-md">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="size-3.5 text-[#D4AF37]" />
              E-mail Master Ativo
            </CardDescription>
            <CardTitle className="text-base font-mono text-white pt-1">
              {carregandoInfo ? <Skeleton className="h-6 w-48 bg-[#1A2A4E]" /> : info?.email || 'admin@proclinica.com.br'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-400">
              Usuário utilizado para login institucional em qualquer tenant.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#111D3B] border-[#1E2D56] text-slate-100 shadow-md">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="size-3.5 text-blue-400" />
              Total de Clínicas
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-white pt-1">
              {carregandoInfo ? <Skeleton className="h-8 w-16 bg-[#1A2A4E]" /> : info?.total_tenants ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-400">
              Instâncias ativas conectadas no cluster multi-tenant.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#111D3B] border-[#1E2D56] text-slate-100 shadow-md">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              Cobertura de Acesso
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-400 pt-1 flex items-center gap-2">
              {carregandoInfo ? (
                <Skeleton className="h-8 w-20 bg-[#1A2A4E]" />
              ) : (
                <>
                  {info?.tenants_sincronizados ?? 0} / {info?.total_tenants ?? 0}
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                    100%
                  </span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-400">
              Todos os schemas de banco possuem este usuário ativo.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Formulário de Redefinição e Sincronização */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="bg-[#111D3B] border-[#1E2D56] text-slate-100 shadow-lg">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Lock className="size-4 text-[#D4AF37]" />
                Redefinir Credenciais do Administrador Master
              </CardTitle>
              <CardDescription className="text-slate-300 text-xs">
                Ao alterar a senha ou e-mail, as credenciais serão atualizadas instantaneamente em todos os bancos de dados das clínicas cadastradas.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Campo
                  id="master-email"
                  label="E-mail do Administrador Master"
                  obrigatorio
                  erro={errors.email?.message}
                >
                  <Input
                    id="master-email"
                    type="email"
                    {...register('email')}
                    placeholder="admin@proclinica.com.br"
                    aria-invalid={!!errors.email}
                    className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs font-mono"
                  />
                </Campo>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Campo
                    id="master-senha"
                    label="Nova Senha Master"
                    obrigatorio
                    erro={errors.nova_senha?.message}
                  >
                    <div className="relative">
                      <Input
                        id="master-senha"
                        type={mostrarSenha ? 'text' : 'password'}
                        {...register('nova_senha')}
                        placeholder="••••••••••••"
                        aria-invalid={!!errors.nova_senha}
                        className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </Campo>

                  <Campo
                    id="master-confirmar"
                    label="Confirmar Nova Senha"
                    obrigatorio
                    erro={errors.confirmar_senha?.message}
                  >
                    <div className="relative">
                      <Input
                        id="master-confirmar"
                        type={mostrarConfirmar ? 'text' : 'password'}
                        {...register('confirmar_senha')}
                        placeholder="••••••••••••"
                        aria-invalid={!!errors.confirmar_senha}
                        className="bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarConfirmar((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {mostrarConfirmar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </Campo>
                </div>

                <div className="pt-3 border-t border-[#1E2D56]/60 flex items-center justify-end">
                  <BotaoVendorPrimario
                    type="submit"
                    disabled={isSubmitting || atualizarMaster.isPending}
                    className="text-xs px-5 py-2 cursor-pointer"
                  >
                    {atualizarMaster.isPending ? (
                      <>
                        <RefreshCw className="size-3.5 mr-2 animate-spin" />
                        Sincronizando em todos os schemas...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-3.5 mr-2" />
                        Sincronizar Senha em Todas as Clínicas
                      </>
                    )}
                  </BotaoVendorPrimario>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Card de Regras e Diretrizes de Segurança */}
        <div>
          <Card className="bg-[#111D3B] border-[#1E2D56] text-slate-100 shadow-lg h-full flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-400" />
                Diretrizes de Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-300 flex-1">
              <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-900/50 space-y-1 text-blue-200">
                <p className="font-semibold text-white">Replicação Automática:</p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Ao salvar, a rotina percorre todos os schemas físicos do PostgreSQL atualizando o hash PBKDF2 da senha em cada clínica.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-900/50 space-y-1 text-emerald-200">
                <p className="font-semibold text-white">Novas Clínicas Provisionadas:</p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Qualquer novo tenant criado no painel nascerá automaticamente com este mesmo e-mail e senha Master configurados.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-900/50 space-y-1 text-amber-200">
                <p className="font-semibold text-white">Ação Auditada:</p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Toda sincronização gera registro com carimbo de operador, endereço IP e quantidade de clínicas afetadas.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
