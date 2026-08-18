import { CalendarCheck, CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { DateTime } from '@/components/common/formato'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ErroApi } from '@/lib/api/client'

import { useConfirmacaoInfo, useResponderConfirmacao } from './use-confirmacao'

const ROTULO: Record<string, string> = {
  CONFIRMADA: 'Consulta confirmada! ✅',
  RECUSADA: 'Consulta cancelada.',
}

/** Página pública (paciente) aberta pelo link do WhatsApp — sem login. */
export function ConfirmacaoPage() {
  const { token = '' } = useParams()
  const { data, isLoading, isError } = useConfirmacaoInfo(token)
  const responder = useResponderConfirmacao(token)
  const [resposta, setResposta] = useState<string | null>(null)

  async function responderConfirmacao(acao: 'confirmar' | 'recusar') {
    try {
      const r = await responder.mutateAsync(acao)
      setResposta(r.status_confirmacao)
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível registrar sua resposta.')
    }
  }

  // Estado final: já respondida (agora ou anteriormente).
  const estadoFinal =
    resposta ?? (data && data.status_confirmacao !== 'PENDENTE' ? data.status_confirmacao : null)

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-5 p-6 text-center">
          <div className="flex justify-center">
            <CalendarCheck className="size-10 text-primary" />
          </div>

          {isLoading ? (
            <Skeleton className="mx-auto h-24 w-full" />
          ) : isError || !data ? (
            <p className="text-sm text-muted-foreground">
              Link inválido ou expirado. Fale com a clínica.
            </p>
          ) : estadoFinal ? (
            <div className="space-y-2">
              {estadoFinal === 'CONFIRMADA' ? (
                <CheckCircle2 className="mx-auto size-12 text-success" />
              ) : (
                <XCircle className="mx-auto size-12 text-destructive" />
              )}
              <p className="text-lg font-semibold">{ROTULO[estadoFinal] ?? estadoFinal}</p>
              <p className="text-sm text-muted-foreground">
                {data.paciente_nome} — <DateTime iso={data.inicio} />
              </p>
              <p className="text-xs text-muted-foreground">Pode fechar esta janela.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Olá, {data.paciente_nome}!</p>
                <p className="text-base font-medium">
                  Você confirma sua consulta com {data.dentista_nome}?
                </p>
                <p className="text-sm text-muted-foreground">
                  <DateTime iso={data.inicio} />
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => responderConfirmacao('confirmar')}
                  disabled={responder.isPending}
                >
                  <CheckCircle2 /> Confirmar presença
                </Button>
                <Button
                  variant="outline"
                  onClick={() => responderConfirmacao('recusar')}
                  disabled={responder.isPending}
                >
                  <XCircle /> Não poderei ir
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
