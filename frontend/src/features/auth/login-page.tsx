import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ErroApi } from '@/lib/api/client'

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
  const { data: nomeClinica } = useClinicaAtual()

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
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {erroServidor}
              </p>
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

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              <LogIn />
              {isSubmitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
