import {
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  Boxes,
  Calendar,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  Layers,
  type LucideIcon,
  MessageSquare,
  Package,
  PieChart,
  Plug,
  Settings,
  Shield,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react'

import type { ModulosAtivos, Papel } from '@/features/auth/use-sessao'

export type ModuloRecurso = 'google_calendar' | 'whatsapp' | 'financeiro' | 'estoque'

export type ItemNav = {
  rotulo: string
  para: string
  icone: LucideIcon
  /** Papéis que enxergam o item. Ausente = visível a todos. Espelha a matriz. */
  papeis?: Papel[]
  /** Módulo do SaaS atrelado ao item. Se desabilitado no plano, oculta o menu. */
  modulo?: ModuloRecurso
  /** Match exato da rota (para pais que têm sub-rotas, ex.: /financeiro). */
  end?: boolean
}

/** Um bloco do menu. `titulo` ausente = grupo sem cabeçalho (link direto no topo). */
export type GrupoNav = {
  titulo?: string
  /** Ícone do módulo (cabeçalho recolhível). */
  icone?: LucideIcon
  itens: ItemNav[]
}

const RH = ['DENTISTA_GERENTE', 'ADMIN'] satisfies Papel[]
const RECEPCAO_MAIS = ['RECEPCAO', 'DENTISTA_GERENTE', 'ADMIN'] satisfies Papel[]
// Integrações: cada dentista vê a SUA; gerente/admin veem todas (backend escopa).
const DENTISTA_MAIS = ['DENTISTA', 'DENTISTA_GERENTE', 'ADMIN'] satisfies Papel[]

// Menu agrupado por semântica: visão geral, atendimento clínico, financeiro,
// operação e administração. Espelha a matriz de permissões (papeis por item).
export const gruposNav: GrupoNav[] = [
  {
    itens: [{ rotulo: 'Dashboard', para: '/dashboard', icone: LayoutDashboard }],
  },
  {
    titulo: 'Atendimento',
    icone: HeartPulse,
    itens: [
      { rotulo: 'Agenda', para: '/agenda', icone: Calendar },
      { rotulo: 'Pacientes', para: '/pacientes', icone: Users },
      { rotulo: 'Convênios', para: '/convenios', icone: BadgeCheck, papeis: RECEPCAO_MAIS },
      { rotulo: 'Dentistas', para: '/dentistas', icone: Stethoscope },
      {
        rotulo: 'Procedimentos',
        para: '/procedimentos',
        icone: ClipboardList,
      },
    ],
  },
  {
    titulo: 'Financeiro',
    icone: Wallet,
    itens: [
      {
        rotulo: 'Visão Geral',
        para: '/financeiro',
        icone: PieChart,
        papeis: RH,
        modulo: 'financeiro',
        end: true,
      },
      {
        rotulo: 'Contas a Receber',
        para: '/financeiro/receber',
        icone: TrendingUp,
        papeis: RH,
        modulo: 'financeiro',
      },
      {
        rotulo: 'Contas a Pagar',
        para: '/financeiro/pagar',
        icone: TrendingDown,
        papeis: RH,
        modulo: 'financeiro',
      },
    ],
  },
  {
    titulo: 'Operação',
    icone: Boxes,
    itens: [
      { rotulo: 'Insumos', para: '/estoque', icone: Package, modulo: 'estoque', end: true },
      { rotulo: 'Categorias', para: '/estoque/categorias', icone: Layers, modulo: 'estoque' },
      {
        rotulo: 'Movimentações',
        para: '/estoque/movimentacoes',
        icone: ArrowLeftRight,
        modulo: 'estoque',
      },
      { rotulo: 'Fornecedores', para: '/estoque/fornecedores', icone: Truck, modulo: 'estoque' },
      { rotulo: 'Alertas', para: '/estoque/alertas', icone: AlertTriangle, modulo: 'estoque' },
    ],
  },
  {
    titulo: 'Administração',
    icone: Shield,
    itens: [{ rotulo: 'Equipe', para: '/equipe', icone: UsersRound, papeis: RH }],
  },
  {
    titulo: 'Configurações',
    icone: Settings,
    itens: [
      {
        rotulo: 'Integrações',
        para: '/integracoes',
        icone: Plug,
        papeis: DENTISTA_MAIS,
        modulo: 'google_calendar',
      },
      {
        rotulo: 'WhatsApp',
        para: '/notificacoes',
        icone: MessageSquare,
        papeis: RECEPCAO_MAIS,
        modulo: 'whatsapp',
      },
      {
        rotulo: 'Meu Plano',
        para: '/meu-plano',
        icone: Sparkles,
        papeis: RH,
      },
    ],
  },
]

/** Lista achatada (ordem de exibição), útil p/ testes e navegação genérica. */
export const itensNav: ItemNav[] = gruposNav.flatMap((g) => g.itens)

function itemVisivel(
  item: ItemNav,
  papel: Papel | null,
  modulos?: ModulosAtivos,
): boolean {
  if (item.papeis && (papel === null || !item.papeis.includes(papel))) {
    return false
  }

  if (item.modulo && modulos) {
    let habilitado: boolean | undefined = modulos[item.modulo]
    if (habilitado === undefined) {
      if (item.modulo === 'google_calendar') habilitado = modulos.sync_google
      if (item.modulo === 'whatsapp') habilitado = modulos.whatsapp_waha
    }
    if (habilitado === false) {
      return false
    }
  }

  return true
}

/** Filtra os itens de menu conforme o papel do usuário e módulos habilitados. */
export function itensNavPorPapel(
  papel: Papel | null,
  modulos?: ModulosAtivos,
): ItemNav[] {
  return itensNav.filter((item) => itemVisivel(item, papel, modulos))
}

/**
 * Grupos visíveis para o papel e módulos ativos: filtra os itens e descarta grupos que ficaram vazios.
 */
export function gruposNavPorPapel(
  papel: Papel | null,
  modulos?: ModulosAtivos,
): GrupoNav[] {
  return gruposNav
    .map((grupo) => ({
      ...grupo,
      itens: grupo.itens.filter((item) => itemVisivel(item, papel, modulos)),
    }))
    .filter((grupo) => grupo.itens.length > 0)
}
