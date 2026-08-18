import { describe, expect, it } from 'vitest'

import { type Consulta, consultaParaEvento, deInputLocal, paraInputLocal } from './use-agenda'

function consulta(over: Partial<Consulta>): Consulta {
  return {
    id: 1,
    paciente: 10,
    paciente_nome: 'João',
    dentista: 5,
    dentista_nome: 'Dra. Ana',
    inicio: '2026-08-10T13:00:00Z',
    fim: '2026-08-10T13:30:00Z',
    procedimento: 'Limpeza',
    status: 'AGENDADA',
    status_confirmacao: 'PENDENTE',
    ...over,
  } as unknown as Consulta
}

describe('consultaParaEvento', () => {
  it('monta o título com paciente e procedimento e copia horários/dentista', () => {
    const ev = consultaParaEvento(consulta({}))
    expect(ev.title).toBe('João — Limpeza')
    expect(ev.start).toBe('2026-08-10T13:00:00Z')
    expect(ev.end).toBe('2026-08-10T13:30:00Z')
    expect(ev.extendedProps.dentista).toBe('Dra. Ana')
    expect(ev.extendedProps.statusConfirmacao).toBe('PENDENTE')
  })

  it('colore o evento pelo status', () => {
    expect(consultaParaEvento(consulta({ status: 'REALIZADA' })).backgroundColor).toBe('#15803d')
    expect(consultaParaEvento(consulta({ status: 'CANCELADA' })).backgroundColor).toBe('#ef4444')
    expect(consultaParaEvento(consulta({ status: 'FALTOU' })).borderColor).toBe('#991b1b')
    // Agendada: pendente = azul; confirmada = verde.
    expect(
      consultaParaEvento(consulta({ status: 'AGENDADA', status_confirmacao: 'PENDENTE' }))
        .backgroundColor,
    ).toBe('#3b82f6')
    expect(
      consultaParaEvento(consulta({ status: 'AGENDADA', status_confirmacao: 'CONFIRMADA' }))
        .backgroundColor,
    ).toBe('#22c55e')
  })

  it('só consultas AGENDADA são editáveis (arrastar/redimensionar/editar)', () => {
    expect(consultaParaEvento(consulta({ status: 'AGENDADA' })).editable).toBe(true)
    expect(consultaParaEvento(consulta({ status: 'REALIZADA' })).editable).toBe(false)
    expect(consultaParaEvento(consulta({ status: 'CANCELADA' })).editable).toBe(false)
    expect(consultaParaEvento(consulta({ status: 'EM_ATENDIMENTO' })).editable).toBe(false)
  })

  it('usa fallbacks quando faltam paciente/procedimento', () => {
    expect(consultaParaEvento(consulta({ paciente_nome: '', procedimento: '' })).title).toBe(
      'Paciente — Consulta',
    )
  })
})

describe('helpers de datetime', () => {
  it('paraInputLocal e deInputLocal são inversos (hora local)', () => {
    const local = '2026-08-10T14:30'
    expect(paraInputLocal(deInputLocal(local))).toBe(local)
  })

  it('paraInputLocal formata Date para o input local (YYYY-MM-DDTHH:mm)', () => {
    // Meia-noite local do dia -> mesmo dia no formato do input.
    const d = new Date(2026, 7, 3, 8, 5) // 03/08/2026 08:05 local
    expect(paraInputLocal(d)).toBe('2026-08-03T08:05')
  })
})
