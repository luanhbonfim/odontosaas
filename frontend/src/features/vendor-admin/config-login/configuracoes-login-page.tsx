import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { Info, SlidersHorizontal } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LinhaToggle } from '@/components/common/form-kit'
import { BotaoVendorPrimario } from '../ui/vendor-ui'
import { type ConfigLogin, useConfigLogin, useSalvarConfigLogin } from './use-config-login'

/** Palette dark do input do vendor, aplicada sobre o shadcn Input. */
const inputVendorCls = 'bg-[#0B132B]/80 border-[#1E2D56] text-white text-xs focus-visible:border-[#D4AF37]'

/** Ícone "ⓘ" com tooltip explicativo no hover/foco (Tailwind puro, sem dependência). */
function InfoDica({ texto }: { texto: string }) {
  return (
    <span className="group/dica relative inline-flex align-middle">
      <Info
        tabIndex={0}
        aria-label={texto}
        className="size-3.5 shrink-0 cursor-help text-slate-500 outline-none transition-colors hover:text-[#D4AF37] focus-visible:text-[#D4AF37]"
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-56 -translate-x-1/2 rounded-md border border-[#1E2D56] bg-[#0B132B] px-2.5 py-1.5 text-[11px] leading-snug text-slate-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover/dica:opacity-100 group-focus-within/dica:opacity-100"
      >
        {texto}
      </span>
    </span>
  )
}

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
  const id = useId()
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-slate-200">
          {props.label}
        </Label>
        {props.dica && <InfoDica texto={props.dica} />}
      </div>
      <Input
        id={id}
        type="number"
        className={inputVendorCls}
        value={props.valor}
        min={props.min}
        max={props.max}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  )
}

function CampoTexto(props: { label: string; valor: string; onChange: (v: string) => void; dica?: string }) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-slate-200">
          {props.label}
        </Label>
        {props.dica && <InfoDica texto={props.dica} />}
      </div>
      <Input id={id} type="text" className={inputVendorCls} value={props.valor} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  )
}

function CampoBool(props: { label: string; valor: boolean; onChange: (v: boolean) => void; dica?: string }) {
  return (
    <LinhaToggle
      className="bg-[#0B132B]/60 border-[#1E2D56]"
      titulo={
        <span className="flex items-center gap-1.5">
          {props.label}
          {props.dica && <InfoDica texto={props.dica} />}
        </span>
      }
      checked={props.valor}
      onChange={(e) => props.onChange(e.target.checked)}
    />
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
          dica="Por quanto tempo o token de acesso vale antes de ser renovado automaticamente em segundo plano, sem o operador perceber. Valores menores = mais seguro. Faixa: 5 a 240 minutos."
        />
        <CampoNum
          label="Duração da sessão / refresh (horas)"
          valor={form.refresh_token_horas}
          onChange={(v) => set('refresh_token_horas', v)}
          min={1}
          max={720}
          dica="Tempo máximo que o operador fica logado sem digitar a senha de novo. Passado esse prazo, a sessão expira e exige novo login no painel. Faixa: 1 a 720 horas (30 dias)."
        />
        <CampoBool
          label="Rotacionar refresh a cada uso"
          valor={form.rotacionar_refresh}
          onChange={(v) => set('rotacionar_refresh', v)}
          dica="Emite um novo token de refresh a cada renovação e invalida o anterior. Dificulta o reúso de um token roubado, mas exige a blacklist do SimpleJWT habilitada. Deixe desligado se não tiver certeza."
        />
      </Secao>

      <Secao titulo="Proteção de Login (força bruta)">
        <CampoNum
          label="Máx. de tentativas por IP"
          valor={form.login_max_tentativas}
          onChange={(v) => set('login_max_tentativas', v)}
          min={3}
          max={20}
          dica="Quantas tentativas de login erradas o mesmo IP pode fazer antes de ser bloqueado temporariamente. Vale tanto para o login das clínicas quanto para o do painel. Faixa: 3 a 20."
        />
        <CampoNum
          label="Tempo de bloqueio (min)"
          valor={form.login_bloqueio_min}
          onChange={(v) => set('login_bloqueio_min', v)}
          min={1}
          max={240}
          dica="Depois de estourar o limite de tentativas, por quanto tempo o IP fica impedido de tentar logar novamente. Faixa: 1 a 240 minutos."
        />
      </Secao>

      <Secao titulo="2FA">
        <CampoBool
          label="Exigir 2FA de todos os operadores"
          valor={form.exigir_2fa_todos}
          onChange={(v) => set('exigir_2fa_todos', v)}
          dica="Quando ligado, nenhum operador entra no painel sem ter o 2FA (autenticação em dois fatores por app, ex.: Google Authenticator) configurado. Operadores sem 2FA cadastrado ficam bloqueados até configurar. Ative seu 2FA antes na tela 'Autenticação 2FA' do menu."
        />
      </Secao>

      <Secao titulo="Sessão de Suporte (Impersonate)">
        <CampoNum
          label="Validade da sessão de suporte (min)"
          valor={form.impersonate_validade_min}
          onChange={(v) => set('impersonate_validade_min', v)}
          min={5}
          max={240}
          dica="Duração do token de acesso de suporte, gerado quando um operador entra na conta de uma clínica para dar suporte (impersonate). Ao expirar, o acesso à clínica é encerrado. Faixa: 5 a 240 minutos."
        />
        <CampoBool
          label="Suporte inicia em somente-leitura"
          valor={form.impersonate_read_only_padrao}
          onChange={(v) => set('impersonate_read_only_padrao', v)}
          dica="Quando ligado, a sessão de suporte começa sem permissão de alterar dados (só leitura): o operador vê tudo mas não consegue criar, editar ou apagar nada na clínica. É o padrão recomendado para proteger os dados do cliente."
        />
      </Secao>

      <Secao titulo="Rate limiting (formato N/min)">
        <CampoTexto
          label="Login do painel"
          valor={form.throttle_vendor_login}
          onChange={(v) => set('throttle_vendor_login', v)}
          dica="Máximo de requisições ao endpoint de login do painel por IP, no formato N/período (ex.: 30/min). É a segunda camada de defesa contra força bruta, além do bloqueio por tentativas. Não use 0 (bloquearia todo mundo, inclusive você). N entre 1 e 10000."
        />
        <CampoTexto
          label="Impersonate"
          valor={form.throttle_impersonate}
          onChange={(v) => set('throttle_impersonate', v)}
          dica="Máximo de gerações de sessão de suporte (impersonate) por operador, no formato N/período (ex.: 30/min). Limita abuso da função de entrar em clínicas. N entre 1 e 10000."
        />
        <CampoTexto
          label="Database Studio"
          valor={form.throttle_studio}
          onChange={(v) => set('throttle_studio', v)}
          dica="Máximo de execuções no console SQL (Database Studio) por operador, no formato N/período (ex.: 60/min). N entre 1 e 10000."
        />
      </Secao>

      <div className="flex justify-end">
        <BotaoVendorPrimario onClick={onSalvar} disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando…' : 'Salvar configurações'}
        </BotaoVendorPrimario>
      </div>
    </div>
  )
}
