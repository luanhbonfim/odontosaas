import { PageHeader } from '@/components/layout/page-header'

export function EmConstrucao({ titulo }: { titulo: string }) {
  return (
    <div>
      <PageHeader titulo={titulo} descricao="Este módulo será implementado nas próximas sprints." />
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        🚧 Em construção
      </div>
    </div>
  )
}
