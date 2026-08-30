import { PageHeader } from '@/components/layout/page-header'

import { AbaCategoriasInsumo } from './aba-categorias-insumo'

export function CategoriasInsumoPage() {
  return (
    <div className="space-y-6">
      <PageHeader titulo="Categorias" descricao="Agrupamento dos insumos (ex.: Descartáveis, Anestésicos)." />
      <AbaCategoriasInsumo />
    </div>
  )
}
