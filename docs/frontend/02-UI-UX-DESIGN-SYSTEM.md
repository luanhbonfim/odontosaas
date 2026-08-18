# OdontoSaaS — Design System & UI/UX

> Documento vivo. Define os **princípios de experiência**, os **tokens de design** e os **componentes**
> que padronizam o produto. Objetivo: uma interface **clínica, eficiente e acessível**, consistente entre
> todos os módulos.

---

## 1. Princípios de UX

1. **Clareza clínica acima de tudo.** Informação de saúde e agenda precisa ser lida sem ambiguidade.
   Hierarquia visual forte, pouco ruído, estados sempre explícitos.
2. **Eficiência para quem usa o dia inteiro.** A recepção agenda/confirma dezenas de vezes por dia:
   atalhos de teclado, ações em 1-2 cliques, formulários curtos, foco automático, defaults inteligentes.
3. **Feedback imediato e honesto.** Toda ação tem retorno (loading, sucesso, erro). Nunca deixar o usuário
   em dúvida se algo aconteceu. Erros explicam **o que** e **como resolver**.
4. **Prevenção de erro.** Confirmar ações destrutivas, desabilitar o impossível, validar antes de enviar,
   refletir a validação do servidor no campo certo.
5. **Acessível por padrão (WCAG 2.1 AA).** Contraste, foco visível, navegação por teclado, ARIA correto,
   `prefers-reduced-motion`.
6. **Consistência.** Mesmos padrões para listar, criar, editar e dar baixa em qualquer módulo — quem
   aprende um módulo sabe usar todos.

### Personas / papéis
| Papel | Uso principal | Prioridade de UX |
|---|---|---|
| **Recepção** | Agenda, confirmações, cadastro de pacientes | Velocidade, teclado, densidade |
| **Dentista** | Agenda do dia, anamnese, consumo de insumo | Mobile/tablet, leitura rápida |
| **Financeiro** | Contas, faturamento, fluxo de caixa | Tabelas, filtros, exportação |
| **Admin da clínica** | Configura tudo (templates, integrações, equipe) | Controle e clareza |

---

## 2. Tokens de design

Implementados como **CSS variables** consumidas pelo Tailwind (tema claro/escuro), no padrão shadcn/ui.

### 2.1 Cores

**Marca / base**
| Token | Uso |
|---|---|
| `--primary` | Azul-petróleo/teal (confiança + saúde). Ações primárias, links, seleção |
| `--background` / `--foreground` | Fundo e texto base |
| `--muted` / `--muted-foreground` | Superfícies e textos secundários |
| `--border` / `--input` / `--ring` | Bordas, campos e foco |

**Semânticas de status** — reaproveitam a **linguagem de cor já usada na agenda** (evento **verde** =
confirmado, no Google Calendar) para consistência backend↔frontend:

| Estado (domínio) | Cor | Onde aparece |
|---|---|---|
| **Confirmada / Pago / OK** | **Verde** | `status_confirmacao=CONFIRMADA`, lançamento PAGO, saldo saudável |
| **Pendente / Aguardando** | **Âmbar** | `PENDENTE` (confirmação, conta a receber), estoque no limite |
| **Cancelada / Falta / Erro / Estoque baixo** | **Vermelho** | `CANCELADA`, `FALTOU`, `RECUSADA`, saldo < mínimo, falha de envio |
| **Neutro / Rascunho** | **Cinza** | `AGENDADA` (ainda não confirmada), rascunhos |
| **Info / Em andamento** | **Azul** | `EM_ATENDIMENTO`, sync em progresso |

> Regra: **cor nunca sozinha** — sempre acompanhada de ícone e/ou texto (daltonismo + acessibilidade).

### 2.2 Tipografia
- Fonte: **Inter** (UI) — legível em densidade alta. Tabular numerals para valores/horários.
- Escala: `xs 12 · sm 14 · base 16 · lg 18 · xl 20 · 2xl 24 · 3xl 30`. Corpo padrão **14–16px**.
- Pesos: 400 (texto), 500 (labels/ações), 600–700 (títulos/KPIs).

### 2.3 Espaçamento, raio e elevação
- **Grid base 4px** (escala 4/8/12/16/24/32/48).
- **Raio:** `sm 6 · md 8 · lg 12` (cards e modais mais arredondados que inputs).
- **Sombras:** sutis (`sm` para cards, `md` para popovers/dialogs). Sem sombras pesadas.

### 2.4 Tema
- **Claro e escuro** via classe `.dark` + CSS variables. Respeita `prefers-color-scheme`, com toggle manual
  persistido (store de tema). Contraste AA garantido nos dois temas.

---

## 3. Layout & navegação (App Shell)

```
┌───────────────────────────────────────────────────────────────┐
│ Topbar: [logo/clínica]      busca global      [tema] [perfil ▾] │
├──────────────┬────────────────────────────────────────────────┤
│ Sidebar      │  PageHeader: título · breadcrumbs · ações        │
│ (por módulo) │ ─────────────────────────────────────────────── │
│  Dashboard   │                                                  │
│  Agenda      │   Conteúdo da página                             │
│  Pacientes   │   (tabela / calendário / formulário / cards)     │
│  Dentistas   │                                                  │
│  Estoque     │                                                  │
│  Financeiro  │                                                  │
│  Notificações│                                                  │
│  Config ⚙    │                                                  │
└──────────────┴────────────────────────────────────────────────┘
```

