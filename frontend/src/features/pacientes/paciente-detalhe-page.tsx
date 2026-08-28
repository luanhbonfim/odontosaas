import type { ColumnDef } from '@tanstack/react-table'
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  FileText,
  HeartPulse,
  Stethoscope,
  User,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { DataTable } from '@/components/common/data-table'
import { EmptyState } from '@/components/common/empty-state'
import { DateTime } from '@/components/common/formato'
import { type ItemSegmento, SegmentadorRodape } from '@/components/common/segmentador-rodape'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDentistas } from '@/features/dentistas/use-dentistas'
import { cn } from '@/lib/utils'

import { AbaAnamneses } from './aba-anamneses'
import { AbaDados } from './aba-dados'
import { AbaFichas } from './aba-fichas'
import { AbaGuias } from './aba-guias'
import { AbaPlanos } from './aba-planos'
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

// --- Aba: Consultas (histórico, somente leitura — a notação clínica vive na aba Fichas) ---
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

  // Colunas ordenáveis (accessorFn) — como nas guias. Histórico: sem link/edição.
  const colunas: ColumnDef<Consulta, unknown>[] = [
    {
      id: 'procedimento',
      header: 'Procedimento',
      accessorFn: (c) => c.procedimento_catalogo_nome ?? c.procedimento ?? '',
      cell: ({ row }) =>
        row.original.procedimento_catalogo_nome || row.original.procedimento || vazio,
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
      {/* Mobile: filtros empilhados (um abaixo do outro), 100% largura. sm+: em linha. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <select
          aria-label="Filtrar por status"
          className={cn(classeFiltro, 'w-full sm:w-48')}
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
          className={cn(classeFiltro, 'w-full sm:w-48')}
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
          className={cn(classeFiltro, 'w-full sm:w-48')}
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
        cardMobile={(c) => {
          const nome = c.procedimento_catalogo_nome || c.procedimento || 'Consulta'
          const dentista = nomePorDentista.get(c.dentista)
          return (
            <div className="space-y-2.5">
              <div>
                <p className="font-semibold">{nome}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <DateTime iso={c.inicio} />
                  {dentista ? ` · ${dentista}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <BadgeStatus status={c.status} />
                <BadgeStatus status={c.status_confirmacao} />
                <BadgeCobranca convenioNome={c.convenio_nome} />
              </div>
            </div>
          )
        }}
      />
    </div>
  )
}

const ABAS_PACIENTE: ItemSegmento[] = [
  { id: 'dados', rotulo: 'Dados', icone: User },
  { id: 'planos', rotulo: 'Planos', icone: ClipboardList },
  { id: 'guias', rotulo: 'Guias', icone: FileText },
  { id: 'consultas', rotulo: 'Consultas', icone: CalendarDays },
  { id: 'fichas', rotulo: 'Fichas', icone: Stethoscope },
  { id: 'anamneses', rotulo: 'Anamnese', icone: HeartPulse },
]

export function PacienteDetalhePage() {
  const { id } = useParams()
  const novo = id === undefined
  const pacienteId = Number(id)
  const { data: paciente, isLoading, isError } = usePaciente(pacienteId)
  const [aba, setAba] = useState('dados')

  return (
    <div className="space-y-6 pb-20 md:pb-0">
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
        <Tabs value={aba} onValueChange={setAba}>
          {/* No mobile a navegação das abas vai para o rodapé (SegmentadorRodape). */}
          <TabsList className="hidden md:flex">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="planos">Planos</TabsTrigger>
            <TabsTrigger value="guias">Guias</TabsTrigger>
            <TabsTrigger value="consultas">Consultas</TabsTrigger>
            <TabsTrigger value="fichas">Fichas</TabsTrigger>
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
          <TabsContent value="fichas">
            {novo ? <AvisoSalvarPrimeiro /> : <AbaFichas pacienteId={pacienteId} />}
          </TabsContent>
          <TabsContent value="anamneses">
            {novo ? <AvisoSalvarPrimeiro /> : <AbaAnamneses pacienteId={pacienteId} />}
          </TabsContent>

          <SegmentadorRodape itens={ABAS_PACIENTE} ativo={aba} aoMudar={setAba} />
        </Tabs>
      )}
    </div>
  )
}
