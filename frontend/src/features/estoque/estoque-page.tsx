import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Boxes, Layers } from 'lucide-react'
import { useState } from 'react'

import { type ItemSegmento, SegmentadorRodape } from '@/components/common/segmentador-rodape'
import { PageHeader } from '@/components/layout/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AbaAlertas } from './aba-alertas'
import { AbaCategoriasInsumo } from './aba-categorias-insumo'
import { AbaInsumos } from './aba-insumos'
import { AbaBaixas, AbaLancamentos } from './aba-movimentacoes'

const ABAS_ESTOQUE: ItemSegmento[] = [
  { id: 'insumos', rotulo: 'Insumos', icone: Boxes },
  { id: 'categorias', rotulo: 'Categorias', icone: Layers },
  { id: 'lancamentos', rotulo: 'Lançamentos', icone: ArrowDownCircle },
  { id: 'baixas', rotulo: 'Baixas', icone: ArrowUpCircle },
  { id: 'alertas', rotulo: 'Alertas', icone: AlertTriangle },
]

export function EstoquePage() {
  const [aba, setAba] = useState('insumos')

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <PageHeader
        titulo="Estoque"
        descricao="Insumos, categorias, lançamentos, baixas e alertas de reposição da clínica."
      />

      <Tabs value={aba} onValueChange={setAba}>
        {/* No mobile a navegação das abas vai para o rodapé (SegmentadorRodape). */}
        <TabsList className="hidden md:flex">
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="baixas">Baixas</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="insumos">
          <AbaInsumos />
        </TabsContent>
        <TabsContent value="categorias">
          <AbaCategoriasInsumo />
        </TabsContent>
        <TabsContent value="lancamentos">
          <AbaLancamentos />
        </TabsContent>
        <TabsContent value="baixas">
          <AbaBaixas />
        </TabsContent>
        <TabsContent value="alertas">
          <AbaAlertas />
        </TabsContent>

        <SegmentadorRodape itens={ABAS_ESTOQUE} ativo={aba} aoMudar={setAba} />
      </Tabs>
    </div>
  )
}
