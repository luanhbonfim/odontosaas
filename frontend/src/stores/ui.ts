import { useEffect, useState } from 'react'
import { create } from 'zustand'

const CONSULTA_DESKTOP = '(min-width: 768px)'

/** True quando a viewport é desktop (>= md do Tailwind). */
export function ehDesktop() {
  return typeof window !== 'undefined' && window.matchMedia(CONSULTA_DESKTOP).matches
}

/** Hook reativo: acompanha a mudança de viewport (desktop x mobile/tablet). */
export function useEhDesktop() {
  const [desktop, setDesktop] = useState(ehDesktop)
  useEffect(() => {
    const mql = window.matchMedia(CONSULTA_DESKTOP)
    const aoMudar = () => setDesktop(mql.matches)
    mql.addEventListener('change', aoMudar)
    return () => mql.removeEventListener('change', aoMudar)
  }, [])
  return desktop
}

// Telas realmente largas (>= lg). Abaixo disso (celular + tablet em retrato) as
// tabelas viram cards — evita scroll lateral em telas estreitas.
const CONSULTA_LG = '(min-width: 1024px)'

/** Hook reativo: true em telas largas (>= lg / 1024px). */
export function useEhTelaLarga() {
  const [larga, setLarga] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(CONSULTA_LG).matches,
  )
  useEffect(() => {
    const mql = window.matchMedia(CONSULTA_LG)
    const aoMudar = () => setLarga(mql.matches)
    mql.addEventListener('change', aoMudar)
    return () => mql.removeEventListener('change', aoMudar)
  }, [])
  return larga
}

type EstadoUI = {
  sidebarAberta: boolean
  alternarSidebar: () => void
  fecharSidebar: () => void
}

export const useUI = create<EstadoUI>((set) => ({
  // No desktop começa aberta; no mobile começa fechada (evita o drawer piscar no load).
  sidebarAberta: ehDesktop(),
  alternarSidebar: () => set((estado) => ({ sidebarAberta: !estado.sidebarAberta })),
  fecharSidebar: () => set({ sidebarAberta: false }),
}))
