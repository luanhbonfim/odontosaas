import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { KeyRound, Loader2, Lock, ShieldCheck, ShieldOff, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSessao } from '@/features/auth/use-sessao'
import { useAtualizarUsuario } from '@/features/usuarios/use-usuarios'
import {
  type MfaInicio,
  useConfirmarMfa,
  useDesativarMfa,
  useIniciarMfa,
  useMfaStatus,
} from './use-conta-mfa'

/** Extrai a mensagem de erro do backend com fallback. */
function msgErro(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: Record<string, unknown> } })?.response?.data
  if (data) {
    if (typeof data.erro === 'string') return data.erro
    if (typeof data.detail === 'string') return data.detail
    // erros de validação por campo (ex.: { senha: ["..."] })
    const primeiro = Object.values(data)[0]
    if (Array.isArray(primeiro) && typeof primeiro[0] === 'string') return primeiro[0]
  }
  return fallback
}

function DadosPessoais({ id, nome, email, papel }: { id: number; nome: string; email: string; papel: string }) {
  const atualizar = useAtualizarUsuario()
  const [nomeCompleto, setNomeCompleto] = useState(nome)

  const alterado = nomeCompleto.trim() !== nome && nomeCompleto.trim().length > 0

  async function onSalvar() {
    try {
      await atualizar.mutateAsync({ id, dados: { nome_completo: nomeCompleto.trim() } })
      toast.success('Dados atualizados.')
    } catch (e) {
      toast.error(msgErro(e, 'Não foi possível salvar os dados.'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="size-4 text-primary" />
          Dados pessoais
        </CardTitle>
        <CardDescription>Seu nome de exibição. O e-mail de acesso e o cargo são definidos pela gestão.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="conta-nome">Nome completo</Label>
          <Input id="conta-nome" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} maxLength={255} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="conta-email">E-mail (login)</Label>
            <Input id="conta-email" value={email} disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="conta-papel">Cargo</Label>
            <Input id="conta-papel" value={papel} disabled />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={onSalvar} disabled={!alterado || atualizar.isPending}>
            {atualizar.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar dados
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AlterarSenha({ id }: { id: number }) {
  const atualizar = useAtualizarUsuario()
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')

  const curta = senha.length > 0 && senha.length < 8
  const divergem = confirma.length > 0 && senha !== confirma
  const valido = senha.length >= 8 && senha === confirma

  async function onSalvar() {
    if (!valido) return
    try {
      await atualizar.mutateAsync({ id, dados: { senha } })
      toast.success('Senha alterada com sucesso.')
      setSenha('')
      setConfirma('')
    } catch (e) {
      toast.error(msgErro(e, 'Não foi possível alterar a senha.'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="size-4 text-primary" />
          Alterar senha
        </CardTitle>
        <CardDescription>Escolha uma senha forte (mínimo de 8 caracteres).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="conta-senha">Nova senha</Label>
            <Input
              id="conta-senha"
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            {curta && <p className="text-xs text-destructive">Mínimo de 8 caracteres.</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="conta-senha2">Confirmar nova senha</Label>
            <Input
              id="conta-senha2"
              type="password"
              autoComplete="new-password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
            />
            {divergem && <p className="text-xs text-destructive">As senhas não conferem.</p>}
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={onSalvar} disabled={!valido || atualizar.isPending}>
            {atualizar.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Alterar senha
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DoisFatores() {
  const { data: status, isLoading } = useMfaStatus()
  const iniciar = useIniciarMfa()
  const confirmar = useConfirmarMfa()
  const desativar = useDesativarMfa()

  const [inicio, setInicio] = useState<MfaInicio | null>(null)
  const [qr, setQr] = useState('')
  const [codigo, setCodigo] = useState('')
  const [desativando, setDesativando] = useState(false)
  const [codigoOff, setCodigoOff] = useState('')

  useEffect(() => {
    if (!inicio?.otpauth_uri) {
      setQr('')
      return
    }
    QRCode.toDataURL(inicio.otpauth_uri, { width: 200, margin: 1 })
      .then(setQr)
      .catch(() => setQr(''))
  }, [inicio])

  const habilitado = status?.habilitado

  async function onIniciar() {
    try {
      setInicio(await iniciar.mutateAsync())
      setCodigo('')
    } catch {
      toast.error('Não foi possível iniciar a configuração do 2FA.')
    }
  }

  async function onConfirmar() {
    try {
      await confirmar.mutateAsync(codigo.trim())
      toast.success('2FA ativado. Nos próximos logins será pedido o código.')
      setInicio(null)
      setCodigo('')
    } catch (e) {
      toast.error(msgErro(e, 'Código inválido.'))
    }
  }

  async function onDesativar() {
    try {
      await desativar.mutateAsync(codigoOff.trim())
      toast.success('2FA desativado.')
      setDesativando(false)
      setCodigoOff('')
    } catch (e) {
      toast.error(msgErro(e, 'Código atual obrigatório para desativar.'))
    }
  }

  function copiar(texto: string) {
    navigator.clipboard?.writeText(texto).then(
      () => toast.success('Chave copiada.'),
      () => toast.error('Não foi possível copiar.'),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {habilitado ? <ShieldCheck className="size-4 text-success" /> : <ShieldOff className="size-4 text-muted-foreground" />}
          Autenticação em dois fatores (2FA)
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              habilitado ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
            }`}
          >
            {isLoading ? '…' : habilitado ? 'ATIVO' : 'INATIVO'}
          </span>
        </CardTitle>
        <CardDescription>
          Um código de 6 dígitos gerado por um app (Google Authenticator, 1Password, Authy) reforça a segurança do seu login.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !habilitado && !inicio ? (
          <Button onClick={onIniciar} disabled={iniciar.isPending}>
            {iniciar.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            Ativar 2FA
          </Button>
        ) : !habilitado && inicio ? (
          <div className="space-y-4">
            <p className="text-sm">1. Escaneie o QR Code no seu app autenticador (ou digite a chave manualmente).</p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {qr ? (
                <img src={qr} alt="QR Code do 2FA" width={200} height={200} className="rounded-lg border bg-white p-2" />
              ) : (
                <div className="grid size-[200px] place-items-center rounded-lg border">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Chave manual</p>
                <button
                  type="button"
                  onClick={() => copiar(inicio.secret)}
                  className="break-all text-left font-mono text-sm text-primary hover:underline"
                  title="Copiar chave"
                >
                  {inicio.secret}
                </button>
              </div>
            </div>
            <div className="max-w-xs space-y-2">
              <Label htmlFor="mfa-cod">2. Código atual de 6 dígitos</Label>
              <Input
                id="mfa-cod"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <div className="flex gap-2">
                <Button onClick={onConfirmar} disabled={confirmar.isPending || codigo.length < 6}>
                  {confirmar.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  Confirmar e ativar
                </Button>
                <Button variant="ghost" onClick={() => setInicio(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        ) : habilitado && !desativando ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Seu login está protegido por 2FA.</p>
            <Button variant="outline" onClick={() => setDesativando(true)} className="text-destructive">
              <ShieldOff className="size-4" />
              Desativar 2FA
            </Button>
          </div>
        ) : (
          <div className="max-w-xs space-y-2">
            <Label htmlFor="mfa-off">Digite um código atual para desativar</Label>
            <Input
              id="mfa-off"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={codigoOff}
              onChange={(e) => setCodigoOff(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={onDesativar} disabled={desativar.isPending || codigoOff.length < 6}>
                {desativar.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Confirmar desativação
              </Button>
              <Button variant="ghost" onClick={() => setDesativando(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function MinhaContaPage() {
  const { usuario, carregando } = useSessao()

  if (carregando || !usuario) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Minha conta</h1>
        <p className="text-sm text-muted-foreground">Gerencie seus dados, sua senha e a autenticação em dois fatores.</p>
      </div>

      <DadosPessoais
        id={usuario.id}
        nome={usuario.nomeCompleto}
        email={usuario.email}
        papel={usuario.papelExibicao}
      />
      <AlterarSenha id={usuario.id} />
      <DoisFatores />
    </div>
  )
}
