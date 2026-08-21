import { LogOut, Moon, Sun, User, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTema } from '@/stores/tema'
import { useVendorAuth } from './use-vendor-auth'

export function VendorUserMenu() {
  const { operador, sair } = useVendorAuth()
  const tema = useTema((estado) => estado.tema)
  const alternarTema = useTema((estado) => estado.alternar)

  const nome = operador?.nome || operador?.email || 'Operador'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 px-3 py-1.5 h-9 rounded-lg bg-[#111D3B] border border-[#1E2D56] text-white hover:bg-[#182952] hover:border-[#D4AF37]/50 hover:text-white transition-all cursor-pointer shadow-xs"
          aria-label="Menu do operador"
        >
          <span className="grid size-6 place-items-center rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] shrink-0">
            <User className="size-3.5" />
          </span>
          <span className="hidden max-w-44 truncate sm:inline font-medium text-xs text-slate-100">
            {nome}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 bg-[#111D3B] border-[#1E2D56] text-slate-100 shadow-2xl p-1">
        <DropdownMenuLabel className="flex flex-col gap-0.5 p-2">
          <div className="flex items-center gap-1.5 font-semibold text-white text-xs">
            <ShieldCheck className="size-4 text-[#D4AF37]" />
            <span className="truncate">{nome}</span>
          </div>
          {operador?.email && (
            <span className="truncate text-[11px] font-normal text-slate-400">
              {operador.email}
            </span>
          )}
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="w-fit rounded bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 px-1.5 py-0.5 text-[10px] font-bold">
              {operador?.is_superuser ? 'SuperAdmin' : 'Staff Vendor'}
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-[#1E2D56]" />

        <DropdownMenuItem
          onSelect={() => alternarTema()}
          className="text-xs text-slate-300 hover:text-white hover:bg-[#182952] focus:bg-[#182952] focus:text-white cursor-pointer rounded-md px-2 py-1.5"
        >
          {tema === 'escuro' ? <Sun className="size-3.5 mr-2 text-[#D4AF37]" /> : <Moon className="size-3.5 mr-2 text-[#D4AF37]" />}
          {tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-[#1E2D56]" />

        <DropdownMenuItem
          variant="destructive"
          onSelect={() => sair()}
          className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 focus:bg-red-950/40 focus:text-red-300 cursor-pointer rounded-md px-2 py-1.5"
        >
          <LogOut className="size-3.5 mr-2 text-red-400" />
          Sair do Console
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
