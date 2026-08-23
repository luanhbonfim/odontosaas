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
      className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${
        comSombra
          ? 'border-border bg-background/80 shadow-lg shadow-primary/5 backdrop-blur-xl'
          : 'border-transparent bg-background/40 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#topo" className="flex items-center gap-2.5" aria-label="PróClínica — início">
          <img
            src="/logo-1-removebg-preview.png"
            alt="PróClínica"
            className="size-10 w-auto object-contain"
          />
          <span className="text-base font-bold tracking-tight text-foreground">
            Pró<span className="text-[#b89048]">Clínica</span>
          </span>
        </a>

        {/* Navegação desktop */}
        <nav aria-label="Navegação principal" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:text-[#128C4A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#25D366]"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            Falar com Consultor
          </a>
          <a
            href="#planos"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:shadow-lg hover:shadow-primary/40 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Começar Agora
          </a>
        </div>

        {/* Botão do menu mobile */}
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="inline-flex size-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:hidden"
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
          className="border-t border-border bg-background/95 px-4 py-4 backdrop-blur-xl md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setAberto(false)}
                  className="block rounded-md px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-primary"
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-[#25D366] hover:text-[#128C4A]"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              Falar com Consultor
            </a>
            <a
              href="#planos"
              onClick={() => setAberto(false)}
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:brightness-105"
            >
              Começar Agora
            </a>
          </div>
        </nav>
      )}
    </header>
  )
}
