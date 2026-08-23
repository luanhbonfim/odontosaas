import { MessageCircle, ShieldCheck } from 'lucide-react'

import { linkWhatsApp, MSG_CONSULTOR } from '../whatsapp'

const LINKS_NAV = [
  { href: '#recursos', label: 'Recursos' },
  { href: '#integracoes', label: 'Integrações' },
  { href: '#planos', label: 'Planos & Preços' },
  { href: '#faq', label: 'FAQ' },
]

const LINKS_INSTITUCIONAIS = [
  { href: '#', label: 'Termos de Uso' },
  { href: '#', label: 'Política de Privacidade' },
  { href: '#', label: 'Certificação de Segurança' },
]

export function FooterLanding() {
  return (
    <footer className="bg-secondary/40" aria-labelledby="footer-titulo">
      <h2 id="footer-titulo" className="sr-only">
        Rodapé institucional
      </h2>
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          {/* Marca */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo-1-removebg-preview.png"
                alt="PróClínica"
                className="size-10 w-auto object-contain"
              />
              <span className="text-base font-bold tracking-tight text-foreground">
                PróClínica <span className="text-primary">Cloud</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Plataforma SaaS de gestão inteligente para clínicas e consultórios odontológicos.
              Agenda, prontuário, financeiro e automação de WhatsApp em um só lugar.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="size-4 text-success" aria-hidden="true" />
              Em conformidade com a LGPD
            </span>
          </div>

          {/* Navegação */}
          <nav aria-label="Links do rodapé">
            <h3 className="text-sm font-semibold text-foreground">Navegação</h3>
            <ul className="mt-4 space-y-2.5">
              {LINKS_NAV.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Suporte / institucional */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Suporte & Institucional</h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a
                  href={linkWhatsApp(MSG_CONSULTOR)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-[#128C4A]"
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Atendimento comercial
                </a>
              </li>
              {LINKS_INSTITUCIONAIS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <p className="text-center text-xs text-muted-foreground">
            © 2026 PróClínica Cloud. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
