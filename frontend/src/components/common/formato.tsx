import {
  formatarCpf,
  formatarData,
  formatarDataHora,
  formatarMoeda,
  formatarTelefone,
} from '@/lib/utils/format'

/** Valor monetário em BRL. Ex.: R$ 1.200,00 */
export function Money({ valor }: { valor: number | string }) {
  return <span className="tabular-nums">{formatarMoeda(valor)}</span>
}

/** Telefone no padrão (DDD) Número. */
export function PhoneText({ valor }: { valor: string | null | undefined }) {
  return <span className="tabular-nums">{formatarTelefone(valor)}</span>
}

/** CPF no padrão 000.000.000-00. */
export function Cpf({ valor }: { valor: string | null | undefined }) {
  return <span className="tabular-nums">{formatarCpf(valor)}</span>
}

/** Data e hora no fuso America/Sao_Paulo. */
export function DateTime({ iso }: { iso: string | null | undefined }) {
  return <span className="tabular-nums">{formatarDataHora(iso)}</span>
}

/** Apenas a data no fuso America/Sao_Paulo. */
export function DateText({ iso }: { iso: string | null | undefined }) {
  return <span className="tabular-nums">{formatarData(iso)}</span>
}
