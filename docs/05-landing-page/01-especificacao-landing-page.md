# 🚀 Especificação Técnica & Funcional — Landing Page PróClínica Cloud

> **Documento de Especificação da Página Inicial / Vendas da Plataforma.**  
> **Localização:** Host público raiz (`localhost:5173` ou `proclinica.cloud`).  
> **Público-Alvo:** Dentistas autônomos, donos de clínicas, consultórios odontológicos e redes/franquias.

---

## 1. 🎯 Objetivos de Negócio & Proposta de Valor

A **Landing Page do PróClínica Cloud** é o ponto de entrada comercial e institucional do ecossistema SaaS. Seu papel principal é:
1. **Apresentar a Proposta Única de Valor (UVP):** Software odontológico moderno, com inteligência operacional, confirmações automatizadas por WhatsApp sem custos ocultos, sincronização bidirecional em tempo real com Google Calendar e isolamento seguro de dados (multi-tenant por schema PostgreSQL).
2. **Exibir os Planos Comerciais de Forma Dinâmica & Clara:** Apresentar a grade de planos (Básico, Profissional, Premium/Enterprise), destacando recursos contratáveis, limites de dentistas/armazenamento e alternador de periodicidade (Mensal vs. Anual com desconto).
3. **Maximizar a Conversão de Leads (CTAs Otimizados):** Direcionar o visitante de forma direta para:
   - **Solicitação de Demonstração / Teste Gratuito** (Trial de 7 ou 14 dias).
   - **Atendimento Especializado via WhatsApp** com mensagem pré-formatada com o plano de interesse.
4. **Estabelecer Autoridade & Segurança:** Destacar conformidade com a LGPD, criptografia ponta a ponta, backups automáticos diários com snapshot e infraestrutura em nuvem de alta disponibilidade.

---

## 2. 🎨 Identidade Visual & Design System

A Landing Page segue rigorosamente o **Design System PróClínica** definido em `docs/04-frontend-design-system/`:

* **Tema Base:** Dark Luxury Navy moderno e sofisticado (`bg-[#0B132B]`, `bg-[#111D3B]`, `border-[#1E2D56]`, `text-slate-100`).
* **Cor de Destaque / Acentuação:** Dourado Ouro Nobre (`#D4AF37` / `text-[#D4AF37]` / `hover:bg-[#C29D26]`).
* **Cores Semânticas de Apoio:**
  - Verde Esmeralda (`#10B981` / `emerald-400`): Indicadores de sucesso, economia e disponibilidade ativa.
  - Azul Elétrico (`#3B82F6`): Conexões técnicas, Google Sync e integrações.
  - Verde WhatsApp (`#25D366`): Botões e badges de atendimento e automações WAHA.
* **Tipografia:** `Inter`, com pesos 400 (regular), 500 (médio), 600 (semi-bold) e 700/800 (bold/extra-bold para headlines de impacto).
* **Efeitos Visuais:** Gradientes sutis em mesh (`radial-gradient`), cards com efeito *glassmorphism* escuro (`backdrop-blur-md bg-slate-900/80`), bordas com glow dourado sutil e microinterações fluidas via Tailwind CSS.

---

## 3. 🧩 Estrutura & Seções da Landing Page

A página é composta por **8 seções modulares e responsivas**:

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Header / Navbar (Sticky, Logo, Menus, CTA WhatsApp/Trial) │
├──────────────────────────────────────────────────────────────┤
│ 2. Hero Section (Headline, Subtitle, Badges, CTAs, Preview)  │
├──────────────────────────────────────────────────────────────┤
│ 3. Prova Social & Métricas de Impacto (KPIs em Destaque)     │
├──────────────────────────────────────────────────────────────┤
│ 4. Módulos & Recursos em Destaque (Cards Interativos 3D)     │
├──────────────────────────────────────────────────────────────┤
│ 5. Tabela Comparativa de Planos & Preços (Mensal / Anual)    │
├──────────────────────────────────────────────────────────────┤
│ 6. Demonstração Interativa / Por que Escolher o PróClínica? │
├──────────────────────────────────────────────────────────────┤
│ 7. Perguntas Frequentes (FAQ Acordeon com busca/respostas)   │
├──────────────────────────────────────────────────────────────┤
│ 8. Footer Corporativo (Links Institucionais, LGPD, Suporte)  │
└──────────────────────────────────────────────────────────────┘
```

---

### Detalhamento das Seções:

#### 1. Header / Navbar Fixa (`HeaderLanding`)
- **Logo PróClínica:** Vetorial em alta resolução com ícone dourado.
- **Menu de Navegação:**
  - `Recursos` (scroll suave para `#recursos`)
  - `Integrações` (scroll suave para `#integracoes`)
  - `Planos & Preços` (scroll suave para `#planos`)
  - `FAQ` (scroll suave para `#faq`)
- **Ações no Header:**
  - Botão *"Falar com Consultor"* (link direto para WhatsApp com mensagem parametrizada).
  - Botão Primário Dourado *"Começar Agora"* (scroll para `#planos` ou modal de demonstração).

