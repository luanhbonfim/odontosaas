import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { ShieldCheck, ShieldOff, ShieldAlert, KeyRound, Copy, RotateCcw, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  type MfaInicio,
  useConfirmarMfa,
  useDesativarMfa,
  useIniciarMfa,
  useMfaStatus,
  useOperadoresMfa,
  useResetarMfa,
} from './use-mfa'

const inputCls =
  'w-full h-10 rounded-md bg-[#0B132B]/80 border border-[#1E2D56] px-3 text-sm tracking-[0.3em] text-center text-white focus:outline-none focus:border-[#D4AF37]'

function Card({ children }: { children: React.ReactNode }) {
  return <div className="p-5 rounded-lg bg-[#0B132B]/60 border border-[#1E2D56] space-y-4">{children}</div>
}

/** Extrai a mensagem de erro do backend (campo "erro") com fallback. */
function msgErro(e: unknown, fallback: string): string {
  const resp = (e as { response?: { data?: { erro?: string } } })?.response
  return resp?.data?.erro || fallback
}

function MeuDoisFatores() {
  const { data: status, isLoading } = useMfaStatus()
  const iniciar = useIniciarMfa()
  const confirmar = useConfirmarMfa()
  const desativar = useDesativarMfa()

  const [inicio, setInicio] = useState<MfaInicio | null>(null)
  const [qr, setQr] = useState<string>('')
  const [codigo, setCodigo] = useState('')
  const [desativando, setDesativando] = useState(false)
  const [codigoDesativar, setCodigoDesativar] = useState('')

  // Gera o QR (data URL) a partir do otpauth:// quando a ativação inicia.
  useEffect(() => {
    if (!inicio?.otpauth_uri) {
      setQr('')
      return
    }
    QRCode.toDataURL(inicio.otpauth_uri, { width: 200, margin: 1 })
      .then(setQr)
      .catch(() => setQr(''))
  }, [inicio])

  async function onIniciar() {
    try {
      const dados = await iniciar.mutateAsync()
      setInicio(dados)
      setCodigo('')
    } catch {
      toast.error('Não foi possível iniciar a configuração do 2FA.')
    }
  }

  async function onConfirmar() {
    try {
      await confirmar.mutateAsync(codigo.trim())
      toast.success('2FA ativado com sucesso.')
      setInicio(null)
      setCodigo('')
    } catch (e) {
      toast.error(msgErro(e, 'Código inválido.'))
    }
  }

  async function onDesativar() {
    try {
      await desativar.mutateAsync(codigoDesativar.trim())
      toast.success('2FA desativado.')
      setDesativando(false)
      setCodigoDesativar('')
    } catch (e) {
      toast.error(msgErro(e, 'Código atual obrigatório para desativar.'))
    }
  }

  function copiar(texto: string) {
    navigator.clipboard?.writeText(texto).then(
      () => toast.success('Copiado.'),
      () => toast.error('Não foi possível copiar.'),
    )
  }

  if (isLoading) {
    return <Card>Carregando…</Card>
  }

  const habilitado = status?.habilitado

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {habilitado ? (
            <ShieldCheck className="size-5 text-emerald-400" />
          ) : (
            <ShieldOff className="size-5 text-slate-500" />
          )}
          <div>
            <p className="text-sm font-semibold text-white">Meu 2FA (autenticação em dois fatores)</p>
            <p className="text-xs text-slate-400">{status?.email}</p>
          </div>
        </div>
        <span
          className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
            habilitado ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-300'
          }`}
        >
          {habilitado ? 'ATIVO' : 'INATIVO'}
        </span>
      </div>

      {/* Ativação (self-service) */}
      {!habilitado && !inicio && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Proteja seu acesso ao painel com um código de 6 dígitos gerado por um app autenticador
            (Google Authenticator, 1Password, Authy). Ao ativar, o login passará a exigir o código.
          </p>
          <Button
            onClick={onIniciar}
            disabled={iniciar.isPending}
            className="bg-[#D4AF37] text-black hover:bg-[#C29D26]"
          >
            {iniciar.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            Ativar 2FA
          </Button>
        </div>
      )}

      {!habilitado && inicio && (
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            1. Escaneie o QR Code no seu app autenticador (ou digite a chave manualmente).
          </p>
          <div className="flex flex-col sm:flex-row items-start gap-4">
            {qr ? (
              <img
                src={qr}
                alt="QR Code para configurar o 2FA"
                className="rounded-lg border border-[#1E2D56] bg-white p-2"
                width={200}
                height={200}
              />
            ) : (
              <div className="size-[200px] grid place-items-center rounded-lg border border-[#1E2D56]">
                <Loader2 className="size-5 animate-spin text-slate-500" />
              </div>
            )}
            <div className="space-y-2 min-w-0">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Chave manual</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-[#D4AF37] font-mono break-all">{inicio.secret}</code>
                <button
                  type="button"
                  onClick={() => copiar(inicio.secret)}
                  className="shrink-0 text-slate-400 hover:text-white"
                  aria-label="Copiar chave"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-w-xs">
            <p className="text-xs text-slate-300">2. Digite o código atual de 6 dígitos para confirmar:</p>
            <input
              className={inputCls}
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <div className="flex gap-2">
              <Button
                onClick={onConfirmar}
                disabled={confirmar.isPending || codigo.length < 6}
                className="bg-[#D4AF37] text-black hover:bg-[#C29D26] disabled:opacity-60"
              >
                {confirmar.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                Confirmar e ativar
              </Button>
              <Button
                variant="ghost"
                onClick={() => setInicio(null)}
                className="text-slate-300 hover:text-white"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Desativação (self-service, exige código atual) */}
      {habilitado && !desativando && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Seu login no painel está protegido por 2FA. Para desativar, será necessário informar um código atual do app.
          </p>
          <Button variant="outline" onClick={() => setDesativando(true)} className="border-red-500/40 text-red-300 hover:bg-red-500/10">
            <ShieldOff className="size-4" />
            Desativar meu 2FA
          </Button>
        </div>
      )}

      {habilitado && desativando && (
        <div className="space-y-2 max-w-xs">
          <p className="text-xs text-slate-300">Digite um código atual do app para confirmar a desativação:</p>
          <input
            className={inputCls}
            inputMode="numeric"
            maxLength={6}
            placeholder="••••••"
            value={codigoDesativar}
            onChange={(e) => setCodigoDesativar(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <div className="flex gap-2">
            <Button
              onClick={onDesativar}
              disabled={desativar.isPending || codigoDesativar.length < 6}
              className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
            >
              {desativar.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />}
              Confirmar desativação
            </Button>
            <Button variant="ghost" onClick={() => setDesativando(false)} className="text-slate-300 hover:text-white">
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function OperadoresComDoisFatores() {
  const { data: operadores, isLoading } = useOperadoresMfa()
  const resetar = useResetarMfa()
  const [confirmando, setConfirmando] = useState<string | null>(null)

  async function onResetar(email: string) {
    try {
      await resetar.mutateAsync(email)
      toast.success(`2FA de ${email} resetado.`)
      setConfirmando(null)
    } catch {
      toast.error('Não foi possível resetar o 2FA.')
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-5 text-[#D4AF37]" />
        <div>
          <p className="text-sm font-semibold text-white">Operadores com 2FA ativo</p>
          <p className="text-xs text-slate-400">
            Recuperação: se um operador perder o aparelho, resete o 2FA dele aqui — ele configurará de novo no próximo login.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-400">Carregando…</p>
      ) : !operadores?.length ? (
        <p className="text-xs text-slate-500">Nenhum operador com 2FA ativo no momento.</p>
      ) : (
        <ul className="divide-y divide-[#1E2D56]">
          {operadores.map((op) => (
            <li key={op.email} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">
                  {op.email} {op.eu && <span className="text-[10px] text-[#D4AF37]">(você)</span>}
                </p>
                <p className="text-[10px] text-slate-500">
                  ativo desde {new Date(op.criado_em).toLocaleDateString('pt-BR')}
                </p>
              </div>
              {confirmando === op.email ? (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    onClick={() => onResetar(op.email)}
                    disabled={resetar.isPending}
                    className="h-8 bg-red-600 text-white hover:bg-red-700 text-xs"
                  >
                    {resetar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : 'Confirmar reset'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmando(null)}
                    className="h-8 text-slate-300 hover:text-white text-xs"
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setConfirmando(op.email)}
                  className="h-8 shrink-0 border-red-500/40 text-red-300 hover:bg-red-500/10 text-xs"
                >
                  <RotateCcw className="size-3.5" />
                  Resetar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function Configuracao2FAPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-[#D4AF37]" />
        <h1 className="text-xl font-bold text-white tracking-tight">Autenticação em Dois Fatores (2FA)</h1>
      </div>
      <p className="text-xs text-slate-400">
        Gerencie o 2FA do painel diretamente pela interface — sem linha de comando. Cada operador ativa o próprio
        2FA lendo um QR Code; um SuperAdmin pode resetar o de outro operador em caso de perda do aparelho.
      </p>

      <MeuDoisFatores />
      <OperadoresComDoisFatores />
    </div>
  )
}
