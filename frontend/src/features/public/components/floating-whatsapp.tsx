import { MessageCircle } from 'lucide-react'

import { linkWhatsApp, MSG_CONSULTOR } from '../whatsapp'

export function FloatingWhatsApp() {
  return (
    <a
      href={linkWhatsApp(MSG_CONSULTOR)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com um consultor no WhatsApp"
      className="fixed bottom-5 right-5 z-50 inline-flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-[#25D366]/30 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-[#25D366] opacity-60 motion-safe:animate-ping"
      />
      <MessageCircle className="relative size-7" aria-hidden="true" />
    </a>
  )
}
