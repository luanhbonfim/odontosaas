import { LogOut, Moon, Settings, Sun, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/use-auth'
import { useSessao } from '@/features/auth/use-sessao'
import { useTema } from '@/stores/tema'

export function UserMenu() {
  const { usuario } = useSessao()
  const { sair } = useAuth()
  const navegar = useNavigate()
  const tema = useTema((estado) => estado.tema)
  const alternarTema = useTema((estado) => estado.alternar)

  const nome = usuario?.nomeCompleto || usuario?.email || 'Usuário'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" aria-label="Menu do usuário">
          <span className="grid size-7 place-items-center rounded-full bg-accent text-accent-foreground">
            <User className="size-4" />
          </span>
          <span className="hidden max-w-40 truncate sm:inline">{nome}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{nome}</span>
          {usuario?.email && (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {usuario.email}
            </span>
          )}
          {usuario?.papelExibicao && (
            <span className="mt-1 w-fit rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
              {usuario.papelExibicao}
            </span>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navegar('/minha-conta')}>
          <Settings />
          Minha conta
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => alternarTema()}>
          {tema === 'escuro' ? <Sun /> : <Moon />}
          {tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => sair()}>
          <LogOut />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
