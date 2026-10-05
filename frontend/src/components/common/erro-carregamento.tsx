import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { EmptyState } from './empty-state'

/** Estado de erro padrão de listas/telas que falham ao carregar: avisa (role="alert"),
 * nunca finge que "não há dados" e oferece tentar de novo. */
export function ErroCarregamento({
  titulo,
  aoTentarDeNovo,
}: {
  titulo: string
  aoTentarDeNovo?: () => void
}) {
  return (
    <div role="alert">
      <EmptyState
        icone={AlertTriangle}
        titulo={titulo}
        descricao="Verifique sua conexão e tente novamente."
        acao={
          aoTentarDeNovo ? (
            <Button variant="outline" onClick={aoTentarDeNovo}>
              Tentar de novo
            </Button>
          ) : undefined
        }
      />
    </div>
  )
}
