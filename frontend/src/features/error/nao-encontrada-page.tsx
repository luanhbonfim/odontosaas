import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Home, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useClinicaAtual } from '@/features/auth/use-clinica-atual'

export function NaoEncontradaPage() {
  const navigate = useNavigate()
  const { data: infoClinica } = useClinicaAtual()
  const ehPublico = infoClinica?.is_public ?? true

  const rotaInicio = ehPublico ? '/' : '/dashboard'

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 text-center text-foreground p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="mx-auto flex size-20 items-center justify-center rounded-3xl border border-border bg-card shadow-xl p-4">
          <ShieldAlert className="size-10 text-[#D4AF37]" />
        </div>

        <div className="space-y-2">
          <p className="font-mono text-sm font-semibold uppercase tracking-widest text-[#D4AF37]">
            404 | Não Encontrado
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Página Não Encontrada
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            O endereço ou endpoint que você tentou acessar não existe, foi removido ou não está disponível.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto gap-2 border-border"
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Button>

          <Button
            asChild
            className="w-full sm:w-auto gap-2 bg-[#0F1B38] text-white hover:bg-[#1C2C54] dark:bg-[#D4AF37] dark:text-black dark:hover:bg-[#C29D26]"
          >
            <Link to={rotaInicio}>
              <Home className="size-4" />
              Página Inicial
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
