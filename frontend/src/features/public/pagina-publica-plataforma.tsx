import { FaqSection } from './components/faq-section'
import { FloatingWhatsApp } from './components/floating-whatsapp'
import { FooterLanding } from './components/footer-landing'
import { HeaderLanding } from './components/header-landing'
import { HeroSection } from './components/hero-section'
import { IntegracoesShowcase } from './components/integracoes-showcase'
import { MetricasSection } from './components/metricas-section'
import { PlanosSection } from './components/planos-section'
import { RecursosSection } from './components/recursos-section'

/**
 * Landing page / página de vendas do PróClínica Cloud.
 * Renderizada no host público raiz (sem tenant) — ver `RootRouter` em App.tsx.
 */
export function PaginaPublicaPlataforma() {
  return (
    <div className="min-h-svh scroll-smooth bg-[#0B132B] text-slate-100 antialiased">
      <HeaderLanding />
      <main>
        <HeroSection />
        <MetricasSection />
        <RecursosSection />
        <IntegracoesShowcase />
        <PlanosSection />
        <FaqSection />
      </main>
      <FooterLanding />
      <FloatingWhatsApp />
    </div>
  )
}
