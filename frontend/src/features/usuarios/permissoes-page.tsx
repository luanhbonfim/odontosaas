import { Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ErroApi } from '@/lib/api/client'

import {
  type CelulaPermissao,
  type PapelCustomizavel,
  usePermissoesModulo,
  useSalvarPermissoesModulo,
} from './use-permissoes'

const PAPEIS: { valor: PapelCustomizavel; rotulo: string }[] = [
  { valor: 'RECEPCAO', rotulo: 'Recepção' },
  { valor: 'DENTISTA', rotulo: 'Dentista' },
]

const MODULOS: { valor: string; rotulo: string }[] = [
  { valor: 'agenda', rotulo: 'Agenda' },
  { valor: 'pacientes', rotulo: 'Pacientes' },
  { valor: 'convenios', rotulo: 'Convênios' },
  { valor: 'dentistas', rotulo: 'Dentistas' },
  { valor: 'procedimentos', rotulo: 'Procedimentos' },
  { valor: 'estoque', rotulo: 'Estoque' },
  { valor: 'financeiro', rotulo: 'Financeiro' },
  { valor: 'notificacoes', rotulo: 'WhatsApp' },
  { valor: 'usuarios', rotulo: 'Equipe' },
]

const COLUNAS: { campo: 'ver' | 'criar' | 'editar' | 'excluir'; rotulo: string }[] = [
  { campo: 'ver', rotulo: 'Ver' },
  { campo: 'criar', rotulo: 'Criar' },
  { campo: 'editar', rotulo: 'Editar' },
  { campo: 'excluir', rotulo: 'Excluir' },
]

function TabelaPapel({
  papel,
  rotulo,
  grade,
  aoMudar,
}: {
  papel: PapelCustomizavel
  rotulo: string
  grade: CelulaPermissao[]
  aoMudar: (modulo: string, campo: 'ver' | 'criar' | 'editar' | 'excluir', valor: boolean) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{rotulo}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tela</TableHead>
              {COLUNAS.map((c) => (
                <TableHead key={c.campo} className="text-center">
                  {c.rotulo}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {MODULOS.map((modulo) => {
              const celula = grade.find((c) => c.papel === papel && c.modulo === modulo.valor)
              if (!celula) return null
              return (
                <TableRow key={modulo.valor}>
                  <TableCell className="font-medium">{modulo.rotulo}</TableCell>
                  {COLUNAS.map((c) => (
                    <TableCell key={c.campo} className="text-center">
                      <input
                        type="checkbox"
                        aria-label={`${rotulo} — ${modulo.rotulo} — ${c.rotulo}`}
                        className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                        checked={celula[c.campo]}
                        disabled={c.campo !== 'ver' && !celula.ver}
                        onChange={(e) => aoMudar(modulo.valor, c.campo, e.target.checked)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function PermissoesPage() {
  const { data, isLoading, isError } = usePermissoesModulo()
  const salvar = useSalvarPermissoesModulo()
  const [grade, setGrade] = useState<CelulaPermissao[] | null>(null)

  useEffect(() => {
    if (data) setGrade(data)
  }, [data])

  function aoMudar(
    papel: PapelCustomizavel,
    modulo: string,
    campo: 'ver' | 'criar' | 'editar' | 'excluir',
    valor: boolean,
  ) {
    setGrade((atual) =>
      (atual ?? []).map((celula) => {
        if (celula.papel !== papel || celula.modulo !== modulo) return celula
        // Sem "ver" não faz sentido ter criar/editar/excluir marcados.
        if (campo === 'ver' && !valor) {
          return { ...celula, ver: false, criar: false, editar: false, excluir: false }
        }
        return { ...celula, [campo]: valor }
      }),
    )
  }

  async function salvarGrade() {
    if (!grade) return
    try {
      await salvar.mutateAsync(grade)
      toast.success('Permissões salvas.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível salvar as permissões.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Permissões"
        descricao='Defina quais telas a Recepção e o Dentista enxergam e o que podem fazer em cada uma. Gerente e Admin sempre têm acesso total.'
      />

      {isError ? (
        <EmptyState
          icone={Lock}
          titulo="Acesso restrito"
          descricao="Só Gerente ou Admin podem configurar permissões."
        />
      ) : isLoading || !grade ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {PAPEIS.map((p) => (
              <TabelaPapel
                key={p.valor}
                papel={p.valor}
                rotulo={p.rotulo}
                grade={grade}
                aoMudar={(modulo, campo, valor) => aoMudar(p.valor, modulo, campo, valor)}
              />
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={salvarGrade} disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
