import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function simularSistema(escuro: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((consulta: string) => ({
      matches: consulta.includes('dark') ? escuro : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
  Object.defineProperty(window, 'matchMedia', { value: globalThis.matchMedia, configurable: true })
}

describe('tema', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sem preferência salva, segue o tema do sistema', async () => {
    simularSistema(true)
    const { useTema } = await import('./tema')
    expect(useTema.getState().tema).toBe('escuro')
  })

  it('sistema claro -> começa no claro', async () => {
    simularSistema(false)
    const { useTema } = await import('./tema')
    expect(useTema.getState().tema).toBe('claro')
  })

  it('preferência salva vence o sistema', async () => {
    simularSistema(true)
    localStorage.setItem('odonto-tema', JSON.stringify({ state: { tema: 'claro' }, version: 0 }))
    const { useTema } = await import('./tema')
    expect(useTema.getState().tema).toBe('claro')
  })

  it('alternar troca o tema e aplicarTema liga/desliga a classe dark', async () => {
    simularSistema(false)
    const { useTema, aplicarTema } = await import('./tema')
    useTema.getState().alternar()
    expect(useTema.getState().tema).toBe('escuro')
    aplicarTema('escuro')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    aplicarTema('claro')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
