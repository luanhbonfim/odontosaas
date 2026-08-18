import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { DataTable } from '@/components/common/data-table'
import { EmptyState } from '@/components/common/empty-state'
import { DateTime } from '@/components/common/formato'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDentistas } from '@/features/dentistas/use-dentistas'
import { cn } from '@/lib/utils'

import { AbaAnamneses } from './aba-anamneses'
import { AbaDados } from './aba-dados'
import { AbaGuias } from './aba-guias'
import { AbaPlanos } from './aba-planos'
import type { ProcedimentoDente } from './odontograma'
import { BadgeCobranca, BadgeStatus } from './status'
import { type Consulta, useConsultasDoPaciente, usePaciente } from './use-paciente-detalhe'

const vazio = <span className="text-muted-foreground">—</span>

const classeFiltro = cn(
  'h-9 cursor-pointer rounded-md border bg-transparent px-3 text-sm',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
)

/** Rótulo legível de um status (STATUS_X -> "Status x"). */
function rotuloStatus(valor: string): string {
  const texto = valor.replace(/_/g, ' ').toLowerCase()
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Placeholder das abas de relações enquanto o paciente ainda não foi salvo. */
function AvisoSalvarPrimeiro() {
  return (
    <Card>
      <CardContent className="p-6 text-center text-sm text-muted-foreground">
        Salve o paciente primeiro para adicionar registros nesta seção.
      </CardContent>
    </Card>
  )
}

/** Dentes tratados na consulta: números resumidos (detalhe no hover) ou aviso. */
function CelulaDentes({ dentes }: { dentes: unknown }) {
  const lista = (dentes as ProcedimentoDente[] | undefined) ?? []
  const itens = lista.filter((d) => d.dente > 0)
  if (itens.length === 0) {
    return (
      <span className="text-xs font-medium text-amber-600 dark:text-amber-500">
        Ficha não preenchida
      </span>
    )
  }
  const numeros = itens.map((d) => d.dente)
  const detalhe = itens
    .map((d) => `Dente ${d.dente}${d.procedimento ? `: ${d.procedimento}` : ''}`)
    .join('\n')
  const visiveis = numeros.slice(0, 4).join(', ')
  const resto = numeros.length - 4
  return (
    <span title={detalhe} className="cursor-default tabular-nums">
      {visiveis}
      {resto > 0 && <span className="text-muted-foreground"> +{resto}</span>}
    </span>
  )
}

// --- Aba: Consultas ---
function AbaConsultas({ pacienteId }: { pacienteId: number }) {
  const { data, isLoading } = useConsultasDoPaciente(pacienteId)
  const { data: dentistas } = useDentistas()
  const nomePorDentista = useMemo(
    () => new Map((dentistas ?? []).map((d) => [d.id, d.nome_completo])),
    [dentistas],
  )

  const consultas = useMemo(() => data ?? [], [data])
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroConfirmacao, setFiltroConfirmacao] = useState('')
  const [filtroCobranca, setFiltroCobranca] = useState('')

  // Opções dos filtros derivadas dos dados presentes.
  const statusDisponiveis = useMemo(
    () => [...new Set(consultas.map((c) => c.status).filter(Boolean) as string[])],
    [consultas],
  )
  const confirmacoesDisponiveis = useMemo(
    () => [...new Set(consultas.map((c) => c.status_confirmacao).filter(Boolean) as string[])],
    [consultas],
  )

  const filtradas = useMemo(
    () =>
      consultas.filter(
        (c) =>
          (!filtroStatus || c.status === filtroStatus) &&
          (!filtroConfirmacao || c.status_confirmacao === filtroConfirmacao) &&
          (!filtroCobranca ||
            (filtroCobranca === 'convenio' ? Boolean(c.convenio_nome) : !c.convenio_nome)),
      ),
    [consultas, filtroStatus, filtroConfirmacao, filtroCobranca],
  )

  // Colunas ordenáveis (accessorFn) — como nas guias; a de dentes é só exibição.
  const colunas: ColumnDef<Consulta, unknown>[] = [
    {
      id: 'procedimento',
      header: 'Procedimento',
      accessorFn: (c) => c.procedimento_catalogo_nome ?? c.procedimento ?? '',
      // Clicável abre a ficha (odontograma + anotações). Canceladas/faltou não
      // têm o que registrar -> viram texto simples (não clicáveis).
      cell: ({ row }) => {
        const nome = row.original.procedimento_catalogo_nome || row.original.procedimento || 'Ficha'
        const bloqueada = ['CANCELADA', 'FALTOU'].includes(row.original.status ?? '')
        if (bloqueada) {
          return <span className="text-muted-foreground">{nome}</span>
        }
        return (
          <Link
            to={`/pacientes/${pacienteId}/consultas/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {nome}
          </Link>
        )
      },
    },
    {
      id: 'inicio',
      header: 'Início',
      accessorFn: (c) => c.inicio ?? '',
      cell: ({ row }) => <DateTime iso={row.original.inicio} />,
    },
    {
      id: 'dentista',
      header: 'Dentista',
      accessorFn: (c) => nomePorDentista.get(c.dentista) ?? '',
      cell: ({ row }) => nomePorDentista.get(row.original.dentista) ?? vazio,
    },
    {
      id: 'dentes',
      header: 'Dentes',
      enableSorting: false,
      cell: ({ row }) => <CelulaDentes dentes={row.original.dentes} />,
    },
    {
      id: 'confirmacao',
      header: 'Confirmação',
      accessorFn: (c) => c.status_confirmacao ?? '',
      cell: ({ row }) => <BadgeStatus status={row.original.status_confirmacao} />,
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (c) => c.status ?? '',
      cell: ({ row }) => <BadgeStatus status={row.original.status} />,
    },
    {
      id: 'cobranca',
      header: 'Cobrança',
      accessorFn: (c) => c.convenio_nome ?? 'Particular',
      cell: ({ row }) => <BadgeCobranca convenioNome={row.original.convenio_nome} />,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Filtrar por status"
          className={classeFiltro}
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {statusDisponiveis.map((s) => (
            <option key={s} value={s}>
              {rotuloStatus(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por confirmação"
          className={classeFiltro}
          value={filtroConfirmacao}
          onChange={(e) => setFiltroConfirmacao(e.target.value)}
        >
          <option value="">Todas as confirmações</option>
          {confirmacoesDisponiveis.map((s) => (
            <option key={s} value={s}>
              {rotuloStatus(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por cobrança"
          className={classeFiltro}
          value={filtroCobranca}
          onChange={(e) => setFiltroCobranca(e.target.value)}
        >
          <option value="">Toda cobrança</option>
          <option value="convenio">Convênio</option>
          <option value="particular">Particular</option>
        </select>
      </div>

      <DataTable
        columns={colunas}
        data={filtradas}
        carregando={isLoading}
        vazio="Nenhuma consulta."
      />
    </div>
  )
}

export function PacienteDetalhePage() {
  const { id } = useParams()
  const novo = id === undefined
  const pacienteId = Number(id)
  const { data: paciente, isLoading, isError } = usePaciente(pacienteId)

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/pacientes">
            <ArrowLeft /> Voltar
          </Link>
        </Button>
        <PageHeader
          titulo={novo ? 'Novo paciente' : (paciente?.nome_completo ?? 'Paciente')}
          descricao={
            !novo && paciente?.idade != null
              ? `${paciente.idade} anos · Ficha do paciente.`
              : 'Ficha do paciente.'
          }
        />
      </div>

      {isError ? (
        <EmptyState
          icone={Users}
          titulo="Paciente não encontrado"
          descricao="O paciente pode ter sido removido ou o link está incorreto."
        />
      ) : (
        <Tabs defaultValue="dados">
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="planos">Planos</TabsTrigger>
            <TabsTrigger value="guias">Guias</TabsTrigger>
            <TabsTrigger value="consultas">Consultas</TabsTrigger>
            <TabsTrigger value="anamneses">Anamneses</TabsTrigger>
          </TabsList>

          <TabsContent value="dados">
            {!novo && isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <AbaDados paciente={paciente} modoCriacao={novo} />
            )}
          </TabsContent>
          <TabsContent value="planos">
            {novo ? <AvisoSalvarPrimeiro /> : <AbaPlanos pacienteId={pacienteId} />}
          </TabsContent>
          <TabsContent value="guias">
            {novo ? <AvisoSalvarPrimeiro /> : <AbaGuias pacienteId={pacienteId} />}
          </TabsContent>
          <TabsContent value="consultas">
            {novo ? <AvisoSalvarPrimeiro /> : <AbaConsultas pacienteId={pacienteId} />}
          </TabsContent>
          <TabsContent value="anamneses">
            {novo ? <AvisoSalvarPrimeiro /> : <AbaAnamneses pacienteId={pacienteId} />}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
