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
