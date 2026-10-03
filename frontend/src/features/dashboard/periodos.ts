// Período de visualização do dashboard.
export type Periodo = 'mes' | 'semestre' | 'ano'

export const periodos: { valor: Periodo; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Mês atual' },
  { valor: 'semestre', rotulo: 'Últimos 6 meses' },
  { valor: 'ano', rotulo: 'Anual' },
]

// Rótulo de comparação sob cada KPI. A comparação é "até o mesmo ponto" do
// período anterior (ex.: 01–03/10 contra 01–03/09), não o período anterior inteiro.
export const rotuloComparacao: Record<Periodo, string> = {
  mes: 'vs. mesmo período do mês anterior',
  semestre: 'vs. mesmo período do semestre anterior',
  ano: 'vs. mesmo período do ano anterior',
}
