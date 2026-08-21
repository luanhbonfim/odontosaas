import { Menu } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useSessao } from '@/features/auth/use-sessao'
import { cn } from '@/lib/utils'
import { gruposNavPorPapel } from '@/routes/nav'
import { ehDesktop, useUI } from '@/stores/ui'

// Marca do produto (SaaS) exibida no rodapé do menu.
const NOME_SAAS = 'PróClínica'
const ASSINATURA = 'By Bytefim'
// Dente (coroa + duas raízes) — ícone da marca no header. viewBox 0 0 32 32.
const CAMINHO_DENTE =
  'M16 4C11 4 7.5 6.8 7.5 11c0 2.6.7 4.6 1.6 8.2.6 2.4 1 5.3 1.7 6.6.4.8 1 1.2 1.6 1.2 ' +
  '1.2 0 1.6-1.6 2-4.2.3-2 .8-3.4 1.6-3.4s1.3 1.4 1.6 3.4c.4 2.6.8 4.2 2 4.2.6 0 1.2-.4 ' +
  '1.6-1.2.7-1.3 1.1-4.2 1.7-6.6.9-3.6 1.6-5.6 1.6-8.2C24.5 6.8 21 4 16 4Z'
// Brilho sutil na coroa.
const BRILHO_DENTE = 'M11.4 9.8c.9-1 2.3-1.7 4.1-1.8'

export function Sidebar() {
  const sidebarAberta = useUI((estado) => estado.sidebarAberta)
  const alternarSidebar = useUI((estado) => estado.alternarSidebar)
  const fecharSidebar = useUI((estado) => estado.fecharSidebar)
  const { usuario } = useSessao()

  // Menu agrupado por seção conforme o papel e módulos ativos do plano;
  // enquanto carrega, oculta os módulos restritos ou desabilitados.
  const grupos = gruposNavPorPapel(usuario?.papel ?? null, usuario?.clinica?.modulos)

  // No mobile, clicar num item fecha o drawer; no desktop mantém o menu aberto.
  function aoNavegar() {
    if (!ehDesktop()) fecharSidebar()
  }

  return (
    <>
      {/* Backdrop com fade: apenas mobile, some quando o drawer fecha. */}
      <button
        type="button"
        aria-label="Fechar menu"
        tabIndex={sidebarAberta ? 0 : -1}
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden',
          sidebarAberta ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={fecharSidebar}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground',
          'transition-transform duration-300 ease-in-out will-change-transform',
          sidebarAberta ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b px-4">
          {/* Marca: dente com contorno dourado (sem fundo) + nome da clínica. */}
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
          <span className="min-w-0 truncate text-base font-bold tracking-tight text-foreground">
            {usuario?.clinica?.nomeFantasia ?? 'Clínica'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto shrink-0"
            aria-label="Fechar menu"
            onClick={alternarSidebar}
          >
            <Menu />
          </Button>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {grupos.map((grupo, i) => (
            <div key={grupo.titulo ?? `grupo-${i}`} className="space-y-1">
              {grupo.titulo && (
                <p className="px-3 pt-1 pb-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                  {grupo.titulo}
                </p>
              )}
              {grupo.itens.map((item) => (
                <NavLink
                  key={item.para}
                  to={item.para}
                  end={item.para === '/'}
                  onClick={aoNavegar}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                    )
                  }
                >
                  <item.icone className="size-4" />
                  {item.rotulo}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Rodapé: marca do SaaS. */}
        <div className="border-t px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{NOME_SAAS}</p>
          <p className="text-xs text-muted-foreground">{ASSINATURA}</p>
        </div>
      </aside>
    </>
  )
}
