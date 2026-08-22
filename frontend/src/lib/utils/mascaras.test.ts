import { describe, expect, it } from 'vitest'

import { mascararCep, mascararCnpj, mascararCpf, mascararInteiro, mascararTelefone, soDigitos } from './mascaras'

describe('máscaras de digitação', () => {
  it('CPF formata e limita a 11 dígitos', () => {
    expect(mascararCpf('12345678901')).toBe('123.456.789-01')
    expect(mascararCpf('123')).toBe('123')
    expect(mascararCpf('1234')).toBe('123.4')
    // não deixa passar do padrão (12º dígito é descartado)
    expect(mascararCpf('123456789012345')).toBe('123.456.789-01')
    // aceita entrada já mascarada
    expect(mascararCpf('123.456.789-01')).toBe('123.456.789-01')
  })

  it('CNPJ formata e limita a 14 dígitos', () => {
    expect(mascararCnpj('11222333000181')).toBe('11.222.333/0001-81')
    expect(mascararCnpj('112223330001819999')).toBe('11.222.333/0001-81')
  })

  it('telefone: fixo (10) e celular (11), máx. 11 dígitos', () => {
    expect(mascararTelefone('1899799950')).toBe('(18) 9979-9950')
    expect(mascararTelefone('18997999509')).toBe('(18) 99799-9509')
    expect(mascararTelefone('189979995099999')).toBe('(18) 99799-9509')
    expect(mascararTelefone('18')).toBe('(18')
  })

  it('CEP formata e limita a 8 dígitos', () => {
    expect(mascararCep('12345678')).toBe('12345-678')
    expect(mascararCep('123456789')).toBe('12345-678')
  })

  it('inteiro só aceita dígitos e respeita o limite', () => {
    expect(mascararInteiro('12a3b4')).toBe('1234')
    expect(mascararInteiro('123456', 3)).toBe('123')
  })

  it('soDigitos remove tudo que não é dígito', () => {
    expect(soDigitos('(18) 99799-9509')).toBe('18997999509')
    expect(soDigitos(null)).toBe('')
  })
})
