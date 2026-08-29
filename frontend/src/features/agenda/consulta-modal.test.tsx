import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ConsultaModal } from './consulta-modal'

const {
  criarMock,
  atualizarMock,
  removerMock,
  transicaoMock,
  pacientesMock,
  planosMock,
  pacienteMock,
} = vi.hoisted(() => ({
  criarMock: vi.fn(),
  atualizarMock: vi.fn(),
  removerMock: vi.fn(),
  transicaoMock: vi.fn(),
  pacientesMock: vi.fn(),
  planosMock: vi.fn(),
  pacienteMock: vi.fn(),
}))

vi.mock('./use-agenda', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./use-agenda')>()),
  useCriarConsulta: () => ({ mutateAsync: criarMock }),
  useAtualizarConsulta: () => ({ mutateAsync: atualizarMock }),
  useRemoverConsulta: () => ({ mutateAsync: removerMock }),
  useTransicaoConsulta: () => ({ mutateAsync: transicaoMock, isPending: false }),
}))
vi.mock('@/features/dentistas/use-dentistas', () => ({
  useDentistas: () => ({
    data: [
      { id: 5, nome_completo: 'Dra. Ana' },
      { id: 6, nome_completo: 'Dr. Beto' },
    ],
  }),
}))
vi.mock('@/features/notificacoes/use-notificacoes', () => ({
  useEnviarConfirmacao: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ status: 'ENVIADA' }),
    isPending: false,
  }),
}))
vi.mock('@/features/procedimentos/use-procedimentos', () => ({
  useProcedimentos: () => ({
    data: [
      { id: 1, nome: 'Limpeza', ativo: true },
      { id: 2, nome: 'Canal', ativo: true },
    ],
  }),
}))
vi.mock('@/features/pacientes/use-pacientes', () => ({ usePacientes: pacientesMock }))
vi.mock('@/features/pacientes/use-paciente-detalhe', () => ({
  usePlanosDoPaciente: planosMock,
  usePaciente: pacienteMock,
}))
vi.mock('@/features/estoque/consumo-consulta-dialog', () => ({
  ConsumoConsultaDialog: ({ trigger }: { trigger: ReactNode }) => trigger,
}))
vi.mock('@/features/auth/use-sessao', () => ({
  useSessao: () => ({
    usuario: {
      id: 1,
      papel: 'ADMIN',
      clinica: {
        schema: 'demo',
        nomeFantasia: 'Demo',
        modulos: { whatsapp: true, google_calendar: true },
      },
    },
    carregando: false,
    erro: false,
  }),
}))

