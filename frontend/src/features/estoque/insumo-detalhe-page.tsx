import { ArrowLeft, ArrowLeftRight, Package } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/common/empty-state'
import { type ItemSegmento, SegmentadorRodape } from '@/components/common/segmentador-rodape'
import { StatusBadge } from '@/components/common/status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { InsumoFormDrawer } from './aba-insumos'
import { TabelaMovimentacoes } from './movimentacoes-page'
import { type Insumo, useInsumo, useMovimentacoesEstoque } from './use-estoque'

const traco = <span className="text-muted-foreground">—</span>

const UNIDADES: Record<string, string> = {
  UN: 'Unidade',
  CX: 'Caixa',
  FR: 'Frasco',
  PC: 'Pacote',
  ML: 'Mililitro',
  G: 'Grama',
}

function AbaDadosInsumo({ insumo }: { insumo: Insumo }) {
  return (
    <Card>
      <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Categoria</p>
          <p className="font-medium">{insumo.categoria_nome || traco}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Unidade</p>
          <p className="font-medium">{UNIDADES[insumo.unidade ?? ''] ?? insumo.unidade}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Estoque mínimo</p>
          <p className="font-medium tabular-nums">{insumo.estoque_minimo}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Saldo atual</p>
          <div className="flex items-center gap-2">
            <p className="font-medium tabular-nums">{insumo.saldo}</p>
            {insumo.estoque_baixo && <StatusBadge variante="erro">Estoque baixo</StatusBadge>}
          </div>
        </div>
        {insumo.descricao && (
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Descrição</p>
            <p className="font-medium">{insumo.descricao}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AbaMovimentacoesInsumo({ insumoId }: { insumoId: number }) {
  const { data, isLoading } = useMovimentacoesEstoque({ insumo: insumoId })
  return (
    <TabelaMovimentacoes
      movimentacoes={data ?? []}
      carregando={isLoading}
      mostrarInsumo={false}
      mostrarSaldoAcumulado
      vazio="Nenhuma movimentação registrada para este insumo."
    />
  )
}

const ABAS_INSUMO: ItemSegmento[] = [
  { id: 'dados', rotulo: 'Dados', icone: Package },
  { id: 'movimentacoes', rotulo: 'Movimentações', icone: ArrowLeftRight },
]

export function InsumoDetalhePage() {
  const { insumoId } = useParams()
  const id = Number(insumoId)
  const { data: insumo, isLoading, isError } = useInsumo(id)
  const [aba, setAba] = useState('dados')

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/estoque">
            <ArrowLeft /> Voltar
          </Link>
        </Button>
        <PageHeader
          titulo={insumo?.nome ?? 'Insumo'}
          descricao="Dados e histórico de movimentações do insumo."
          acoes={
            insumo && (
              <InsumoFormDrawer insumo={insumo} trigger={<Button variant="outline">Editar</Button>} />
            )
          }
        />
      </div>

      {isError ? (
        <EmptyState
          icone={Package}
          titulo="Insumo não encontrado"
          descricao="O insumo pode ter sido removido ou o link está incorreto."
        />
      ) : isLoading || !insumo ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="hidden md:flex">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
          </TabsList>

          <TabsContent value="dados">
            <AbaDadosInsumo insumo={insumo} />
          </TabsContent>
          <TabsContent value="movimentacoes">
            <AbaMovimentacoesInsumo insumoId={id} />
          </TabsContent>

          <SegmentadorRodape itens={ABAS_INSUMO} ativo={aba} aoMudar={setAba} />
        </Tabs>
      )}
    </div>
  )
}
