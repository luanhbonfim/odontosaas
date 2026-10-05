import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useSessao } from '@/features/auth/use-sessao'
import { cn } from '@/lib/utils'

import { useCotaPacientes } from './use-pacientes'

/** Aviso da cota de pacientes ativos do plano: próximo do limite (>= 90%) ou esgotada.
 * Só gerente/admin enxergam a tela do plano; os demais recebem a orientação de falar com eles. */
export function AvisoLimitePacientes() {
  const { data: cota } = useCotaPacientes()
  const { usuario } = useSessao()
  if (!cota || cota.ilimitado || !(cota.atingiu_limite || cota.proximo_do_limite)) return null

  const podeVerPlano = usuario?.papel === 'ADMIN' || usuario?.papel === 'DENTISTA_GERENTE'
  const esgotado = cota.atingiu_limite

  return (
    <div
      role={esgotado ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 text-sm',
        esgotado
          ? 'border-destructive/40 bg-destructive/10 text-foreground'
          : 'border-amber-500/40 bg-amber-500/10 text-foreground',
      )}
    >
      <AlertTriangle
        className={cn('mt-0.5 size-4 shrink-0', esgotado ? 'text-destructive' : 'text-amber-600')}
        aria-hidden="true"
      />
      <p>
        <strong>
          {cota.atual} de {cota.limite} pacientes ativos.
        </strong>{' '}
        {esgotado
          ? 'O limite do plano foi atingido: não é possível cadastrar nem reativar pacientes. Inative quem não frequenta mais'
          : 'Você está perto do limite do plano. Inativar pacientes que não frequentam mais libera vagas'}
        {podeVerPlano ? (
          <>
            {' '}
            ou{' '}
            <Link to="/meu-plano" className="font-medium underline">
              veja as opções de upgrade
            </Link>
            .
          </>
        ) : (
          ' ou peça ao gerente da clínica para ampliar o plano.'
        )}
      </p>
    </div>
  )
}
