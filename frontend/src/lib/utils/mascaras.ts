/**
 * Máscaras de digitação (aplicadas enquanto o usuário digita).
 *
 * Todas descartam o que passa do padrão — ex.: CPF nunca aceita o 12º dígito.
 * As funções recebem qualquer entrada (com ou sem máscara) e devolvem o texto
 * já formatado; use `soDigitos` quando precisar do valor cru para enviar à API.
 */

export function soDigitos(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '')
}

/** CPF: 000.000.000-00 (máx. 11 dígitos). */
export function mascararCpf(valor: string): string {
  const d = soDigitos(valor).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** CNPJ: 00.000.000/0000-00 (máx. 14 dígitos). */
export function mascararCnpj(valor: string): string {
  const d = soDigitos(valor).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/**
 * Telefone BR: (00) 0000-0000 (fixo, 10 díg.) ou (00) 00000-0000 (celular, 11 díg.).
 * Máx. 11 dígitos. Enquanto tem <= 10, formata como fixo; ao chegar no 11º, vira celular.
 */
export function mascararTelefone(valor: string): string {
  const d = soDigitos(valor).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** CEP: 00000-000 (máx. 8 dígitos). */
export function mascararCep(valor: string): string {
  const d = soDigitos(valor).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

/** Apenas dígitos, com limite opcional de quantidade. */
export function mascararInteiro(valor: string, maxDigitos?: number): string {
  const d = soDigitos(valor)
  return maxDigitos ? d.slice(0, maxDigitos) : d
}
