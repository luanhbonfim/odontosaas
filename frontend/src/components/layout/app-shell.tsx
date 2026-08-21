import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Clock, ShieldAlert, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useUI } from '@/stores/ui'
import { tokenStore } from '@/lib/api/token-store'
import { api } from '@/lib/api/client'
import { queryClient } from '@/lib/api/query-client'
import { Button } from '@/components/ui/button'
import { useMeuPlano } from '@/features/plano/use-meu-plano'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

export function AppShell() {
  const sidebarAberta = useUI((estado) => estado.sidebarAberta)
  const isImpersonate = tokenStore.is_impersonate
  const operadorEmail = tokenStore.impersonated_by || 'Operador de Suporte'

  const { data: meuPlano } = useMeuPlano()
  const [avisoVencimentoDismissed, setAvisoVencimentoDismissed] = useState(false)

  const diasRestantes = meuPlano?.status?.dias_restantes
  const isVencimentoProximo =
    !avisoVencimentoDismissed &&
    diasRestantes !== null &&
    diasRestantes !== undefined &&
    diasRestantes <= 15 &&
    diasRestantes >= 0

  async function encerrarSuporte() {
    try {
      await api.post('/auth/encerrar-suporte/')
    } catch {
      // Ignora erro de rede/fallback
    }
    tokenStore.limpar()
    queryClient.clear()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Banner Superior Fixo de Suporte Read-Only */}
      {isImpersonate && (
        <div className="sticky top-0 z-[70] flex items-center justify-between border-b border-amber-500/40 bg-amber-950/90 px-4 py-2 text-xs text-amber-200 backdrop-blur-md shadow-md">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-amber-400 shrink-0 animate-pulse" />
            <span>
              <strong className="text-amber-100 uppercase tracking-wide">Modo Suporte (Read-Only)</strong> &bull;{' '}
              Operador: <span className="font-mono text-white">{operadorEmail}</span> &bull;{' '}
              <span className="text-amber-300">Mutações de escrita (POST/PUT/DELETE) estão bloqueadas no servidor.</span>
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={encerrarSuporte}
            className="h-7 text-xs border-amber-500/50 bg-amber-900/40 text-amber-100 hover:bg-amber-800/60 hover:text-white"
          >
            <X className="size-3 mr-1" />
            Encerrar Suporte
          </Button>
        </div>
      )}

      {/* Banner Superior Discreto de Vencimento Próximo (Fica sobre o menu lateral com z-[60]) */}
      {isVencimentoProximo && (
        <div className="sticky top-0 z-[60] flex items-center justify-between border-b border-amber-500/40 bg-amber-500/20 px-4 py-2 text-xs text-amber-950 dark:text-amber-100 backdrop-blur-md shadow-xs">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
            <span>
              <strong className="font-semibold text-amber-950 dark:text-amber-100">Atenção:</strong> A vigência do seu plano{' '}
              <span className="font-bold underline">
                {diasRestantes === 0 ? 'expira hoje' : diasRestantes === 1 ? 'expira amanhã' : `expira em ${diasRestantes} dias`}
              </span>{' '}
              ({meuPlano?.status?.vigencia_fim ? new Date(`${meuPlano.status.vigencia_fim.split('T')[0]}T12:00:00`).toLocaleDateString('pt-BR') : ''}).{' '}
              <Link to="/meu-plano" className="font-semibold underline ml-1 hover:text-amber-950 dark:hover:text-white">
                Ver detalhes e renovar &rarr;
              </Link>
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setAvisoVencimentoDismissed(true)}
            className="size-6 text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-white"
            title="Fechar aviso temporariamente"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      <Sidebar />
      {/* O conteúdo desliza junto animando margin-left (o sidebar em si usa
          transform/GPU). Só no desktop; no mobile o sidebar sobrepõe. */}
      <div
        className={cn(
          'flex min-h-svh flex-col transition-[margin-left] duration-300 ease-in-out',
          sidebarAberta ? 'md:ml-64' : 'md:ml-0',
        )}
      >
        <Topbar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