#### 2. Hero Section de Alta Conversão (`HeroSection`)
- **Pill Badge Superior:** `✨ Software Odontológico de Próxima Geração • Multi-Tenant & IA`.
- **Headline Principal:** *"A gestão completa da sua clínica odontológica, simplificada e inteligente."*
- **Subtítulo:** *"Elimine faltas de pacientes com confirmações automáticas por WhatsApp, sincronize sua agenda em tempo real com o Google Calendar e tenha controle financeiro e clínico total em uma única plataforma."*
- **CTAs Principais:**
  - Botão Primário: `[Ver Planos & Começar]` (ícone `ArrowRight`).
  - Botão Secundário: `[Agendar Demonstração Gratuita]` (ícone `PlayCircle` ou `MessageCircle`).
- **Preview Visual do Dashboard:** Mockup estilizado em perspectiva com o visual real do ERP odontológico (Agenda, Métricas do Dia, Prontuário).

#### 3. Métricas de Impacto & Prova Social (`MetricasSection`)
- Grid com 4 cards de resultados comprovados:
  - **-45%** de redução em faltas e no-shows de consultas através do WhatsApp.
  - **100%** de sincronização em tempo real com Google Agenda no celular do dentista.
  - **+3 horas/dia** economizadas pela recepção em confirmações manuais e planilhas.
  - **99.9%** de uptime garantido com isolamento total de dados por clínica.

#### 4. Recursos & Módulos em Destaque (`RecursosSection`)
Grid visual com ícones dourados, descrições detalhadas e badges de categoria:
- 📅 **Agenda Inteligente & Google Calendar:** Sincronização bidirecional, suporte a múltiplos dentistas e cadeiras, bloqueio de conflitos e visão Dia/Semana/Mês.
- 💬 **WhatsApp Automatizado (WAHA):** Lembretes automáticos (24h/2h antes), confirmação interativa com link seguro e mensagens de reforço.
- 📋 **Prontuário Eletrônico & Anamnese Digital:** Histórico completo de tratamentos, odontograma visual, anexos de exames/raio-X e histórico de consultas.
- 💰 **Financeiro Odontológico & TISS:** Contas a pagar/receber, emissão de guias de convênios, fluxo de caixa em tempo real e quitação facilitada.
- 📦 **Controle de Estoque & Insumos:** Alertas inteligentes de estoque mínimo e baixa automática de materiais vinculada aos procedimentos realizados.
- 🛡️ **Segurança de Nível Bancário:** Schema isolado por clínica no PostgreSQL, trilha de auditoria para conformidade com a LGPD e criptografia HTTPS/TLS.

#### 5. Grade Dinâmica de Planos Comerciais (`PlanosSection`)
- **Alternador de Periodicidade:** Toggle animado `[Mensal | Anual (20% OFF)]`.
- **Origem dos Dados:**
  - Consulta automática ao endpoint público da plataforma (`GET /api/plataforma/planos/`) quando disponível.
  - Fallback estruturado para carregamento offline/estático imediato (Planos *Básico*, *Profissional* e *Enterprise*).
- **Cards de Planos:**
  - Tag de destaque no plano mais vendido (`MAIS POPULAR` com borda dourada iluminada).
  - Preço formatado em R$/mês.
  - Lista de *features* com checkmarks verdes (`✓`) e recursos indisponíveis (`✕`).
  - Botão de Ação: direciona diretamente para o WhatsApp comercial com mensagem parametrizada (ex.: *"Olá! Gostaria de contratar o Plano Profissional Anual do PróClínica Cloud"*).

#### 6. Perguntas Frequentes — FAQ (`FaqSection`)
Acordeon expansível com respostas diretas:
- *Como funciona a sincronização com o Google Calendar?*
- *Preciso pagar taxa extra pelos envios de WhatsApp?*
- *Como é garantida a segurança e privacidade dos prontuários (LGPD)?*
- *Posso migrar os dados do meu software atual?*
- *Existe fidelidade ou taxa de cancelamento?*
- *Como funciona o período de teste gratuito?*

#### 7. Rodapé Institucional (`FooterLanding`)
- Resumo institucional e logotipo.
- Links rápidos de navegação.
- Canal de suporte e atendimento comercial.
- Termos de Uso, Política de Privacidade e Certificação de Segurança.
- Copyright `© 2026 PróClínica Cloud. Todos os direitos reservados.`

---

## 4. ⚙️ Arquitetura Técnica Frontend

* **Componente Raiz:** [`PaginaPublicaPlataforma`](file:///c:/Users/Administrador/Downloads/ODONTO/frontend/src/features/public/pagina-publica-plataforma.tsx).
* **Pasta de Componentes:** `frontend/src/features/public/components/`
  - `header-landing.tsx`
  - `hero-section.tsx`
  - `metricas-section.tsx`
  - `recursos-section.tsx`
  - `planos-section.tsx`
  - `faq-section.tsx`
  - `footer-landing.tsx`
* **Gerenciamento de Estado & Dados:**
  - Hook TanStack Query `usePlanosPublicos()` para carregar planos do backend com cache de 1 hora.
  - Estado local para o toggle `frequencia` (`'MENSAL'` | `'ANUAL'`).
  - Utilitário `gerarLinkWhatsApp(planoNome, periodicidade)` para abrir o WhatsApp Web/App com a mensagem pré-configurada.
