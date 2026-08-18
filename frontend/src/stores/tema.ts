import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Tema = 'claro' | 'escuro'

type EstadoTema = {
  tema: Tema
  alternar: () => void
  definir: (tema: Tema) => void
}

export const useTema = create<EstadoTema>()(
  persist(
    (set, get) => ({
      tema: 'claro',
      alternar: () => set({ tema: get().tema === 'claro' ? 'escuro' : 'claro' }),
      definir: (tema) => set({ tema }),
    }),
    { name: 'odonto-tema' },
  ),
)

/** Aplica (ou remove) a classe `dark` no <html> conforme o tema. */
export function aplicarTema(tema: Tema) {
  document.documentElement.classList.toggle('dark', tema === 'escuro')
}
