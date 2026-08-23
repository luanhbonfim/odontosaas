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
    <footer className="bg-[#0B132B]" aria-labelledby="footer-titulo">
      <h2 id="footer-titulo" className="sr-only">
        Rodapé institucional
      </h2>
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          {/* Marca */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl border border-[#1E2D56] bg-[#111D3B] p-1.5">
                <img src="/logo.png" alt="" className="h-full w-auto object-contain" />
              </span>
              <span className="text-base font-bold tracking-tight text-slate-100">
                PróClínica <span className="text-[#D4AF37]">Cloud</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
              Plataforma SaaS de gestão inteligente para clínicas e consultórios odontológicos.
              Agenda, prontuário, financeiro e automação de WhatsApp em um só lugar.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#1E2D56] bg-[#111D3B]/70 px-3 py-1.5 text-xs font-medium text-slate-300">
              <ShieldCheck className="size-4 text-emerald-400" aria-hidden="true" />
              Em conformidade com a LGPD
            </span>
          </div>

          {/* Navegação */}
          <nav aria-label="Links do rodapé">
            <h3 className="text-sm font-semibold text-slate-200">Navegação</h3>
            <ul className="mt-4 space-y-2.5">
              {LINKS_NAV.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-slate-400 transition-colors hover:text-[#D4AF37]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Suporte / institucional */}
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Suporte & Institucional</h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a
                  href={linkWhatsApp(MSG_CONSULTOR)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-[#25D366]"
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Atendimento comercial
                </a>
              </li>
              {LINKS_INSTITUCIONAIS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-slate-400 transition-colors hover:text-[#D4AF37]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-[#1E2D56] pt-6">
          <p className="text-center text-xs text-slate-500">
            © 2026 PróClínica Cloud. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
