import { useEffect, useState } from 'react'
import { Menu, MessageCircle, X } from 'lucide-react'

import { linkWhatsApp, MSG_CONSULTOR } from '../whatsapp'

const NAV_LINKS = [
  { href: '#recursos', label: 'Recursos' },
  { href: '#integracoes', label: 'Integrações' },
  { href: '#planos', label: 'Planos & Preços' },
  { href: '#faq', label: 'FAQ' },
]

export function HeaderLanding() {
  const [aberto, setAberto] = useState(false)
  const [comSombra, setComSombra] = useState(false)

  useEffect(() => {
    const aoRolar = () => setComSombra(window.scrollY > 8)
    aoRolar()
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => window.removeEventListener('scroll', aoRolar)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b transition-colors ${
        comSombra
          ? 'border-[#1E2D56] bg-[#0B132B]/90 backdrop-blur-md shadow-lg shadow-black/30'
          : 'border-transparent bg-[#0B132B]/60 backdrop-blur-sm'
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#topo" className="flex items-center gap-2.5" aria-label="PróClínica Cloud — início">
          <span className="flex size-9 items-center justify-center rounded-xl border border-[#1E2D56] bg-[#111D3B] p-1.5">
            <img src="/logo.png" alt="" className="h-full w-auto object-contain" />
          </span>
          <span className="text-base font-bold tracking-tight text-slate-100">
            PróClínica <span className="text-[#D4AF37]">Cloud</span>
          </span>
        </a>

        {/* Navegação desktop */}
        <nav aria-label="Navegação principal" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-[#D4AF37] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Ações desktop */}
        <div className="hidden items-center gap-3 md:flex">
          <a
            href={linkWhatsApp(MSG_CONSULTOR)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:text-[#25D366] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#25D366]"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            Falar com Consultor
          </a>
          <a
            href="#planos"
            className="inline-flex items-center rounded-md bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-[#0B132B] shadow-md shadow-[#D4AF37]/20 transition-colors hover:bg-[#C29D26] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]"
          >
            Começar Agora
          </a>
        </div>

        {/* Botão do menu mobile */}
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="inline-flex size-10 items-center justify-center rounded-md text-slate-200 transition-colors hover:bg-[#111D3B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37] md:hidden"
          aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={aberto}
          aria-controls="menu-mobile"
        >
          {aberto ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
        </button>
      </div>

      {/* Menu mobile colapsável */}
      {aberto && (
        <nav
          id="menu-mobile"
          aria-label="Navegação principal (mobile)"
          className="border-t border-[#1E2D56] bg-[#0B132B]/95 px-4 py-4 backdrop-blur-md md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setAberto(false)}
                  className="block rounded-md px-3 py-3 text-base font-medium text-slate-200 transition-colors hover:bg-[#111D3B] hover:text-[#D4AF37]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-3">
            <a
              href={linkWhatsApp(MSG_CONSULTOR)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setAberto(false)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#1E2D56] px-4 py-3 text-sm font-medium text-slate-100 transition-colors hover:border-[#25D366] hover:text-[#25D366]"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              Falar com Consultor
            </a>
            <a
              href="#planos"
              onClick={() => setAberto(false)}
              className="inline-flex w-full items-center justify-center rounded-md bg-[#D4AF37] px-4 py-3 text-sm font-semibold text-[#0B132B] transition-colors hover:bg-[#C29D26]"
            >
              Começar Agora
            </a>
          </div>
        </nav>
      )}
    </header>
  )
}
