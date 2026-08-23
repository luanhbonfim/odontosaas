# 📚 Índice Geral da Documentação — PróClínica / OdontoSaaS

Bem-vindo à central de documentação técnica e de negócio da plataforma **PróClínica (OdontoSaaS)**.  
A documentação está organizada em 4 grandes pilares temáticos:

---

## 🏗️ [01-arquitetura/](01-arquitetura/) — Arquitetura, Modelagem & Infraestrutura
Documentos que definem as decisões técnicas estruturais, multi-tenancy e banco de dados.

* 📄 [`01-arquitetura-geral.md`](01-arquitetura/01-arquitetura-geral.md): Visão geral da arquitetura Django + Django-Tenants (PostgreSQL schemas) + React SPA.
* 📄 [`02-modelagem-dados.md`](01-arquitetura/02-modelagem-dados.md): Dicionário de dados, entidades compartilhadas e isoladas por clínica.
* 📄 [`03-ambientes-e-fluxo.md`](01-arquitetura/03-ambientes-e-fluxo.md): Configuração de ambientes (dev, staging, prod), variáveis e containers Docker.
* 📄 [`04-google-oauth-multitenant.md`](01-arquitetura/04-google-oauth-multitenant.md): Especificação da integração OAuth 2.0 multi-tenant com o Google Calendar.

---

## 🏥 [02-backlog-tenants/](02-backlog-tenants/) — Aplicação das Clínicas (Tenants)
Planejamento de sprints e funcionalidades voltadas ao dia a dia do consultório odontológico.

* 📄 [`01-backlog-backend-tenants.md`](02-backlog-tenants/01-backlog-backend-tenants.md): Backlog de desenvolvimento das APIs Django da clínica.
* 📄 [`02-backlog-frontend-tenants.md`](02-backlog-tenants/02-backlog-frontend-tenants.md): Backlog de desenvolvimento do SPA React das clínicas.
* 📄 [`03-planos-pagamentos.md`](02-backlog-tenants/03-planos-pagamentos.md): Regras de precificação, limites de planos e cobrança recorrente.

---

## 🛡️ [03-vendor-admin/](03-vendor-admin/) — Painel de Governança da Plataforma (Vendor)
Documentação técnica e roadmap do console administrativo dos operadores e mantenedores do SaaS.

* 📄 [`01-especificacao-vendor-admin.md`](03-vendor-admin/01-especificacao-vendor-admin.md): Especificação completa do painel vendor (provisionamento, expurgo, database studio, celery beat).
* 📄 [`02-backlog-sprints-vendor.md`](03-vendor-admin/02-backlog-sprints-vendor.md): **Fonte de Verdade** do desenvolvimento das Sprints V1 a V10 com resumos de validação DevOps.
* 📄 [`03-observacoes-painel-admin.md`](03-vendor-admin/03-observacoes-painel-admin.md): Notas sobre RBAC, isolamento e camuflagem 404 em hosts de tenants.

---

## 🎨 [04-frontend-design-system/](04-frontend-design-system/) — Design System & UI/UX
Padrão visual, componentes reutilizáveis, formulários e acessibilidade.

* 📄 [`01-arquitetura-frontend.md`](04-frontend-design-system/01-arquitetura-frontend.md): Arquitetura do SPA (React 19, Vite, TanStack Query, Zustand, Axios).
* 📄 [`02-ui-ux-design-system.md`](04-frontend-design-system/02-ui-ux-design-system.md): Tokens Tailwind CSS, tipografia Inter e paletas de cores.
* 📄 [`03-diretrizes-design-system.md`](04-frontend-design-system/03-diretrizes-design-system.md): **Guia Oficial de Paridade**: Regras para manter formulários, botões e ícones idênticos entre Tenants e Vendor.
* 📄 [`04-padrao-formularios.md`](04-frontend-design-system/04-padrao-formularios.md): Especificação e uso prático do `FormKit` (`CabecalhoDrawer`, `CorpoDrawer`, `Campo`, `LinhaToggle`).

---

## 🚀 [05-landing-page/](05-landing-page/) — Página Inicial / Vendas (Landing Page)
Documentação da página pública comercial do PróClínica Cloud com exibição dinâmica de planos e captação de leads.

* 📄 [`01-especificacao-landing-page.md`](05-landing-page/01-especificacao-landing-page.md): Especificação funcional, design dark luxury, seções e integrações.
* 📄 [`02-backlog-sprints-landing-page.md`](05-landing-page/02-backlog-sprints-landing-page.md): Backlog de desenvolvimento das Sprints LP1 a LP5.
* 📄 [`03-diretrizes-copywriting-e-conversao.md`](05-landing-page/03-diretrizes-copywriting-e-conversao.md): Diretrizes de copywriting, mensagens para WhatsApp e quebra de objeções.

---

## 🗺️ [06-roadmap/](06-roadmap/) — Roadmap de Sprints (novas funcionalidades)
Sequência de validação dos planos/permissões e desenvolvimento das novas features.

* 📄 [`00-plano-sprints-planos-e-novas-features.md`](06-roadmap/00-plano-sprints-planos-e-novas-features.md): Índice-mestre — valida planos/limites/permissões e sequencia as entregas.
* 📄 [`01-backlog-armazenamento-nuvem.md`](06-roadmap/01-backlog-armazenamento-nuvem.md): Armazenamento em nuvem & anexos com cota real por plano (AS1–AS4).
* 📄 [`02-backlog-ia-assistente-dentista.md`](06-roadmap/02-backlog-ia-assistente-dentista.md): Assistente com IA para o dentista via LangChain (IA1–IA4).
* 📄 [`03-backlog-tiss-convenios.md`](06-roadmap/03-backlog-tiss-convenios.md): Padrão TISS & integração com convênios — guias ANS, lote e retorno/glosas (T1–T4).

---

> 💡 *Ao criar ou atualizar documentação, certifique-se de manter os links relativos consistentes.*
