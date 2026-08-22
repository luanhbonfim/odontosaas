import { ShieldAlert } from 'lucide-react'

/**
 * Exibida quando o host atual NÃO resolve para uma clínica válida
 * (`/api/tenant-atual/` retorna 404 — subdomínio inexistente, clínica removida
 * ou ainda não provisionada). Terminal e SEM navegação automática, para não
 * reentrar no ciclo de redirecionamento dos guards de rota.
 */
export function ClinicaNaoEncontradaPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 text-center text-foreground p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="mx-auto flex size-20 items-center justify-center rounded-3xl border border-border bg-card shadow-xl p-4">
          <ShieldAlert className="size-10 text-[#D4AF37]" />
        </div>
        <div className="space-y-2">
          <p className="font-mono text-sm font-semibold uppercase tracking-widest text-[#D4AF37]">
            404 | Clínica não encontrada
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Este endereço não está disponível
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            O endereço acessado não corresponde a nenhuma clínica ativa. Verifique o
            subdomínio ou entre em contato com o suporte da plataforma.
          </p>
        </div>
      </div>
    </div>
  )
}