describe('ConsultaModal', () => {
  // Por padrão o paciente não tem vínculo -> libera todos os dentistas.
  beforeEach(() => pacienteMock.mockReturnValue({ data: undefined }))
  afterEach(() => vi.clearAllMocks())

  it('agenda uma consulta particular: paciente, dentista, valor e salva', async () => {
    pacientesMock.mockReturnValue({ data: { results: [{ id: 10, nome_completo: 'João Silva' }] } })
    planosMock.mockReturnValue({ data: [] }) // paciente sem convênio
    criarMock.mockResolvedValue({})
    const aoFechar = vi.fn()
    const user = userEvent.setup()
    render(
      <ConsultaModal
        estado={{ modo: 'criar', inicio: '2026-08-10T09:00', fim: '2026-08-10T09:30' }}
        aoFechar={aoFechar}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Agendar consulta' })).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText(/buscar paciente/i), 'João')
    await user.click(screen.getByRole('button', { name: 'João Silva' }))
    await user.selectOptions(screen.getByLabelText('Dentista'), '5')
    await user.type(screen.getByLabelText(/valor/i), '150')
    // Paciente sem convênio -> cobrança sempre visível, travada em Particular.
    const cobranca = screen.getByLabelText('Cobrança')
    expect(cobranca).toBeDisabled()
    expect(cobranca).toHaveValue('0')
    await user.click(screen.getByRole('button', { name: 'Agendar' }))

    await waitFor(() => expect(criarMock).toHaveBeenCalled())
    expect(criarMock).toHaveBeenCalledWith(
      expect.objectContaining({ paciente: 10, dentista: 5, valor: '150', convenio: null }),
    )
    expect(aoFechar).toHaveBeenCalled()
  })

  it('exige o valor (mesmo particular)', async () => {
    pacientesMock.mockReturnValue({ data: { results: [{ id: 10, nome_completo: 'João Silva' }] } })
    planosMock.mockReturnValue({ data: [] })
    const user = userEvent.setup()
    render(
      <ConsultaModal
        estado={{ modo: 'criar', inicio: '2026-08-10T09:00', fim: '2026-08-10T09:30' }}
        aoFechar={vi.fn()}
      />,
    )
    await user.type(screen.getByPlaceholderText(/buscar paciente/i), 'João')
    await user.click(screen.getByRole('button', { name: 'João Silva' }))
    await user.selectOptions(screen.getByLabelText('Dentista'), '5')
    await user.click(screen.getByRole('button', { name: 'Agendar' }))
    expect(await screen.findByText('Informe o valor da consulta.')).toBeInTheDocument()
    expect(criarMock).not.toHaveBeenCalled()
  })

  it('sem paciente mostra erro e não salva', async () => {
    pacientesMock.mockReturnValue({ data: { results: [] } })
    planosMock.mockReturnValue({ data: [] })
    const user = userEvent.setup()
    render(
      <ConsultaModal
        estado={{ modo: 'criar', inicio: '2026-08-10T09:00', fim: '2026-08-10T09:30' }}
        aoFechar={vi.fn()}
      />,
    )
    // O dentista fica bloqueado enquanto não há paciente.
    expect(screen.getByLabelText('Dentista')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Agendar' }))
    expect(await screen.findByText('Selecione o paciente.')).toBeInTheDocument()
    expect(criarMock).not.toHaveBeenCalled()
  })

  it('paciente com convênio: mostra a cobrança e salva por convênio', async () => {
    pacientesMock.mockReturnValue({ data: { results: [{ id: 10, nome_completo: 'João Silva' }] } })
    planosMock.mockReturnValue({
      data: [{ id: 1, convenio: 3, convenio_nome: 'Amil', status: 'ATIVO' }],
    })
    criarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(
      <ConsultaModal
        estado={{ modo: 'criar', inicio: '2026-08-10T09:00', fim: '2026-08-10T09:30' }}
        aoFechar={vi.fn()}
      />,
    )
    await user.type(screen.getByPlaceholderText(/buscar paciente/i), 'João')
    await user.click(screen.getByRole('button', { name: 'João Silva' }))

    const cobranca = screen.getByLabelText('Cobrança')
    expect(within(cobranca).getByRole('option', { name: 'Particular' })).toBeInTheDocument()
    expect(within(cobranca).getByRole('option', { name: 'Convênio — Amil' })).toBeInTheDocument()
    await user.selectOptions(cobranca, '3')
    await user.selectOptions(screen.getByLabelText('Dentista'), '5')
    await user.type(screen.getByLabelText(/valor/i), '80')
    await user.click(screen.getByRole('button', { name: 'Agendar' }))

    await waitFor(() => expect(criarMock).toHaveBeenCalled())
    expect(criarMock).toHaveBeenCalledWith(
      expect.objectContaining({ paciente: 10, convenio: 3, valor: '80' }),
    )
  })

  it('restringe os dentistas ao responsável + compartilhados do paciente', async () => {
    pacientesMock.mockReturnValue({ data: { results: [{ id: 10, nome_completo: 'João Silva' }] } })
    planosMock.mockReturnValue({ data: [] })
    pacienteMock.mockReturnValue({
      data: { dentista_responsavel: 6, dentistas_compartilhados: [] },
    })
    const user = userEvent.setup()
    render(
      <ConsultaModal
        estado={{ modo: 'criar', inicio: '2026-08-10T09:00', fim: '2026-08-10T09:30' }}
        aoFechar={vi.fn()}
      />,
    )
    await user.type(screen.getByPlaceholderText(/buscar paciente/i), 'João')
    await user.click(screen.getByRole('button', { name: 'João Silva' }))

    const dentista = screen.getByLabelText('Dentista')
    // Só o responsável (Dr. Beto); a Dra. Ana não atende este paciente.
    expect(within(dentista).getByRole('option', { name: 'Dr. Beto' })).toBeInTheDocument()
    expect(within(dentista).queryByRole('option', { name: 'Dra. Ana' })).toBeNull()
  })

  it('convênio vencido: mostra aviso e bloqueia o agendamento', async () => {
    pacientesMock.mockReturnValue({ data: { results: [{ id: 10, nome_completo: 'João Silva' }] } })
    planosMock.mockReturnValue({
      data: [
        { id: 1, convenio: 3, convenio_nome: 'Amil', status: 'ATIVO', validade: '2020-01-01' },
      ],
    })
    const user = userEvent.setup()
    render(
      <ConsultaModal
        estado={{ modo: 'criar', inicio: '2026-08-10T09:00', fim: '2026-08-10T09:30' }}
        aoFechar={vi.fn()}
      />,
    )
    await user.type(screen.getByPlaceholderText(/buscar paciente/i), 'João')
    await user.click(screen.getByRole('button', { name: 'João Silva' }))
    await user.selectOptions(screen.getByLabelText('Cobrança'), '3')

    expect(screen.getByText(/convênio vencido/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agendar' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Agendar' }))
    expect(criarMock).not.toHaveBeenCalled()
  })

  it('editar pré-preenche o paciente e faz PATCH', async () => {
    pacientesMock.mockReturnValue({ data: { results: [] } })
    planosMock.mockReturnValue({ data: [] })
    atualizarMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(
      <ConsultaModal
        estado={{
          modo: 'editar',
          consulta: {
            id: 7,
            paciente: 10,
            paciente_nome: 'João Silva',
            dentista: 5,
            dentista_nome: 'Dra. Ana',
            inicio: '2026-08-10T13:00:00Z',
            fim: '2026-08-10T13:30:00Z',
            procedimento: 'Limpeza',
            valor: '120.00',
          } as never,
        }}
        aoFechar={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Editar consulta' })).toBeInTheDocument()
    expect(screen.getByText('João Silva')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(atualizarMock).toHaveBeenCalled())
    expect(atualizarMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, dados: expect.objectContaining({ paciente: 10 }) }),
    )
  })

  it('inicia o atendimento só quando a consulta está confirmada', async () => {
    pacientesMock.mockReturnValue({ data: { results: [] } })
    planosMock.mockReturnValue({ data: [] })
    transicaoMock.mockResolvedValue({})
    const aoFechar = vi.fn()
    const user = userEvent.setup()
    const base = {
      id: 7,
      paciente: 10,
      paciente_nome: 'João Silva',
      dentista: 5,
      inicio: '2026-08-10T13:00:00Z',
      fim: '2026-08-10T13:30:00Z',
      valor: '120.00',
      status: 'AGENDADA',
    }
    // PENDENTE: aparece "Enviar confirmação", NÃO aparece "Iniciar".
    const pend = render(
      <ConsultaModal
        estado={{ modo: 'editar', consulta: { ...base, status_confirmacao: 'PENDENTE' } as never }}
        aoFechar={aoFechar}
      />,
    )
    expect(screen.getByRole('button', { name: /enviar confirmação/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /iniciar atendimento/i })).toBeNull()
    pend.unmount()

    // CONFIRMADA: some "Enviar confirmação", aparece "Iniciar".
    render(
      <ConsultaModal
        estado={{
          modo: 'editar',
          consulta: { ...base, status_confirmacao: 'CONFIRMADA' } as never,
        }}
        aoFechar={aoFechar}
      />,
    )
    expect(screen.queryByRole('button', { name: /enviar confirmação/i })).toBeNull()
    await user.click(screen.getByRole('button', { name: /iniciar atendimento/i }))
    await waitFor(() => expect(transicaoMock).toHaveBeenCalledWith({ id: 7, acao: 'iniciar' }))
    expect(aoFechar).toHaveBeenCalled()
  })

  it('finaliza o atendimento em andamento (visualização)', async () => {
    transicaoMock.mockResolvedValue({})
    const aoFechar = vi.fn()
    const user = userEvent.setup()
    render(
      <ConsultaModal
        estado={{
          modo: 'visualizar',
          consulta: {
            id: 9,
            paciente: 10,
            paciente_nome: 'Maria Souza',
            dentista: 5,
            dentista_nome: 'Dra. Ana',
            inicio: '2026-08-10T15:00:00Z',
            fim: '2026-08-10T15:30:00Z',
            valor: '200.00',
            status: 'EM_ATENDIMENTO',
          } as never,
        }}
        aoFechar={aoFechar}
      />,
    )
    await user.click(screen.getByRole('button', { name: /finalizar atendimento/i }))
    await waitFor(() => expect(transicaoMock).toHaveBeenCalledWith({ id: 9, acao: 'finalizar' }))
    expect(aoFechar).toHaveBeenCalled()
  })

  it('"Registrar insumos" aparece em EM_ATENDIMENTO e REALIZADA, não em CANCELADA', () => {
    const base = {
      id: 9,
      paciente: 10,
      paciente_nome: 'Maria Souza',
      dentista: 5,
      dentista_nome: 'Dra. Ana',
      inicio: '2026-08-10T15:00:00Z',
      fim: '2026-08-10T15:30:00Z',
      valor: '200.00',
    }

    const emAtendimento = render(
      <ConsultaModal
        estado={{ modo: 'visualizar', consulta: { ...base, status: 'EM_ATENDIMENTO' } as never }}
        aoFechar={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Registrar insumos' })).toBeInTheDocument()
    emAtendimento.unmount()

    const realizada = render(
      <ConsultaModal
        estado={{ modo: 'visualizar', consulta: { ...base, status: 'REALIZADA' } as never }}
        aoFechar={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Registrar insumos' })).toBeInTheDocument()
    realizada.unmount()

    render(
      <ConsultaModal
        estado={{ modo: 'visualizar', consulta: { ...base, status: 'CANCELADA' } as never }}
        aoFechar={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Registrar insumos' })).toBeNull()
  })

  it('exclui uma consulta agendada (na edição)', async () => {
    pacientesMock.mockReturnValue({ data: { results: [] } })
    planosMock.mockReturnValue({ data: [] })
    removerMock.mockResolvedValue({})
    const aoFechar = vi.fn()
    const user = userEvent.setup()
    render(
      <ConsultaModal
        estado={{
          modo: 'editar',
          consulta: {
            id: 7,
            paciente: 10,
            paciente_nome: 'João Silva',
            dentista: 5,
            inicio: '2026-08-10T13:00:00Z',
            fim: '2026-08-10T13:30:00Z',
            valor: '120.00',
          } as never,
        }}
        aoFechar={aoFechar}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Excluir consulta' }))
    await user.click(screen.getByRole('button', { name: /^excluir$/i }))
    await waitFor(() => expect(removerMock).toHaveBeenCalledWith(7))
    expect(aoFechar).toHaveBeenCalled()
  })

  it('exclui uma consulta cancelada (visualização)', async () => {
    removerMock.mockResolvedValue({})
    const aoFechar = vi.fn()
    const user = userEvent.setup()
    render(
      <ConsultaModal
        estado={{
          modo: 'visualizar',
          consulta: {
            id: 11,
            paciente: 10,
            paciente_nome: 'Maria Souza',
            dentista: 5,
            dentista_nome: 'Dra. Ana',
            inicio: '2026-08-10T15:00:00Z',
            fim: '2026-08-10T15:30:00Z',
            valor: '200.00',
            status: 'CANCELADA',
          } as never,
        }}
        aoFechar={aoFechar}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Excluir consulta' }))
    expect(await screen.findByText('Excluir consulta?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^excluir$/i }))
    await waitFor(() => expect(removerMock).toHaveBeenCalledWith(11))
    expect(aoFechar).toHaveBeenCalled()
  })

  it('modo visualização: consulta realizada não mostra opção de excluir', () => {
    render(
      <ConsultaModal
        estado={{
          modo: 'visualizar',
          consulta: {
            id: 12,
            paciente: 10,
            paciente_nome: 'Maria Souza',
            dentista: 5,
            dentista_nome: 'Dra. Ana',
            inicio: '2026-08-10T15:00:00Z',
            fim: '2026-08-10T15:30:00Z',
            valor: '200.00',
            status: 'REALIZADA',
          } as never,
        }}
        aoFechar={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Excluir consulta' })).toBeNull()
  })

  it('modo visualização: dados somente-leitura, sem botão de salvar', () => {
    render(
      <ConsultaModal
        estado={{
          modo: 'visualizar',
          consulta: {
            id: 9,
            paciente: 10,
            paciente_nome: 'Maria Souza',
            dentista: 5,
            dentista_nome: 'Dra. Ana',
            inicio: '2026-08-10T15:00:00Z',
            fim: '2026-08-10T15:30:00Z',
            procedimento: 'Extração',
            valor: '200.00',
            status: 'REALIZADA',
          } as never,
        }}
        aoFechar={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Consulta' })).toBeInTheDocument()
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
    expect(screen.getByText('Extração')).toBeInTheDocument()
    expect(screen.getByText('Realizada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /salvar|agendar/i })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Fechar' }).length).toBeGreaterThan(0)
  })
})
