import { PageHeader } from '@/components/layout/page-header'

import { AbaLancamentos } from './aba-movimentacoes'

export function LancamentosPage() {
  return (
    <div className="space-y-6">
      <PageHeader titulo="Lançamentos" descricao="Entradas de estoque — compra, reposição, doação." />
      <AbaLancamentos />
    </div>
  )
}
