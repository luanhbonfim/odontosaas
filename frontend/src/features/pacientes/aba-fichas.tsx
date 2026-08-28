import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { DateText, DateTime } from '@/components/common/formato'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

import type { ProcedimentoDente } from './odontograma'
import { useFichasDoPaciente } from './use-paciente-detalhe'

export function AbaFichas({ pacienteId }: { pacienteId: number }) {
  const { data, isLoading } = useFichasDoPaciente(pacienteId)
  const fichas = data ?? []

  return (
    <div className="space-y-4">
      <div className="flex">
        <Button asChild size="sm" className="w-full sm:ml-auto sm:w-auto">
          <Link to={`/pacientes/${pacienteId}/fichas/nova`}>
            <Plus /> Nova ficha
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : fichas.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma ficha registrada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {fichas.map((f) => {
            const dentes = (f.dentes as ProcedimentoDente[] | undefined) ?? []
            const qtdDentes = dentes.filter((d) => d.dente > 0).length
            return (
              <Card key={f.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      <DateText iso={f.criado_em} />
                      {f.consulta ? (
                        <>
                          {' · Consulta em '}
                          <DateTime iso={f.consulta_inicio} />
                          {f.consulta_dentista_nome ? ` · ${f.consulta_dentista_nome}` : ''}
                        </>
                      ) : (
                        ' · Ficha avulsa'
                      )}
                    </span>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/pacientes/${pacienteId}/fichas/${f.id}`}>Abrir</Link>
                    </Button>
                  </div>
                  <p className="text-sm">
                    {qtdDentes > 0
                      ? `${qtdDentes} dente(s) tratado(s).`
                      : 'Odontograma ainda não preenchido.'}
                  </p>
                  {f.anotacoes && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{f.anotacoes}</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
