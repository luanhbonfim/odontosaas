import { describe, expect, it } from 'vitest'

import {
  formatarCpf,
  formatarData,
  formatarDataHora,
  formatarMoeda,
  formatarTelefone,
} from './format'

describe('formatadores', () => {
  it('formata moeda em BRL', () => {
    expect(formatarMoeda(1200)).toBe('R$ 1.200,00')
    expect(formatarMoeda('150.5')).toBe('R$ 150,50')
  })

  it('formata telefone (DDD) número', () => {
    expect(formatarTelefone('5518997999509')).toBe('(18) 99799-9509')
    expect(formatarTelefone('18997999509')).toBe('(18) 99799-9509')
    expect(formatarTelefone('1833334444')).toBe('(18) 3333-4444')
    expect(formatarTelefone('')).toBe('')
  })

  it('formata CPF em 000.000.000-00', () => {
    expect(formatarCpf('11122233344')).toBe('111.222.333-44')
    expect(formatarCpf('111.222.333-44')).toBe('111.222.333-44')
    expect(formatarCpf('123')).toBe('123') // dígitos insuficientes -> original
    expect(formatarCpf(null)).toBe('')
  })

  it('formata data e data/hora em pt-BR (America/São_Paulo)', () => {
    // 2026-07-24T12:00:00Z == 09:00 em São Paulo (-03:00)
    expect(formatarData('2026-07-24T12:00:00Z')).toBe('24/07/2026')
    expect(formatarDataHora('2026-07-24T12:00:00Z')).toBe('24/07/2026, 09:00')
    expect(formatarDataHora('')).toBe('')
    expect(formatarDataHora('data-invalida')).toBe('')
  })
})
