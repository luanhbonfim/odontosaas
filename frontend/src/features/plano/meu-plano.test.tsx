import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MeuPlanoPage } from './meu-plano-page'
import { api } from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
  },
}))

function renderComQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('MeuPlanoPage', () => {
  it('renderiza os dados completos do plano, capacidades e módulos ativos', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        clinica: {
          nome_fantasia: 'Clínica Sorriso Nobre',
          razao_social: 'Sorriso Nobre Odontologia LTDA',
          cnpj: '12345678000199',
          schema_name: 'sorriso_nobre',
          responsavel_nome: 'Dra. Helena Souza',
          responsavel_email: 'helena@sorrisonobre.com.br',
          responsavel_telefone: '11999998888',
        },
        plano: {
          id: 1,
          nome: 'Plano Pro Ouro',
          periodicidade: 'MENSAL',
          periodicidade_display: 'Mensal (Renovação a cada 30 dias)',
          preco_mensal: 299.9,
          preco_anual: 2999.0,
        },
        status: {
          status_assinatura: 'ATIVA',
          status_efetivo: 'ATIVA',
          ativo: true,
          vigencia_fim: '2026-12-31',
          dias_restantes: 120,
          vencido: false,
        },
        capacidade: {
          dentistas: {
            atual: 3,
            limite: 5,
            ilimitado: false,
            percentual: 60,
            atingiu_limite: false,
          },
          usuarios: {
            atual: 4,
            limite: 10,
            ilimitado: false,
            percentual: 40,
            atingiu_limite: false,
          },
          pacientes: {
            atual: 250,
            limite: 1000,
            ilimitado: false,
            percentual: 25,
            atingiu_limite: false,
          },
          armazenamento_mb: {
            atual_mb: 150,
            limite_mb: 5120,
            percentual: 3,
          },
        },
        modulos: {
          financeiro: true,
          estoque: true,
          sync_google: true,
          whatsapp_waha: true,
        },
        upgrade: {
          contato_comercial_email: 'comercial@odontosaas.com.br',
          contato_comercial_whatsapp: '5511999999999',
          whatsapp_url: 'https://wa.me/5511999999999',
        },
      },
    })

    renderComQueryClient(<MeuPlanoPage />)

    expect(screen.getByText('Meu Plano & Assinatura')).toBeInTheDocument()
    expect(await screen.findByText('Plano Pro Ouro')).toBeInTheDocument()
    expect(screen.getByText('Clínica Sorriso Nobre')).toBeInTheDocument()
    expect(screen.getByText('Mensal (Renovação a cada 30 dias)')).toBeInTheDocument()
    expect(screen.getByText('Módulo Financeiro')).toBeInTheDocument()
    expect(screen.getByText('Controle de Estoque')).toBeInTheDocument()
    expect(screen.getByText('Google Calendar')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp WAHA')).toBeInTheDocument()
    expect(screen.getByText('Dentistas Ativos')).toBeInTheDocument()
    expect(screen.getByText('Usuários da Equipe')).toBeInTheDocument()
    expect(screen.getAllByText('Falar com Especialista').length).toBeGreaterThanOrEqual(1)
  })

  it('exibe alerta de vigência expirada quando vencido', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        clinica: {
          nome_fantasia: 'Clínica Expirada',
          razao_social: 'Expirada LTDA',
          cnpj: null,
          schema_name: 'expirada',
          responsavel_nome: 'Dr. João',
          responsavel_email: null,
          responsavel_telefone: '11999999999',
        },
        plano: {
          id: 2,
          nome: 'Plano Básico',
          periodicidade: 'MENSAL',
          periodicidade_display: 'Mensal',
          preco_mensal: 99.9,
          preco_anual: null,
        },
        status: {
          status_assinatura: 'ATIVA',
          status_efetivo: 'VENCIDA',
          ativo: true,
          vigencia_fim: '2026-01-01',
          dias_restantes: -10,
          vencido: true,
        },
        capacidade: {
          dentistas: { atual: 2, limite: 2, ilimitado: false, percentual: 100, atingiu_limite: true },
          usuarios: { atual: 2, limite: 2, ilimitado: false, percentual: 100, atingiu_limite: true },
          pacientes: { atual: 10, limite: 100, ilimitado: false, percentual: 10, atingiu_limite: false },
          armazenamento_mb: { atual_mb: 20, limite_mb: 1024, percentual: 2 },
        },
        modulos: {
          financeiro: false,
          estoque: false,
          sync_google: false,
          whatsapp_waha: false,
        },
        upgrade: {
          contato_comercial_email: 'comercial@odontosaas.com.br',
          contato_comercial_whatsapp: '5511999999999',
          whatsapp_url: 'https://wa.me/5511999999999',
        },
      },
    })

    renderComQueryClient(<MeuPlanoPage />)

    expect(await screen.findByText('A vigência do seu plano expirou')).toBeInTheDocument()
    expect(screen.getByText('Renovar Agora')).toBeInTheDocument()
  })
})
