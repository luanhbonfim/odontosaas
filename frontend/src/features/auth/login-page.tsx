import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ErroApi } from '@/lib/api/client'
import { tokenStore } from '@/lib/api/token-store'

import { useClinicaAtual } from './use-clinica-atual'

const schema = z.object({
  email: z.string().min(1, 'Informe o e-mail').email('E-mail inválido'),
  senha: z.string().min(1, 'Informe a senha'),
})

export type CredenciaisLogin = z.infer<typeof schema>

type LoginPageProps = {
  /** Executa o login (integração JWT vem na próxima tarefa). Deve rejeitar com ErroApi. */
  aoEntrar: (credenciais: CredenciaisLogin) => Promise<void>
}

export function LoginPage({ aoEntrar }: LoginPageProps) {
  const [verSenha, setVerSenha] = useState(false)
  const [erroServidor, setErroServidor] = useState<string | null>(null)
  const { data: infoClinica, isLoading: carregandoTenant } = useClinicaAtual()
  const nomeClinica = typeof infoClinica === 'string' ? infoClinica : infoClinica?.nome_fantasia
  const ehPublico = infoClinica && typeof infoClinica === 'object' && infoClinica.is_public

  // Captura token de impersonate passado pelo Vendor Admin na query string da URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const access = params.get('impersonate_access') || params.get('impersonate_token')
      const refresh = params.get('impersonate_refresh') || undefined

      if (access) {
        tokenStore.definir({ access, refresh })
        toast.info('Sessão de suporte (Read-Only) iniciada com sucesso.', {
          description: 'Mutações no banco estão bloqueadas pelo servidor para auditoria e segurança.',
          duration: 6000,
        })
        window.location.replace('/')
      }
    } catch {
      // ignora
    }
  }, [])

  // Temporizador para sumir com mensagem de erro do servidor após 20 segundos
  useEffect(() => {
    if (erroServidor) {
      const timer = setTimeout(() => {
        setErroServidor(null)
      }, 20000)
      return () => clearTimeout(timer)
    }
  }, [erroServidor])

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CredenciaisLogin>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', senha: '' },
  })

  async function onSubmit(dados: CredenciaisLogin) {
    if (ehPublico) {
      setErroServidor('O login da clínica não está disponível no domínio raiz da plataforma. Acesse através do subdomínio do seu consultório.')
      return
    }
    setErroServidor(null)
    try {
      await aoEntrar(dados)
    } catch (excecao) {
      const erro = excecao as ErroApi
      // Erros de campo vindos do backend (DRF) refletem inline no respectivo campo.
      if (erro.campos?.email) setError('email', { message: erro.campos.email[0] })
      if (erro.campos?.password) setError('senha', { message: erro.campos.password[0] })
      setErroServidor(
        erro.status === 401
          ? 'E-mail ou senha inválidos.'
          : (erro.mensagem ?? 'Não foi possível entrar. Tente novamente.'),
      )
    }
  }

  if (ehPublico) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-[#070B18] px-4 text-center text-slate-400">
        <div className="max-w-md space-y-3">
          <p className="font-mono text-sm uppercase tracking-widest text-[#D4AF37]">404 | Página Não Encontrada</p>
          <h1 className="text-xl font-semibold text-slate-100">
            Acesso Indisponível
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            O domínio principal é reservado para a página institucional e de vendas da plataforma. O acesso aos consultórios é realizado exclusivamente através do subdomínio próprio de cada clínica.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img src="/logo.png" alt="PróClínica" className="mx-auto h-40 w-auto" />
          {nomeClinica && <p className="text-lg font-semibold text-foreground">{nomeClinica}</p>}
          <CardTitle className="text-base font-normal text-muted-foreground">
            Acesse sua clínica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {erroServidor && (
              <div
                role="alert"
                className="relative rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center justify-between gap-2"
              >
                <span>{erroServidor}</span>
                <button
                  type="button"
                  onClick={() => setErroServidor(null)}
                  className="text-destructive/70 hover:text-destructive text-xs font-bold shrink-0 cursor-pointer"
                  title="Fechar aviso"
                >
                  ✕
                </button>
              </div>
            )}

              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@clinica.com"
                  aria-invalid={errors.email ? true : undefined}
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={verSenha ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="pr-9"
                    aria-invalid={errors.senha ? true : undefined}
                    {...register('senha')}
                  />
                  <button
                    type="button"
                    onClick={() => setVerSenha((valor) => !valor)}
                    aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-3 text-muted-foreground hover:text-foreground"
                  >
                    {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.senha && <p className="text-xs text-destructive">{errors.senha.message}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || carregandoTenant}>
                <LogIn />
                {isSubmitting ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>
        </CardContent>
      </Card>
    </div>
  )
}
