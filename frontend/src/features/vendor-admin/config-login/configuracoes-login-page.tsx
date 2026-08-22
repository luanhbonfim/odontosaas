import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { type ConfigLogin, useConfigLogin, useSalvarConfigLogin } from './use-config-login'

const inputCls =
  'w-full h-9 rounded-md bg-[#0B132B]/80 border border-[#1E2D56] px-3 text-xs text-white focus:outline-none focus:border-[#D4AF37]'

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-lg bg-[#0B132B]/60 border border-[#1E2D56] space-y-4">
      <h3 className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider">{titulo}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

function CampoNum(props: {
  label: string
  valor: number
  onChange: (v: number) => void
  min?: number
  max?: number
  dica?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-slate-200 font-medium">{props.label}</label>
      <input
        type="number"
        className={inputCls}
        value={props.valor}
        min={props.min}
        max={props.max}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      {props.dica && <p className="text-[10px] text-slate-500">{props.dica}</p>}
    </div>
  )
}

function CampoTexto(props: { label: string; valor: string; onChange: (v: string) => void; dica?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-slate-200 font-medium">{props.label}</label>
      <input type="text" className={inputCls} value={props.valor} onChange={(e) => props.onChange(e.target.value)} />
      {props.dica && <p className="text-[10px] text-slate-500">{props.dica}</p>}
    </div>
  )
}

function CampoBool(props: { label: string; valor: boolean; onChange: (v: boolean) => void; dica?: string }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="checkbox"
        className="mt-0.5 accent-[#D4AF37]"
        checked={props.valor}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span>
        <span className="text-xs text-slate-200 font-medium">{props.label}</span>
        {props.dica && <span className="block text-[10px] text-slate-500">{props.dica}</span>}
      </span>
    </label>
  )
}

export function ConfiguracoesLoginPage() {
  const { data, isLoading } = useConfigLogin()
  const salvar = useSalvarConfigLogin()
  const [form, setForm] = useState<ConfigLogin | null>(null)

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  function set<K extends keyof ConfigLogin>(chave: K, valor: ConfigLogin[K]) {
    setForm((f) => (f ? { ...f, [chave]: valor } : f))
  }

  async function onSalvar() {
    if (!form) return
    try {
      await salvar.mutateAsync(form)
      toast.success('Configurações de login salvas. Efeito em até ~30s.')
    } catch {
      toast.error('Falha ao salvar. Verifique os valores (faixas e formato de taxa).')
    }
  }

  if (isLoading || !form) {
    return <div className="p-8 text-sm text-slate-400">Carregando configurações…</div>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="size-5 text-[#D4AF37]" />
        <h1 className="text-xl font-bold text-white tracking-tight">Configurações de Login &amp; Sessão</h1>
      </div>
      <p className="text-xs text-slate-400">
        Parâmetros globais de login, sessão e segurança do acesso à plataforma. Alterações valem para
        novos logins (efeito em até ~30s). Ação restrita a SuperAdmin e auditada.
      </p>

      <Secao titulo="Sessão & Tokens">
        <CampoNum
          label="Duração do access token (min)"
          valor={form.access_token_min}
          onChange={(v) => set('access_token_min', v)}
          min={5}
          max={240}
          dica="Renovação automática. 5–240."
        />
        <CampoNum
          label="Duração da sessão / refresh (horas)"
          valor={form.refresh_token_horas}
          onChange={(v) => set('refresh_token_horas', v)}
          min={1}
          max={720}
          dica="Após isso, exige novo login. 1–720h."
        />
        <CampoBool
          label="Rotacionar refresh a cada uso"
          valor={form.rotacionar_refresh}
          onChange={(v) => set('rotacionar_refresh', v)}
          dica="Mais seguro (requer blacklist do SimpleJWT)."
        />
      </Secao>

      <Secao titulo="Proteção de Login (força bruta)">
        <CampoNum
          label="Máx. de tentativas por IP"
          valor={form.login_max_tentativas}
          onChange={(v) => set('login_max_tentativas', v)}
          min={3}
          max={20}
          dica="3–20. Aplica a clínica e painel."
        />
        <CampoNum
          label="Tempo de bloqueio (min)"
          valor={form.login_bloqueio_min}
          onChange={(v) => set('login_bloqueio_min', v)}
          min={1}
          max={240}
          dica="Após exceder as tentativas. 1–240."
        />
      </Secao>

      <Secao titulo="2FA">
        <CampoBool
          label="Exigir 2FA de todos os operadores"
          valor={form.exigir_2fa_todos}
          onChange={(v) => set('exigir_2fa_todos', v)}
          dica="Bloqueia login de operador sem 2FA configurado."
        />
      </Secao>

      <Secao titulo="Sessão de Suporte (Impersonate)">
        <CampoNum
          label="Validade da sessão de suporte (min)"
          valor={form.impersonate_validade_min}
          onChange={(v) => set('impersonate_validade_min', v)}
          min={5}
          max={240}
          dica="5–240."
        />
        <CampoBool
          label="Suporte inicia em somente-leitura"
          valor={form.impersonate_read_only_padrao}
          onChange={(v) => set('impersonate_read_only_padrao', v)}
        />
      </Secao>

      <Secao titulo="Rate limiting (formato N/min)">
        <CampoTexto
          label="Login do painel"
          valor={form.throttle_vendor_login}
          onChange={(v) => set('throttle_vendor_login', v)}
          dica="Ex.: 30/min"
        />
        <CampoTexto
          label="Impersonate"
          valor={form.throttle_impersonate}
          onChange={(v) => set('throttle_impersonate', v)}
          dica="Ex.: 30/min"
        />
        <CampoTexto
          label="Database Studio"
          valor={form.throttle_studio}
          onChange={(v) => set('throttle_studio', v)}
          dica="Ex.: 60/min"
        />
      </Secao>

      <div className="flex justify-end">
        <Button
          onClick={onSalvar}
          disabled={salvar.isPending}
          className="bg-[#D4AF37] text-black hover:bg-[#C29D26] disabled:opacity-60"
        >
          {salvar.isPending ? 'Salvando…' : 'Salvar configurações'}
        </Button>
      </div>
    </div>
  )
}
