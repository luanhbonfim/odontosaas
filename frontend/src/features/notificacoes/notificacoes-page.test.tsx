import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NotificacoesPage } from './notificacoes-page'

const {
  configMock,
  salvarConfigMock,
  templatesMock,
  salvarTemplateMock,
  removerTemplateMock,
  logsMock,
} = vi.hoisted(() => ({
  configMock: vi.fn(),
  salvarConfigMock: vi.fn(),
  templatesMock: vi.fn(),
  salvarTemplateMock: vi.fn(),
  removerTemplateMock: vi.fn(),
  logsMock: vi.fn(),
}))
vi.mock('./use-notificacoes', () => ({
  useConfiguracao: configMock,
  useSalvarConfiguracao: () => ({ mutateAsync: salvarConfigMock, isPending: false }),
  useTemplates: templatesMock,
  useSalvarTemplate: () => ({ mutateAsync: salvarTemplateMock, isPending: false }),
  useAlternarTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoverTemplate: () => ({ mutateAsync: removerTemplateMock }),
  useLogs: logsMock,
  // Conexão WhatsApp (usada pelo card ConexaoWhatsapp dentro da aba Configuração).
  useWhatsappStatus: () => ({
    data: { session: 's1', status: 'STOPPED', conectado: false, numero: null },
    isLoading: false,
  }),
  useQrWhatsapp: () => ({ data: undefined }),
  useConectarWhatsapp: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDesconectarWhatsapp: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/features/procedimentos/use-procedimentos', () => ({
  useProcedimentos: () => ({ data: [{ id: 1, nome: 'Limpeza', ativo: true }] }),
}))

function preparar() {
  configMock.mockReturnValue({
    data: {
      id: 1,
      dias_antecedencia: 2,
      horario_envio: '08:30:00',
      waha_session: 'sess',
      numero_clinica: '5511',
      palavras_confirmacao: '',
      palavras_recusa: '',
      enviar_agradecimento: true,
      ativo: true,
    },
    isLoading: false,
  })
  templatesMock.mockReturnValue({ data: [], isLoading: false })
  logsMock.mockReturnValue({ data: [], isLoading: false })
}

describe('NotificacoesPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('configuração: carrega e salva', async () => {
    preparar()
    salvarConfigMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<NotificacoesPage />)

    const dias = screen.getByLabelText(/dias de antecedência/i)
    expect(dias).toHaveValue(2)
    await user.clear(dias)
    await user.type(dias, '3')
    await user.click(screen.getByRole('button', { name: /salvar configuração/i }))

    await waitFor(() => expect(salvarConfigMock).toHaveBeenCalled())
    expect(salvarConfigMock).toHaveBeenCalledWith({
      id: 1,
      dados: {
        dias_antecedencia: 3,
        horario_envio: '08:30',
        enviar_agradecimento: true,
        enviar_reagendamento: true,
        reagendamento_minutos: 1,
        enviar_cancelamento: true,
        cancelar_nao_confirmadas: false,
        cancelar_horas_antes: 10,
        reforcar_confirmacao: true,
        mensagem_reforco: '',
        ativo: true,
      },
    })
  })

  it('templates: o preview substitui as variáveis', async () => {
    preparar()
    const user = userEvent.setup()
    render(<NotificacoesPage />)
    await user.click(screen.getByRole('tab', { name: 'Templates' }))
    await user.click(screen.getByRole('button', { name: /adicionar lembrete/i }))
    const campo = screen.getByLabelText('Mensagem')
    await user.click(campo)
    // paste insere texto literal (type interpretaria {{ como escape).
    await user.paste('Olá {{paciente}}, dia {{data}}')
    // Preview renderizado com a amostra.
    expect(screen.getByText('Olá Maria Silva, dia 10/08/2026')).toBeInTheDocument()
  })

  it('histórico: lista os registros', async () => {
    preparar()
    logsMock.mockReturnValue({
      data: [
        {
          id: 1,
          paciente_nome: 'Zé',
          tipo: 'CONFIRMACAO',
          direcao: 'ENVIADA',
          status: 'ENVIADA',
          resposta_paciente: '',
          enviado_em: '2026-08-01T12:00:00Z',
          criado_em: '2026-08-01T12:00:00Z',
        },
      ],
      isLoading: false,
    })
    const user = userEvent.setup()
    render(<NotificacoesPage />)
    await user.click(screen.getByRole('tab', { name: 'Histórico' }))
    expect(screen.getByText('Zé')).toBeInTheDocument()
  })
})
