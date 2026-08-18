import { StatusBadge, type VarianteStatus } from '@/components/common/status-badge'

// Rótulo legível + cor por status (planos, guias, consultas). Fonte única.
const VARIANTE_STATUS: Record<string, VarianteStatus> = {
  ATIVO: 'sucesso',
  SUSPENSO: 'pendente',
  CANCELADO: 'neutro',
  DESATIVADO: 'neutro',
  VENCIDO: 'erro',
  EMITIDA: 'neutro',
  AUTORIZADA: 'info',
  EXECUTADA: 'pendente',
  PAGA: 'sucesso',
  GLOSADA: 'erro',
  AGENDADA: 'info',
  EM_ATENDIMENTO: 'pendente',
  REALIZADA: 'sucesso',
  FALTOU: 'faltou',
  CANCELADA: 'erro',
  PENDENTE: 'pendente',
  CONFIRMADA: 'sucesso',
  RECUSADA: 'erro',
  SEM_RESPOSTA: 'neutro',
}

function rotuloStatus(status: string): string {
  const texto = status.replace(/_/g, ' ').toLowerCase()
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function BadgeStatus({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground">—</span>
  return (
    <StatusBadge variante={VARIANTE_STATUS[status] ?? 'neutro'}>{rotuloStatus(status)}</StatusBadge>
  )
}

/** Badge da cobrança da consulta: cores distintas para convênio e particular. */
export function BadgeCobranca({ convenioNome }: { convenioNome: string | null | undefined }) {
  if (convenioNome) {
    return <StatusBadge variante="info">Convênio — {convenioNome}</StatusBadge>
  }
  return <StatusBadge variante="pendente">Particular</StatusBadge>
}
