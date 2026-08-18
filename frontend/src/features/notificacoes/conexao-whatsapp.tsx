import { RefreshCw, Smartphone } from 'lucide-react'
import { toast } from 'sonner'

import { StatusBadge, type VarianteStatus } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ErroApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import {
  useConectarWhatsapp,
  useDesconectarWhatsapp,
  useQrWhatsapp,
  useWhatsappStatus,
} from './use-notificacoes'

const ROTULO_STATUS: Record<string, { variante: VarianteStatus; texto: string }> = {
  WORKING: { variante: 'sucesso', texto: 'Conectado' },
  SCAN_QR_CODE: { variante: 'pendente', texto: 'Aguardando leitura do QR' },
  STARTING: { variante: 'pendente', texto: 'Iniciando…' },
  STOPPED: { variante: 'neutro', texto: 'Desconectado' },
  FAILED: { variante: 'erro', texto: 'Falhou' },
  OFFLINE: { variante: 'erro', texto: 'WAHA offline' },
}

export function ConexaoWhatsapp() {
  const { data: status, isLoading } = useWhatsappStatus()
  const conectar = useConectarWhatsapp()
  const desconectar = useDesconectarWhatsapp()

  const estado = status?.status ?? 'STOPPED'
  const aguardandoQr = estado === 'SCAN_QR_CODE'
  const { data: qr } = useQrWhatsapp(aguardandoQr)
  const rotulo = ROTULO_STATUS[estado] ?? { variante: 'neutro' as VarianteStatus, texto: estado }

  async function aoConectar() {
    try {
      await conectar.mutateAsync()
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível iniciar a conexão.')
    }
  }

  async function aoDesconectar() {
    try {
      await desconectar.mutateAsync()
      toast.success('WhatsApp desconectado.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível desconectar.')
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-full',
                status?.conectado ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
              )}
            >
              <Smartphone className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Conexão do WhatsApp</p>
              <p className="text-xs text-muted-foreground">
                {status?.conectado && status.numero
                  ? `Número conectado: ${status.numero}`
                  : 'Pareie o WhatsApp da clínica lendo o QR Code.'}
              </p>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <StatusBadge variante={rotulo.variante}>{rotulo.texto}</StatusBadge>
          )}
        </div>

        {/* Aguardando leitura: mostra o QR. */}
        {aguardandoQr && (
          <div className="flex flex-col items-center gap-2 rounded-md border bg-muted/30 p-4">
            {qr ? (
              <img
                src={qr}
                alt="QR Code para parear o WhatsApp"
                className="size-56 rounded bg-white p-2"
              />
            ) : (
              <Skeleton className="size-56" />
            )}
            <p className="text-center text-xs text-muted-foreground">
              No celular da clínica: WhatsApp → Aparelhos conectados → Conectar um aparelho → aponte
              para este QR. Ele atualiza sozinho.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          {status?.conectado ? (
            <Button variant="outline" onClick={aoDesconectar} disabled={desconectar.isPending}>
              Desconectar
            </Button>
          ) : (
            <Button onClick={aoConectar} disabled={conectar.isPending}>
              <RefreshCw /> {conectar.isPending ? 'Conectando…' : 'Conectar / gerar QR'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
