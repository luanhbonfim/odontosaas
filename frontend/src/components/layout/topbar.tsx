import { useQuery } from '@tanstack/react-query'
import { Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useSessao } from '@/features/auth/use-sessao'
import { useUI } from '@/stores/ui'

import { UserMenu } from './user-menu'

function StatusBackend() {
  const saude = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const resposta = await fetch('/health/ready/')
      if (!resposta.ok) throw new Error('offline')
      return resposta.json() as Promise<{ status: string; db: string }>
    },
    retry: false,
  })

  const cor = saude.isPending
    ? 'bg-muted-foreground'
    : saude.isError
      ? 'bg-destructive'
      : 'bg-success'
  const titulo = saude.isPending
    ? 'Verificando backend…'
    : saude.isError
      ? 'Backend offline'
      : 'Backend conectado'

  return (
    <span
      className={cor + ' inline-block size-2 rounded-full'}
      title={titulo}
      aria-label={titulo}
    />
  )
}

export function Topbar() {
  const sidebarAberta = useUI((estado) => estado.sidebarAberta)
  const alternarSidebar = useUI((estado) => estado.alternarSidebar)
  const { usuario } = useSessao()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2">
        {!sidebarAberta && (
          <Button variant="ghost" size="icon" aria-label="Abrir menu" onClick={alternarSidebar}>
            <Menu />
          </Button>
        )}
        <span className="text-sm font-medium">{usuario?.clinica.nomeFantasia ?? 'Clínica'}</span>
        <StatusBackend />
      </div>
      <UserMenu />
    </header>
  )
}
