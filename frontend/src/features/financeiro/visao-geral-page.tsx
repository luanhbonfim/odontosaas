import { ArrowRight, CheckCircle2, CreditCard, Receipt, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCard } from '@/features/dashboard/kpi-card'
import { formatarMoeda } from '@/lib/utils/format'

import { GraficoResumoFinanceiro } from './grafico-resumo-financeiro'
import { useFluxoCaixa } from './use-lancamentos'

function CardAtalho({ titulo, descricao, para }: { titulo: string; descricao: string; para: string }) {
  return (
    <Link to={para} className="block">
      <Card className="transition-colors hover:bg-accent/40">
        <CardContent className="flex items-center justify-between gap-3 p-5">
          <div>
            <p className="font-semibold">{titulo}</p>
            <p className="text-sm text-muted-foreground">{descricao}</p>
          </div>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  )
}

export function VisaoGeralPage() {
  const { data, isLoading } = useFluxoCaixa()

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Financeiro — Visão Geral"
        descricao="Resumo consolidado de contas a receber e a pagar."
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[92px] w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard titulo="A Receber" valor={formatarMoeda(data?.a_receber ?? 0)} icone={Wallet} />
            <KpiCard titulo="A Pagar" valor={formatarMoeda(data?.a_pagar ?? 0)} icone={Receipt} />
            <KpiCard
              titulo="Recebido"
              valor={formatarMoeda(data?.recebido ?? 0)}
              icone={CheckCircle2}
            />
            <KpiCard titulo="Pago" valor={formatarMoeda(data?.pago ?? 0)} icone={CreditCard} />
          </div>

          <Card>
            <CardContent className="p-5">
              <GraficoResumoFinanceiro
                dados={{
                  a_receber: Number(data?.a_receber ?? 0),
                  a_pagar: Number(data?.a_pagar ?? 0),
                  recebido: Number(data?.recebido ?? 0),
                  pago: Number(data?.pago ?? 0),
                }}
              />
            </CardContent>
          </Card>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <CardAtalho
          titulo="Contas a Receber"
          descricao="Lançamentos de receita e faturamento por operadora."
          para="/financeiro/receber"
        />
        <CardAtalho
          titulo="Contas a Pagar"
          descricao="Despesas manuais e geradas automaticamente."
          para="/financeiro/pagar"
        />
      </div>
    </div>
  )
}
