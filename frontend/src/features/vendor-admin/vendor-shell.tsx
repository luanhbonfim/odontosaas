import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Package,
  KeyRound,
  Database,
  Clock,
  ScrollText,
  SlidersHorizontal,
  ShieldCheck,
  Menu,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ehDesktop, useUI } from '@/stores/ui'
import { VENDOR_BASE_PATH } from './constants'
import { VendorUserMenu } from './vendor-user-menu'

// Marca do produto
const NOME_SAAS = 'PróClínica'
const ASSINATURA = 'Admin da Plataforma'

// Dente (coroa + duas raízes) com contorno dourado idêntico à sidebar da clínica
const CAMINHO_DENTE =
  'M16 4C11 4 7.5 6.8 7.5 11c0 2.6.7 4.6 1.6 8.2.6 2.4 1 5.3 1.7 6.6.4.8 1 1.2 1.6 1.2 ' +
  '1.2 0 1.6-1.6 2-4.2.3-2 .8-3.4 1.6-3.4s1.3 1.4 1.6 3.4c.4 2.6.8 4.2 2 4.2.6 0 1.2-.4 ' +
  '1.6-1.2.7-1.3 1.1-4.2 1.7-6.6.9-3.6 1.6-5.6 1.6-8.2C24.5 6.8 21 4 16 4Z'
const BRILHO_DENTE = 'M11.4 9.8c.9-1 2.3-1.7 4.1-1.8'

const GRUPOS_NAV = [
  {
    titulo: 'Visão Geral',
    itens: [
      {
        rotulo: 'Dashboard',
        icone: LayoutDashboard,
        para: VENDOR_BASE_PATH,
        fim: true,
      },
    ],
  },
  {
    titulo: 'Gestão Multi-Tenant',
    itens: [
      {
        rotulo: 'Clínicas / Tenants',
        icone: Building2,
        para: `${VENDOR_BASE_PATH}/tenants`,
      },
      {
        rotulo: 'Planos de Assinatura',
        icone: Package,
        para: `${VENDOR_BASE_PATH}/planos`,
      },
      {
        rotulo: 'Acesso Master Global',
        icone: KeyRound,
        para: `${VENDOR_BASE_PATH}/admin-master`,
      },
    ],
  },
  {
    titulo: 'Infraestrutura & Automação',
    itens: [
      {
        rotulo: 'Database Studio',
        icone: Database,
        para: `${VENDOR_BASE_PATH}/studio`,
      },
      {
        rotulo: 'Celery Beat & Filas',
        icone: Clock,
        para: `${VENDOR_BASE_PATH}/celery`,
      },
      {
        rotulo: 'Trilha de Auditoria',
        icone: ScrollText,
        para: `${VENDOR_BASE_PATH}/auditoria`,
      },
      {
        rotulo: 'Config. de Login',
        icone: SlidersHorizontal,
        para: `${VENDOR_BASE_PATH}/configuracoes`,
      },
      {
        rotulo: 'Autenticação 2FA',
        icone: ShieldCheck,
        para: `${VENDOR_BASE_PATH}/seguranca-2fa`,
      },
    ],
  },
]

export function VendorShell() {
  const sidebarAberta = useUI((estado) => estado.sidebarAberta)
  const alternarSidebar = useUI((estado) => estado.alternarSidebar)
  const fecharSidebar = useUI((estado) => estado.fecharSidebar)
  const location = useLocation()

  // Define o nome da aba do navegador para "Admin - PróClínica"
  useEffect(() => {
    document.title = 'Admin - PróClínica'
  }, [])

  function aoNavegar() {
    if (!ehDesktop()) fecharSidebar()
  }

  return (
    <div className="dark min-h-svh bg-[#0B132B] text-slate-100 antialiased selection:bg-[#D4AF37] selection:text-slate-950">
      {/* Backdrop mobile com fade suave */}
      <button
        type="button"
        aria-label="Fechar menu"
        tabIndex={sidebarAberta ? 0 : -1}
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-300 md:hidden',
          sidebarAberta ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={fecharSidebar}
      />

      {/* Sidebar com animação de slide suave idêntica à aplicação dos tenants */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#1C2C54] bg-[#0F1B38] text-slate-100',
          'transition-transform duration-300 ease-in-out will-change-transform',
          sidebarAberta ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Header da Sidebar com Dente Dourado e botão de toggle */}
        <div className="flex h-16 items-center gap-2.5 border-b border-[#1C2C54] px-4 bg-[#0B132B]/60">
          <svg
            viewBox="0 0 32 32"
            className="size-7 shrink-0"
            fill="none"
            stroke="#D4AF37"
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d={CAMINHO_DENTE} />
            <path d={BRILHO_DENTE} strokeWidth={1.3} opacity={0.6} />
          </svg>
          <div className="min-w-0">
            <span className="block truncate text-base font-bold tracking-tight text-white">
              {NOME_SAAS}
            </span>
            <span className="block text-[11px] font-semibold text-[#D4AF37]">
              [PAINEL DA PLATAFORMA]
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto shrink-0 text-slate-400 hover:text-white"
            aria-label="Fechar menu"
            onClick={alternarSidebar}
          >
            <Menu className="size-4" />
          </Button>
        </div>

        {/* Navegação estruturada em grupos com tema Dark Navy */}
        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {GRUPOS_NAV.map((grupo, i) => (
            <div key={grupo.titulo ?? `grupo-${i}`} className="space-y-1">
              {grupo.titulo && (
                <p className="px-3 pt-1 pb-0.5 text-[11px] font-semibold tracking-wide text-slate-400/80 uppercase">
                  {grupo.titulo}
                </p>
              )}
              {grupo.itens.map((item) => {
                const fim = 'fim' in item ? Boolean(item.fim) : false
                const ativo = fim
                  ? location.pathname === item.para
                  : location.pathname.startsWith(item.para)

                return (
                  <NavLink
                    key={item.para}
                    to={item.para}
                    onClick={aoNavegar}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      ativo
                        ? 'bg-[#19294F] text-white font-semibold shadow-xs'
                        : 'text-slate-400 hover:bg-[#152345] hover:text-slate-100',
                    )}
                  >
                    <item.icone className={cn('size-4', ativo ? 'text-[#D4AF37]' : 'text-slate-400')} />
                    {item.rotulo}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Rodapé da Sidebar */}
        <div className="border-t border-[#1C2C54] px-4 py-3 bg-[#0B132B]/40">
          <p className="text-sm font-semibold text-slate-200">{NOME_SAAS}</p>
          <p className="text-xs text-slate-400">{ASSINATURA}</p>
        </div>
      </aside>

      {/* Conteúdo com transição suave de margem deslizante */}
      <div
        className={cn(
          'flex min-h-svh flex-col transition-[margin-left] duration-300 ease-in-out',
          sidebarAberta ? 'md:ml-64' : 'md:ml-0',
        )}
      >
        {/* Topbar Dark Navy com botão Menu e UserMenu */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#1C2C54] bg-[#0B132B]/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2">
            {!sidebarAberta && (
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-300 hover:text-white cursor-pointer"
                aria-label="Abrir menu"
                onClick={alternarSidebar}
              >
                <Menu className="size-5" />
              </Button>
            )}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-[#D4AF37]">Admin Global</span>
              <span>&bull;</span>
              <span>Governança Multi-Tenant</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <VendorUserMenu />
          </div>
        </header>

        {/* Dynamic Page Outlet */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-[#0B132B]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
