import { PageHeader } from '@/components/layout/page-header'

import { AbaAlertas } from './aba-alertas'

export function AlertasPage() {
  return (
    <div className="space-y-6">
      <PageHeader titulo="Alertas" descricao="Insumos no ou abaixo do estoque mínimo — reposição pendente." />
      <AbaAlertas />
    </div>
  )
}
