import { useEffect, useState } from 'react'
import { Eye, EyeOff, ShieldCheck, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useVendorAuth } from './use-vendor-auth'

export function VendorLoginPage() {
  const { entrar } = useVendorAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [codigoMfa, setCodigoMfa] = useState('')
  const [solicitarMfa, setSolicitarMfa] = useState(false)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    document.title = 'Admin - PróClínica'
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !senha) {
      toast.error('Preencha e-mail e senha.')
      return
    }

    try {
      setCarregando(true)
      await entrar({ email, senha, codigoMfa: solicitarMfa ? codigoMfa : undefined })
      toast.success('Acesso ao console do Vendor autorizado!')
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'mensagem' in err
          ? String((err as { mensagem: string }).mensagem)
          : 'Credenciais inválidas ou sem permissão de operador.'
      // Backend sinalizou 2FA: revela o campo do código e orienta o operador.
      if (/2fa|totp|c[óo]digo/i.test(msg) && !solicitarMfa) {
        setSolicitarMfa(true)
        toast.info('Este operador exige 2FA. Digite o código do seu autenticador.')
      } else {
        toast.error(msg)
      }
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="dark flex min-h-svh items-center justify-center bg-[#0B132B] p-4 text-slate-100 antialiased selection:bg-[#D4AF37] selection:text-slate-950">
      <Card className="w-full max-w-sm border-[#1E2D56] bg-[#111D3B] shadow-2xl text-slate-100">
        <CardHeader className="items-center text-center space-y-2 pb-4">
          <img src="/logo.png" alt="PróClínica" className="mx-auto h-32 w-auto" />
          <div className="flex items-center gap-1.5 justify-center">
            <ShieldCheck className="size-5 text-[#D4AF37]" />
            <h1 className="text-xl font-bold text-white tracking-tight">Painel da Plataforma</h1>
          </div>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
            Vendor Admin &bull; Governança Global
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Acesso restrito para operadores e mantenedores do sistema.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="vendor-email" className="text-xs font-medium text-slate-200">
                E-mail institucional
              </Label>
              <Input
                id="vendor-email"
                type="email"
                placeholder="operador@proclinica.cloud"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-sm bg-[#0B132B]/90 border-[#1E2D56] text-white placeholder:text-slate-500 focus-visible:border-[#D4AF37] focus-visible:ring-[#D4AF37]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vendor-senha" className="text-xs font-medium text-slate-200">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="vendor-senha"
                  type={verSenha ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="pr-10 text-sm bg-[#0B132B]/90 border-[#1E2D56] text-white placeholder:text-slate-500 focus-visible:border-[#D4AF37] focus-visible:ring-[#D4AF37]"
                />
                <button
                  type="button"
                  onClick={() => setVerSenha(!verSenha)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-[#D4AF37] transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {solicitarMfa && (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="vendor-mfa" className="text-xs font-medium text-[#D4AF37] flex items-center justify-between">
                  <span>Código 2FA / TOTP</span>
                  <span className="text-[10px] text-slate-400">6 dígitos</span>
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 size-4 text-[#D4AF37]" />
                  <Input
                    id="vendor-mfa"
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={codigoMfa}
                    onChange={(e) => setCodigoMfa(e.target.value.replace(/\D/g, ''))}
                    className="pl-9 tracking-widest font-mono text-center text-sm bg-[#0B132B]/90 border-[#1E2D56] text-white placeholder:text-slate-500 focus-visible:border-[#D4AF37] focus-visible:ring-[#D4AF37]"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setSolicitarMfa(!solicitarMfa)}
                className="text-xs text-slate-400 hover:text-[#D4AF37] transition-colors cursor-pointer"
              >
                {solicitarMfa ? 'Ocultar código 2FA' : 'Adicionar código 2FA'}
              </button>
            </div>

            <Button
              type="submit"
              disabled={carregando}
              className="w-full font-semibold cursor-pointer bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 shadow-md transition-all"
            >
              {carregando ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Validando...
                </>
              ) : (
                'Entrar no Painel Vendor'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
