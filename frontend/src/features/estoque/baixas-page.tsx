import { PageHeader } from '@/components/layout/page-header'

import { AbaBaixas } from './aba-movimentacoes'

export function BaixasPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Baixas"
        descricao="Saídas de estoque — manuais (perda, quebra, ajuste) e automáticas (consumo em consultas)."
      />
      <AbaBaixas />
    </div>
  )
}
