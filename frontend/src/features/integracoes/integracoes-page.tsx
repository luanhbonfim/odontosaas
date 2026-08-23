import {
  Building2,
  CalendarClock,
  CalendarCheck2,
  Link2,
  RefreshCw,
  Stethoscope,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DateTime } from '@/components/common/formato'
import { StatusBadge } from '@/components/common/status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ErroApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import {
  type ConexaoGoogle,
  urlAutorizarGoogle,
  useConexoesGoogle,
  useConfigSync,
  useDesconectarGoogle,
  useSincronizarGoogle,
} from './use-integracoes'

// Obs.: o INTERVALO da sincronização não é configurável pela clínica — é um
// parâmetro de vendor (futuro painel de admin). Aqui só mostramos o informativo
// (última/próxima). Ver docs/04-OBSERVACOES-PAINEL-ADMIN.md.

export function IntegracoesPage() {
  const { data, isLoading, isError } = useConexoesGoogle()
  const { data: sync } = useConfigSync()
  const sincronizar = useSincronizarGoogle()
  const desconectar = useDesconectarGoogle()
  const [params, setParams] = useSearchParams()

  // Relógio para a contagem regressiva da próxima sincronização (tique de 1s).
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  // Tempo restante como contagem regressiva (mm:ss, ou h:mm:ss acima de 1h).
  function faltaPara(iso: string): string {
    const ms = new Date(iso).getTime() - agora
    if (ms <= 0) return 'a qualquer momento'
    const total = Math.floor(ms / 1000)
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    const pad = (n: number) => String(n).padStart(2, '0')
    return h > 0 ? `em ${h}:${pad(m)}:${pad(s)}` : `em ${pad(m)}:${pad(s)}`
  }

  // Retorno do callback OAuth (?google=conectado|erro) -> aviso + limpa a URL.
  useEffect(() => {
    const resultado = params.get('google')
    if (!resultado) return
    if (resultado === 'conectado') toast.success('Google Agenda conectado.')
    else toast.error('Não foi possível conectar ao Google Agenda.')
    setParams({}, { replace: true })
  }, [params, setParams])

  async function forcarSync() {
    try {
      const r = await sincronizar.mutateAsync()
      const partes = [
        r.criados ? `${r.criados} criada(s)` : null,
        r.atualizados ? `${r.atualizados} atualizada(s)` : null,
        r.removidos ? `${r.removidos} removida(s)` : null,
        r.canceladas ? `${r.canceladas} cancelada(s)` : null,
      ].filter(Boolean)
      toast.success(
        partes.length
          ? `Sincronização: ${partes.join(', ')}.`
          : 'Sincronização concluída — nada a atualizar.',
      )
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível sincronizar.')
    }
  }

  async function desconectarAlvo(conexao: ConexaoGoogle) {
    try {
      await desconectar.mutateAsync(conexao.dentista)
      toast.success('Conexão removida.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível desconectar.')
    }
  }

  function ConexaoCard({ conexao }: { conexao: ConexaoGoogle }) {
    const daClinica = conexao.dentista === null
    const Icone = daClinica ? Building2 : Stethoscope
    return (
      <Card className="overflow-hidden">
        {/* Mobile: empilha (nome com largura total em cima; status+ação embaixo). sm+: uma linha. */}
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-full',
                conexao.conectado ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
              )}
            >
              <Icone className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{conexao.dentista_nome}</p>
              <p className="text-xs text-muted-foreground">
                {daClinica ? 'Vê todos os pacientes' : 'Vê só os seus pacientes'}
                {conexao.conectado && conexao.atualizado_em ? (
                  <>
                    {' · desde '}
                    <DateTime iso={conexao.atualizado_em} />
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
            {conexao.conectado ? (
              <StatusBadge variante="sucesso">Conectado</StatusBadge>
            ) : (
              <StatusBadge variante="neutro">Desconectado</StatusBadge>
            )}
            {conexao.conectado ? (
              <ConfirmDialog
                titulo="Desconectar do Google?"
                descricao={`Remove a conexão de "${conexao.dentista_nome}". Os eventos já criados no Google não são apagados.`}
                rotuloConfirmar="Desconectar"
                destrutivo
                onConfirmar={() => desconectarAlvo(conexao)}
                trigger={
                  <Button variant="outline" size="sm">
                    Desconectar
                  </Button>
                }
              />
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  window.location.href = urlAutorizarGoogle(conexao.dentista)
                }}
              >
                <Link2 /> Conectar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Integrações"
        descricao="Conexão da agenda com o Google Calendar (por clínica e por dentista)."
        acoes={
          <Button variant="outline" onClick={forcarSync} disabled={sincronizar.isPending}>
            <RefreshCw className={sincronizar.isPending ? 'animate-spin' : undefined} />
            {sincronizar.isPending ? 'Sincronizando…' : 'Forçar sincronização'}
          </Button>
        }
      />

      {/* Faixa de status da sincronização (última + contagem regressiva). */}
      {sync && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border bg-muted/30 px-4 py-2.5 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarCheck2 className="size-4" />
            Última sincronização:{' '}
            <span className="font-medium text-foreground">
              {sync.ultima_sincronizacao ? <DateTime iso={sync.ultima_sincronizacao} /> : 'nunca'}
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarClock className="size-4" />
            Próxima:{' '}
            <span className="font-medium text-foreground">
              {sync.proxima_sincronizacao
                ? faltaPara(sync.proxima_sincronizacao)
                : `a cada ${sync.intervalo_minutos} min`}
            </span>
          </span>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Agendas</h2>
        {isError ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Não foi possível carregar as integrações. Tente novamente.
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-[68px] w-full" />
            <Skeleton className="h-[68px] w-full" />
          </div>
        ) : (data ?? []).length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma agenda para conectar.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {(data ?? []).map((conexao) => (
              <ConexaoCard key={String(conexao.dentista)} conexao={conexao} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
