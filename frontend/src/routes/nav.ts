import {
  BadgeCheck,
  Calendar,
  ClipboardList,
  DollarSign,
  LayoutDashboard,
  type LucideIcon,
  MessageSquare,
  Package,
  Plug,
  Stethoscope,
  Users,
  UsersRound,
} from 'lucide-react'

import type { Papel } from '@/features/auth/use-sessao'

export type ItemNav = {
  rotulo: string
  para: string
  icone: LucideIcon
  /** Papéis que enxergam o item. Ausente = visível a todos. Espelha a matriz. */
  papeis?: Papel[]
}

/** Um bloco do menu. `titulo` ausente = grupo sem cabeçalho (topo). */
export type GrupoNav = {
  titulo?: string
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
    itens: [{ rotulo: 'Dashboard', para: '/', icone: LayoutDashboard }],
  },
  {
    titulo: 'Atendimento',
    itens: [
      { rotulo: 'Agenda', para: '/agenda', icone: Calendar },
      { rotulo: 'Pacientes', para: '/pacientes', icone: Users },
      { rotulo: 'Dentistas', para: '/dentistas', icone: Stethoscope },
      {
        rotulo: 'Procedimentos',
        para: '/procedimentos',
        icone: ClipboardList,
        papeis: RECEPCAO_MAIS,
      },
    ],
  },
  {
    titulo: 'Financeiro',
    itens: [
      { rotulo: 'Convênios', para: '/convenios', icone: BadgeCheck, papeis: RECEPCAO_MAIS },
      { rotulo: 'Financeiro', para: '/financeiro', icone: DollarSign, papeis: RH },
    ],
  },
  {
    titulo: 'Operação',
    itens: [{ rotulo: 'Estoque', para: '/estoque', icone: Package }],
  },
  {
    titulo: 'Administração',
    itens: [{ rotulo: 'Equipe', para: '/equipe', icone: UsersRound, papeis: RH }],
  },
  {
    titulo: 'Configurações',
    itens: [
      { rotulo: 'Integrações', para: '/integracoes', icone: Plug, papeis: DENTISTA_MAIS },
      {
        rotulo: 'WhatsApp',
        para: '/notificacoes',
        icone: MessageSquare,
        papeis: RECEPCAO_MAIS,
      },
    ],
  },
]

/** Lista achatada (ordem de exibição), útil p/ testes e navegação genérica. */
export const itensNav: ItemNav[] = gruposNav.flatMap((g) => g.itens)

function itemVisivel(item: ItemNav, papel: Papel | null): boolean {
  return !item.papeis || (papel !== null && item.papeis.includes(papel))
}

/** Filtra os itens de menu conforme o papel do usuário (null = ainda carregando). */
export function itensNavPorPapel(papel: Papel | null): ItemNav[] {
  return itensNav.filter((item) => itemVisivel(item, papel))
}

/**
 * Grupos visíveis para o papel: filtra os itens e descarta grupos que ficaram
 * vazios (null = sessão ainda carregando, esconde os restritos).
 */
export function gruposNavPorPapel(papel: Papel | null): GrupoNav[] {
  return gruposNav
    .map((grupo) => ({ ...grupo, itens: grupo.itens.filter((item) => itemVisivel(item, papel)) }))
    .filter((grupo) => grupo.itens.length > 0)
}
