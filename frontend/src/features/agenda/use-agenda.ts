import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type Consulta = components['schemas']['Consulta']

/** Campos graváveis de uma consulta (agendar/editar). */
export type ConsultaEntrada = {
  paciente: number
  dentista: number
  inicio: string
  fim: string
  procedimento?: string
  /** Procedimento do catálogo (id) ou null. */
  procedimento_catalogo?: number | null
  observacoes?: string
  valor?: string
  /** Forma de pagamento (Pix/Boleto/Cartão/Dinheiro/Transferência) — opcional. */
  forma_pagamento?: string
  /** Em quantas parcelas a conta a receber é dividida (1 = à vista). */
  parcelas?: number
  /** Vencimento da 1ª parcela; as demais seguem mensalmente a partir dela. */
  data_primeira_parcela?: string | null
  /** Convênio da cobrança (id) ou null = particular. */
  convenio?: number | null
}

/** Rótulo por status (exibição no modal/lista). */
export const ROTULO_STATUS: Record<string, string> = {
  AGENDADA: 'Agendada',
  EM_ATENDIMENTO: 'Em atendimento',
  REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada',
  FALTOU: 'Faltou',
}

/** Legenda/cores da agenda: AGENDADA é dividida pela confirmação do paciente. */
export const LEGENDA_AGENDA: { chave: string; rotulo: string; cor: string }[] = [
  { chave: 'AGENDADA_PENDENTE', rotulo: 'Agendada (Pendente)', cor: '#3b82f6' }, // azul
  { chave: 'AGENDADA_CONFIRMADA', rotulo: 'Agendada (Confirmada)', cor: '#22c55e' }, // verde
  { chave: 'EM_ATENDIMENTO', rotulo: 'Em atendimento', cor: '#8b5cf6' }, // roxo
  { chave: 'REALIZADA', rotulo: 'Realizada', cor: '#15803d' }, // verde-escuro
  { chave: 'CANCELADA', rotulo: 'Cancelada', cor: '#ef4444' }, // vermelho
  { chave: 'FALTOU', rotulo: 'Faltou', cor: '#991b1b' }, // vermelho escuro (tom distinto)
]

const COR_PADRAO = '#3b82f6'

/** Cor do evento pela combinação status + confirmação (Agendada Pendente/Confirmada). */
export function corDaConsulta(status?: string | null, confirmacao?: string | null): string {
  if (status === 'AGENDADA') return confirmacao === 'CONFIRMADA' ? '#22c55e' : '#3b82f6'
  const cores: Record<string, string> = {
    EM_ATENDIMENTO: '#8b5cf6', // roxo
    REALIZADA: '#15803d', // verde-escuro
    CANCELADA: '#ef4444', // vermelho
    FALTOU: '#991b1b', // vermelho escuro (tom distinto)
  }
  return cores[status ?? ''] ?? COR_PADRAO
}

/** Locale pt-BR do FullCalendar (objeto — esta versão não expõe `locales/pt-br`). */
export const LOCALE_PT_BR = {
  code: 'pt-br',
  buttonText: {
    prev: 'Anterior',
    next: 'Próximo',
    today: 'Hoje',
    month: 'Mês',
    week: 'Semana',
    day: 'Dia',
  },
  allDayText: 'dia inteiro',
  noEventsText: 'Não há consultas para mostrar',
}

export type EventoAgenda = {
  id: string
  title: string
  start: string
  end: string
  backgroundColor: string
  borderColor: string
  /** Só consultas AGENDADA podem ser arrastadas/redimensionadas/editadas. */
  editable: boolean
  extendedProps: { status: string; statusConfirmacao: string; dentista: string }
}

/** Converte uma consulta da API num evento do FullCalendar (cor por status + confirmação). */
export function consultaParaEvento(c: Consulta): EventoAgenda {
  const cor = corDaConsulta(c.status, c.status_confirmacao)
  return {
    id: String(c.id),
    title: `${c.paciente_nome || 'Paciente'} — ${c.procedimento || 'Consulta'}`,
    start: c.inicio,
    end: c.fim,
    backgroundColor: cor,
    borderColor: cor,
    editable: c.status === 'AGENDADA',
    extendedProps: {
      status: c.status ?? '',
      statusConfirmacao: c.status_confirmacao ?? '',
      dentista: c.dentista_nome ?? '',
    },
  }
}

const CHAVE_AGENDA = ['consultas', 'agenda']

/** Lista as consultas da clínica (a API já filtra pelo escopo do dentista logado). */
export function useConsultas() {
  return useQuery({
    queryKey: CHAVE_AGENDA,
    queryFn: async () => (await api.get<Consulta[]>('/consultas/')).data,
    staleTime: 60_000,
  })
}

export function useCriarConsulta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: ConsultaEntrada) =>
      (await api.post<Consulta>('/consultas/', dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_AGENDA }),
  })
}

export function useAtualizarConsulta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<ConsultaEntrada> }) =>
      (await api.patch<Consulta>(`/consultas/${id}/`, dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_AGENDA }),
  })
}

export function useRemoverConsulta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/consultas/${id}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_AGENDA }),
  })
}

/** Transição de status via action do backend (iniciar/finalizar/estornar). */
export type AcaoConsulta = 'iniciar' | 'finalizar' | 'estornar'

export function useTransicaoConsulta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, acao }: { id: number; acao: AcaoConsulta }) =>
      (await api.post<Consulta>(`/consultas/${id}/${acao}/`, {})).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_AGENDA }),
  })
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Date/ISO -> valor de `<input type="datetime-local">` (hora local, sem timezone). */
export function paraInputLocal(valor: string | Date): string {
  const d = new Date(valor)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Valor de `datetime-local` (hora local) -> ISO com timezone (para a API). */
export function deInputLocal(local: string): string {
  return new Date(local).toISOString()
}
