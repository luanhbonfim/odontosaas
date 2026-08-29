import { AlertTriangle, ArrowRightLeft, Boxes, Layers } from 'lucide-react'
import { useState } from 'react'

import { type ItemSegmento, SegmentadorRodape } from '@/components/common/segmentador-rodape'
import { PageHeader } from '@/components/layout/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AbaAlertas } from './aba-alertas'
import { AbaCategoriasInsumo } from './aba-categorias-insumo'
import { AbaInsumos } from './aba-insumos'
import { AbaMovimentacoes } from './aba-movimentacoes'

const ABAS_ESTOQUE: ItemSegmento[] = [
  { id: 'insumos', rotulo: 'Insumos', icone: Boxes },
  { id: 'movimentacoes', rotulo: 'Movimentações', icone: ArrowRightLeft },
  { id: 'alertas', rotulo: 'Alertas', icone: AlertTriangle },
  { id: 'categorias', rotulo: 'Categorias', icone: Layers },
]

export function EstoquePage() {
  const [aba, setAba] = useState('insumos')

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <PageHeader
        titulo="Estoque"
        descricao="Insumos, movimentações e alertas de reposição da clínica."
      />

      <Tabs value={aba} onValueChange={setAba}>
        {/* No mobile a navegação das abas vai para o rodapé (SegmentadorRodape). */}
        <TabsList className="hidden md:flex">
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="insumos">
          <AbaInsumos />
        </TabsContent>
        <TabsContent value="movimentacoes">
          <AbaMovimentacoes />
        </TabsContent>
        <TabsContent value="alertas">
          <AbaAlertas />
        </TabsContent>
        <TabsContent value="categorias">
          <AbaCategoriasInsumo />
        </TabsContent>

        <SegmentadorRodape itens={ABAS_ESTOQUE} ativo={aba} aoMudar={setAba} />
      </Tabs>
    </div>
  )
}
