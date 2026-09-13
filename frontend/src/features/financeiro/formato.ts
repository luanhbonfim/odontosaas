/** Situação de exibição — "Vencido" não é um status real do backend (só
 * PENDENTE/PAGO/CANCELADO): é PENDENTE cujo vencimento já passou. */
export type Situacao = 'VENCIDO' | 'PENDENTE' | 'PAGO' | 'CANCELADO'

export function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function situacaoDe(l: { status?: string; vencimento?: string | null }): Situacao {
  if (l.status === 'PAGO') return 'PAGO'
  if (l.status === 'CANCELADO') return 'CANCELADO'
  return l.vencimento && l.vencimento < hojeISO() ? 'VENCIDO' : 'PENDENTE'
}

// Fundo "fraco" (translúcido) da linha pela situação — tons do próprio tema
// (destructive/warning/success), acompanham dark mode automaticamente.
export const COR_LINHA: Record<Situacao, string> = {
  VENCIDO: 'bg-destructive/10',
  PENDENTE: 'bg-warning/10',
  PAGO: 'bg-success/10',
  CANCELADO: '',
}

export const ROTULO_FORMA_PAGAMENTO: Record<string, string> = {
  PIX: 'Pix',
  BOLETO: 'Boleto',
  CARTAO: 'Cartão',
  DINHEIRO: 'Dinheiro',
  TRANSFERENCIA: 'Transferência',
}
