const TZ = 'America/Sao_Paulo'

/** Formata um valor em Real (BRL). Aceita number ou string numérica. */
export function formatarMoeda(valor: number | string): string {
  const numero = typeof valor === 'string' ? Number(valor) : valor
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(numero) ? numero : 0,
  )
}

/** Telefone no formato (DDD) NÚMERO. Ex.: 5518997999509 → (18) 99799-9509. */
export function formatarTelefone(bruto: string | null | undefined): string {
  let digitos = (bruto ?? '').replace(/\D/g, '')
  if (digitos.length >= 12 && digitos.startsWith('55')) digitos = digitos.slice(2)
  if (digitos.length === 11)
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
  if (digitos.length === 10)
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  return bruto ?? ''
}

/** CPF no formato 000.000.000-00. Retorna o valor original se não tiver 11 dígitos. */
export function formatarCpf(bruto: string | null | undefined): string {
  const digitos = (bruto ?? '').replace(/\D/g, '')
  if (digitos.length !== 11) return bruto ?? ''
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`
}

/** Data + hora no formato pt-BR (fuso America/São_Paulo). Ex.: 24/07/2026 09:00. */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return ''
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: TZ,
  }).format(data)
}

/** Apenas a data no formato pt-BR (dd/MM/yyyy). Datas "puras" (YYYY-MM-DD, sem
 * hora — ex.: `vencimento` de um DateField do Django) são um dia de calendário,
 * não um instante: convertidas pro fuso America/São_Paulo como as demais, viravam
 * o dia anterior (meia-noite UTC = 21h do dia anterior em UTC-3). Por isso usam
 * hora local diretamente, sem conversão de fuso. */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return ''
  const somenteData = /^\d{4}-\d{2}-\d{2}$/.exec(iso)
  if (somenteData) {
    const [ano, mes, dia] = iso.split('-').map(Number)
    const data = new Date(ano, mes - 1, dia)
    return Number.isNaN(data.getTime())
      ? ''
      : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(data)
  }
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: TZ }).format(data)
}