- **Sidebar** colapsável (ícones), itens filtrados por **papel**. Item ativo destacado.
- **Topbar**: nome da clínica (tenant), **busca global** (paciente/consulta), tema e menu do usuário.
- **Responsivo:** sidebar vira **drawer** no mobile; topbar compacta; tabelas viram **cards empilhados**.
- **Densidade:** modo compacto opcional em tabelas para a recepção.

---

## 4. Biblioteca de componentes (padrões reutilizáveis)

Sobre os primitivos do **shadcn/ui**, padronizamos componentes de produto:

| Componente | Papel |
|---|---|
| **`DataTable`** | Tabela com ordenação, filtro, paginação, seleção e ações por linha (TanStack Table). Base de todas as listas |
| **`FormDrawer` / `FormDialog`** | Criar/editar em painel lateral (desktop) ou modal — React Hook Form + Zod |
| **`StatusBadge`** | Badge com cor semântica + ícone + rótulo (confirmada/pendente/…); fonte única de verdade das cores de status |
| **`PageHeader`** | Título, breadcrumbs e ações primárias da página |
| **`KpiCard`** | Cartão de indicador (dashboard/financeiro) com valor, variação e ícone |
| **`EmptyState`** | Estado vazio com ilustração, texto e CTA (ex.: "Nenhum paciente ainda — cadastrar") |
| **`ConfirmDialog`** | Confirmação de ações destrutivas (excluir, expurgar, cancelar consulta) |
| **`Money` / `PhoneText` / `DateTime`** | Formatação pt-BR (BRL, `(DDD) número`, `dd/MM/yyyy HH:mm`) — reaproveita as regras do backend |
| **`AgendaCalendar`** | Wrapper do FullCalendar com as cores de status e ações (criar/editar/iniciar/finalizar) |

---

## 5. Padrões de estado (sempre os quatro)

Toda tela de dados trata explicitamente:

1. **Loading** → **skeletons** que imitam o layout final (não spinners genéricos).
2. **Empty** → `EmptyState` com CTA (o vazio é uma oportunidade de ação, não um beco).
3. **Error** → mensagem clara + botão "Tentar novamente"; erros de campo no formulário; erros de negócio em toast.
4. **Success** → dado renderizado; mutações confirmam com **toast** e atualizam a lista (invalidação/optimistic).

---

## 6. Fluxos-chave (mapeados para os módulos do backend)

| Fluxo | Experiência desejada |
|---|---|
| **Login** | Tela limpa (email+senha), erros inline, "entrar" com Enter, redirect pós-login ao dashboard |
| **Dashboard** | Visão do dia: próximas consultas, confirmações pendentes, alertas de estoque, KPIs financeiros |
| **Agendar consulta** | No calendário: clicar no horário → drawer com paciente (busca), dentista, procedimento, valor; **conflito de horário** mostrado antes de salvar |
| **Confirmação (WhatsApp)** | Ver `status_confirmacao` no evento (verde/âmbar); histórico do `LogNotificacao`; disparo/reenvio manual |
| **Atendimento** | Iniciar (AGENDADA→EM_ATENDIMENTO) e finalizar (→REALIZADA) com 1 clique; registrar **anamnese** e **consumo de insumo** |
| **Google Agenda** | Botão "Conectar" (OAuth), status da conexão, indicador de evento sincronizado (verde) |
| **Pacientes** | Busca instantânea, ficha com planos/guias/consultas/anamneses em abas |
| **Estoque** | Lista com saldo e **badge de alerta** (baixo); registrar entrada/saída; tela de "Alertas de reposição" |
| **Financeiro** | Contas a pagar/receber (filtros por tipo/status), **quitar** em 1 clique, **faturar operadora**, **fluxo de caixa** com gráfico (a receber × a pagar) |

---

## 7. Acessibilidade (WCAG 2.1 AA)

- Contraste mínimo **4.5:1** (texto) / **3:1** (UI) nos dois temas.
- **Navegação 100% por teclado**; foco visível (`--ring`); ordem de foco lógica; `Esc` fecha modais/drawers.
- **ARIA** correto (via Radix): diálogos com `role`/`aria-modal`, tabelas semânticas, labels em todos os campos.
- **Leitores de tela**: toasts com `aria-live`; mudanças de rota anunciadas; ícones decorativos com `aria-hidden`.
- Respeitar **`prefers-reduced-motion`** (desligar animações não essenciais).
- Testes automáticos com **axe** nos componentes; lint com `jsx-a11y`.

---

## 8. Internacionalização & localização (pt-BR)

- Idioma inicial **pt-BR**; textos centralizados (preparado para i18n futura).
- **Datas/horas:** `date-fns` locale pt-BR, timezone **America/São_Paulo** (espelha o backend). Formato
  `dd/MM/yyyy` e `HH:mm`.
- **Moeda:** Real (`Intl.NumberFormat('pt-BR', {currency:'BRL'})`).
- **Telefone:** `(DDD) NÚMERO` (mesma regra do `Paciente.telefone_formatado`).

---

## 9. Microcopy & feedback
- **Verbos de ação** claros ("Agendar", "Confirmar", "Faturar", "Dar baixa"), não genéricos ("OK").
- Mensagens de erro **acionáveis** ("CPF já cadastrado" > "Erro 400").
- Tom **profissional e cordial**, coerente com o contexto de saúde.

---

Ver também: [Arquitetura do Frontend](01-ARQUITETURA-FRONTEND.md) · [Backlog de Sprints (Frontend)](03-BACKLOG-SPRINTS-FRONTEND.md)
