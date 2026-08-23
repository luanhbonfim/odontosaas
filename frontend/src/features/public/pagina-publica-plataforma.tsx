import { FaqSection } from './components/faq-section'
import { FloatingWhatsApp } from './components/floating-whatsapp'
import { FooterLanding } from './components/footer-landing'
import { HeaderLanding } from './components/header-landing'
import { HeroSection } from './components/hero-section'
import { IntegracoesShowcase } from './components/integracoes-showcase'
import { MetricasSection } from './components/metricas-section'
import { OdontogramaShowcase } from './components/odontograma-showcase'
import { PlanosSection } from './components/planos-section'
import { RecursosSection } from './components/recursos-section'

/**
 * Landing page / página de vendas do PróClínica.
 * Renderizada no host público raiz (sem tenant) — ver `RootRouter` em App.tsx.
 *
 * Tema claro (rosa blush + dourado) consistente com o app das clínicas: usa os
 * tokens semânticos de `src/index.css` (`bg-background`, `text-foreground`,
 * `bg-card`, `border-border`, `text-primary`, ...) em vez de cores hex cruas.
 */
export function PaginaPublicaPlataforma() {
  return (
    <div className="min-h-svh bg-background text-foreground antialiased">
      <HeaderLanding />
      <main>
        <HeroSection />
        <MetricasSection />
        <RecursosSection />
        <OdontogramaShowcase />
        <IntegracoesShowcase />
        <PlanosSection />
        <FaqSection />
      </main>
      <FooterLanding />
      <FloatingWhatsApp />
    </div>
  )
}
