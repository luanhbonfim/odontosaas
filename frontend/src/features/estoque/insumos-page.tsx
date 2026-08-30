import { PageHeader } from '@/components/layout/page-header'

import { AbaInsumos } from './aba-insumos'

export function InsumosPage() {
  return (
    <div className="space-y-6">
      <PageHeader titulo="Insumos" descricao="Itens de estoque da clínica: saldo e alerta de reposição." />
      <AbaInsumos />
    </div>
  )
}
