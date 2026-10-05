# 📋 Backlog de Sprints — Landing Page PróClínica Cloud

> **Checklist e Fonte de Verdade para o Desenvolvimento da Landing Page Institucional & Vendas.**  
> Cada sprint é autossuficiente e acompanha testes automatizados de renderização e integração.

> **Estado (auditoria 05/10/2026):** a landing está implementada e no ar; este checklist foi reconciliado com o código. Pendências reais: LP2.3, LP3.4, LP4.3, LP5.1 (+ testes específicos LP2.4/LP4.5 e revisão de responsividade LP5.2 da landing).

---

## 🎯 Sprint LP1 — Arquitetura Base, Header & Hero Section de Alto Impacto

- [x] **LP1.1:** Estruturar a pasta `frontend/src/features/public/components/` com componentes modulares e desacoplados.
- [x] **LP1.2:** Desenvolver o `HeaderLanding` fixo (*sticky*) com logo, navegação por âncoras suaves (`#recursos`, `#integracoes`, `#planos`, `#faq`), botão de WhatsApp e CTA principal.
- [x] **LP1.3:** Desenvolver a `HeroSection` com headline persuasiva, badge dourado de inovação, CTAs de conversão e mockup visual do ERP odontológico.
- [x] **LP1.4:** Desenvolver a seção `MetricasSection` com 4 KPIs de prova social e impacto na rotina clínica.
- [x] **LP1.5:** Testes unitários de renderização do Header, Hero e Métricas (`landing-page-lp1.test.tsx`). — _coberto por `landing.test.tsx` (teste "renderiza as seções principais")._

---

## 💎 Sprint LP2 — Showcase de Recursos & Demonstração Interativa

- [x] **LP2.1:** Desenvolver a `RecursosSection` com grid responsivo de cards destacando os 6 pilares do PróClínica (Agenda Google Sync, WhatsApp WAHA, Prontuário/Anamnese, Financeiro TISS, Estoque e Segurança Multi-Tenant).
- [x] **LP2.2:** Desenvolver a `IntegracoesShowcase` com destaque para o fluxo bidirecional do Google Calendar e mensageria WAHA sem taxas por disparo.
- [ ] **LP2.3:** Seção de Demonstração Interativa / *Tour Visual* com abas de alternância de telas do consultório. — _PENDENTE: não há tour com abas (existe só o showcase do odontograma)._
- [ ] **LP2.4:** Testes de interação e renderização dos cards de recursos (`landing-page-lp2.test.tsx`).

---

## 💳 Sprint LP3 — Grade Dinâmica de Planos, Toggle Mensal/Anual & Integração WhatsApp

- [x] **LP3.1:** Implementar o hook `usePlanosPublicos()` consumindo `GET /api/plataforma/planos/` com fallback estático completo (Básico, Profissional, Enterprise).
- [x] **LP3.2:** Desenvolver a `PlanosSection` com toggle animado `[Mensal | Anual (20% OFF)]` e badge de destaque `MAIS POPULAR` no plano intermediário.
- [x] **LP3.3:** Criar utilitário `gerarLinkWhatsApp(plano, periodicidade, numeroComercial)` com mensagem customizada e botão de contratação direta.
- [ ] **LP3.4:** Modal rápido de Solicitação de Teste Gratuito (*Lead Capture Modal*) com validação Zod de Nome, E-mail e WhatsApp. — _PENDENTE: modal de captura de lead não implementado (CTA usa WhatsApp direto)._
- [x] **LP3.5:** Testes de cálculo de desconto anual, toggle de periodicidade e links de contratação (`landing-page-lp3.test.tsx`). — _coberto por `landing.test.tsx` (toggle mensal/anual, link de WhatsApp, fallback)._

---

## ❓ Sprint LP4 — FAQ Interativo, Footer Corporativo & SEO / Performance

- [x] **LP4.1:** Desenvolver a `FaqSection` com acordeon expansível estilizado no tema dark/dourado e respostas diretas para as 6 principais dúvidas de dentistas e gestores.
- [x] **LP4.2:** Desenvolver o `FooterLanding` corporativo com links institucionais, certificação LGPD, termos de uso, política de privacidade e canal de suporte. — _entregue; os links "Termos de Uso" e "Política de Privacidade" ainda são `href="#"` (páginas não existem — pendente)._
- [ ] **LP4.3:** Otimização de SEO (Meta Tags OpenGraph, Twitter Cards, Favicon, títulos dinâmicos e acessibilidade ARIA/WCAG AA). — _PENDENTE: `index.html` só tem `<title>` (faltam description, OpenGraph, Twitter Cards)._
- [x] **LP4.4:** Botão flutuante de WhatsApp (*Floating CTA*) no canto inferior direito com pulso de atenção.
- [ ] **LP4.5:** Testes de acordeon do FAQ, footer e acessibilidade (`landing-page-lp4.test.tsx`).

---

## 🧪 Sprint LP5 — Suíte E2E, Responsividade Mobile & Auditoria de Performance

- [ ] **LP5.1:** Suíte de testes ponta a ponta (E2E) simulando navegação completa do visitante: rolagem, alternância de planos, expansão de FAQ e clique em CTA. — _PENDENTE: o E2E Playwright atual cobre só o app da clínica, não a landing._
- [ ] **LP5.2:** Validação rigorosa de layout responsivo em resoluções Mobile (375px), Tablet (768px) e Desktop (1280px+).
- [x] **LP5.3:** Verificação de Typecheck (`tsc -b`), Lint (`eslint .`) e performance de carregamento.
- [ ] **LP5.4:** Consolidação e atualização da documentação técnica.
