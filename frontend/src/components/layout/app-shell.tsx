import { Outlet } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { useUI } from '@/stores/ui'

import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

export function AppShell() {
  const sidebarAberta = useUI((estado) => estado.sidebarAberta)

  return (
    <div className="min-h-svh bg-background text-foreground">
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
