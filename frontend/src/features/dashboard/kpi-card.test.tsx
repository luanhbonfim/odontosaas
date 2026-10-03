import { render, screen } from '@testing-library/react'
import { Users } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { KpiCard } from './kpi-card'

describe('KpiCard', () => {
  it('mostra seta e legenda quando há variação', () => {
    render(<KpiCard titulo="X" valor="10" icone={Users} variacao={5} legenda="vs. anterior" />)
    expect(screen.getByText(/\+5%/)).toBeInTheDocument()
    expect(screen.getByText('vs. anterior')).toBeInTheDocument()
  })

  it('variação 0 ainda é variação (mostra +0%)', () => {
    render(<KpiCard titulo="X" valor="10" icone={Users} variacao={0} />)
    expect(screen.getByText(/\+0%/)).toBeInTheDocument()
  })

  it('variação null não imprime "+null%" nem seta', () => {
    render(<KpiCard titulo="X" valor="10" icone={Users} variacao={null} />)
    expect(screen.queryByText(/null/)).toBeNull()
    expect(screen.queryByText(/%/)).toBeNull()
  })

  it('variação null mostra só a legenda quando passada', () => {
    render(<KpiCard titulo="X" valor="10" icone={Users} variacao={null} legenda="em aberto" />)
    expect(screen.getByText('em aberto')).toBeInTheDocument()
  })

  it('sufixo p.p. para métricas já percentuais', () => {
    render(<KpiCard titulo="X" valor="80%" icone={Users} variacao={2.5} sufixoVariacao=" p.p." />)
    expect(screen.getByText(/\+2\.5 p\.p\./)).toBeInTheDocument()
  })
})
