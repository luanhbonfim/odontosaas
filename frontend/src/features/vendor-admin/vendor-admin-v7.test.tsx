import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlanosPage } from './planos/planos-page'
import { TenantsPage } from './tenants/tenants-page'
import { TenantDetalhesPage } from './tenants/tenant-detalhes-page'

// Mock do vendorApi
vi.mock('./vendor-api-client', () => ({
  vendorApi: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/planos/')) {
        return Promise.resolve({
          data: [
            {
              id: 1,
              nome: 'Plano Pro',
              preco_mensal: 299.9,
              preco_anual: 2999.0,
              limite_dentistas: 5,
              limite_usuarios: 10,
              limite_pacientes_ativos: 1000,
              limite_armazenamento_mb: 5120,
              modulo_financeiro_ativo: true,
              modulo_estoque_ativo: true,
              sync_google_ativo: true,
              whatsapp_waha_ativo: true,
              ativo: true,
              criado_em: '2026-01-01T00:00:00Z',
              total_clinicas: 3,
            },
            {
              id: 2,
              nome: 'Plano Básico',
              preco_mensal: 149.9,
              preco_anual: null,
              limite_dentistas: 2,
              limite_usuarios: 4,
              limite_pacientes_ativos: 300,
              limite_armazenamento_mb: 2048,
              modulo_financeiro_ativo: false,
              modulo_estoque_ativo: false,
              sync_google_ativo: true,
              whatsapp_waha_ativo: false,
              ativo: false,
              criado_em: '2026-02-01T00:00:00Z',
              total_clinicas: 0,
            },
          ],
        })
      }
      if (url.includes('/tenants/1/google_params/')) {
        return Promise.resolve({
          data: {
            sync_ativo: true,
            intervalo_sync_minutos: 15,
            google_calendar_id: 'primary',
            cor_personalizada: '#D4AF37',
          },
        })
      }
      if (url.includes('/tenants/1/whatsapp_params/')) {
        return Promise.resolve({
          data: {
            whatsapp_ativo: true,
            waha_session_name: 'clinica_alfa',
            waha_api_url: 'http://waha:3000',
            timeout_envio_segundos: 30,
            tentativas_maximas: 3,
          },
        })
      }
      if (url.includes('/tenants/1/metricas/')) {
        return Promise.resolve({
          data: {
            total_pacientes: 120,
            total_agendamentos: 450,
            total_dentistas: 4,
            total_usuarios: 8,
            total_procedimentos: 35,
            total_lancamentos: 280,
            storage_usado_mb: 512,
            ultimo_agendamento: '2026-08-18T10:00:00Z',
            ultimo_login: '2026-08-18T14:30:00Z',
          },
        })
      }
      if (url.includes('/tenants/1/auditoria/')) {
        return Promise.resolve({
          data: [
            {
              id: 1,
              operador_email: 'admin@vendor.com',
              ip_origem: '127.0.0.1',
              acao: 'IMPERSONATE',
              acao_display: 'Acesso de suporte (impersonate)',
              schema_alvo: 'clinica_alfa',
              detalhes: { justificativa: 'Chamado #123' },
              criado_em: '2026-08-18T10:00:00Z',
            },
          ],
        })
      }
      if (url.includes('/tenants/1/erros/')) {
        return Promise.resolve({
          data: [
            {
              id: 101,
              modulo: 'GOOGLE_CALENDAR',
              tipo_erro: 'SyncTokenExpired',
              mensagem: 'Token de sincronização expirado. Reconciliação forçada.',
              origem: 'celery.tarefas_google',
              criado_em: '2026-08-18T12:00:00Z',
            },
          ],
        })
      }
      if (url.includes('/tenants/1/')) {
        return Promise.resolve({
          data: {
            id: 1,
            schema_name: 'clinica_alfa',
            nome_fantasia: 'Clínica Alfa Prime',
            razao_social: 'Alfa Odontologia LTDA',
            cnpj: '11222333000199',
            telefone: '11999998888',
            plano_assinatura: 1,
            plano_nome: 'Plano Pro',
            status_assinatura: 'ATIVA',
            gateway_customer_id: 'cus_12345',
            gateway_subscription_id: 'sub_12345',
            vigencia_fim: '2026-12-31T23:59:59Z',
            override_limite_dentistas: 8,
            override_limite_usuarios: null,
            override_recursos: {},
            ativo: true,
            criado_em: '2026-01-01T00:00:00Z',
            dominios: [{ id: 1, domain: 'alfa.localhost', is_primary: true }],
            limite_dentistas_efetivo: 8,
            limite_usuarios_efetivo: 10,
          },
        })
      }
      if (url.includes('/tenants/')) {
        return Promise.resolve({
          data: [
            {
              id: 1,
              schema_name: 'clinica_alfa',
              nome_fantasia: 'Clínica Alfa Prime',
              razao_social: 'Alfa Odontologia LTDA',
              cnpj: '11222333000199',
              telefone: '11999998888',
              plano_assinatura: 1,
              plano_nome: 'Plano Pro',
              status_assinatura: 'ATIVA',
              ativo: true,
              criado_em: '2026-01-01T00:00:00Z',
              dominios: [{ id: 1, domain: 'alfa.localhost', is_primary: true }],
              limite_dentistas_efetivo: 5,
              limite_usuarios_efetivo: 10,
            },
            {
              id: 2,
              schema_name: 'clinica_beta',
              nome_fantasia: 'Clínica Beta',
              razao_social: 'Beta Odontologia LTDA',
              cnpj: '22333444000188',
              telefone: '11988887777',
              plano_assinatura: 2,
              plano_nome: 'Plano Básico',
              status_assinatura: 'INADIMPLENTE',
              ativo: false,
              criado_em: '2026-01-15T00:00:00Z',
              dominios: [{ id: 2, domain: 'beta.localhost', is_primary: true }],
              limite_dentistas_efetivo: 2,
              limite_usuarios_efetivo: 4,
            },
          ],
        })
      }
      return Promise.resolve({ data: {} })
    }),
    post: vi.fn().mockResolvedValue({
      data: {
        id: 99,
        access: 'jwt-support-read-only-token',
        user_id: 10,
        email: 'admin@alfa.com',
        read_only: true,
      },
    }),
    patch: vi.fn().mockResolvedValue({ data: { success: true } }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
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

describe('Vendor Admin - Sprint V7', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza a tela de Gestão de Planos com métricas e tabela', async () => {
    renderComQueryClient(
      <MemoryRouter>
        <PlanosPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Planos de Assinatura')).toBeInTheDocument()
    expect(screen.getByText('Novo Plano')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Plano Pro')).toBeInTheDocument()
      expect(screen.getByText('Plano Básico')).toBeInTheDocument()
    })
  })

  it('renderiza a tela de Listagem de Tenants com filtros e estatísticas', async () => {
    renderComQueryClient(
      <MemoryRouter>
        <TenantsPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/Clínicas & Instâncias Multi-Tenant/i)).toBeInTheDocument()
    expect(screen.getByText('Provisionar Clínica')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Clínica Alfa Prime')).toBeInTheDocument()
      expect(screen.getByText('Clínica Beta')).toBeInTheDocument()
    })
  })

  it('abre o modal de provisionamento e auto-slugifica o schema e domínio', async () => {
    const user = userEvent.setup()
    renderComQueryClient(
      <MemoryRouter>
        <TenantsPage />
      </MemoryRouter>
    )

    const botaoNovo = screen.getByRole('button', { name: /Provisionar Clínica/i })
    await user.click(botaoNovo)

    expect(screen.getByText('Provisionar Nova Clínica')).toBeInTheDocument()

    const inputNome = screen.getByLabelText(/Nome Fantasia/i)
    await user.type(inputNome, 'Odonto Estética')

    const inputSchema = screen.getByLabelText(/Schema PostgreSQL/i)
    expect(inputSchema).toHaveValue('odonto_estetica')

    // O schema mantém underscore (válido no Postgres), mas o domínio é DNS-safe
    // (subdomínio não aceita `_` -> vira `-`).
    const inputDominio = screen.getByLabelText(/Domínio de Acesso/i)
    expect(inputDominio).toHaveValue('odonto-estetica.localhost')
  })

  it('renderiza a tela de Detalhes da Clínica com 5 abas e dados operacionais', async () => {
    const user = userEvent.setup()
    renderComQueryClient(
      <MemoryRouter initialEntries={['/plataforma-admin/tenants/1']}>
        <Routes>
          <Route path="/plataforma-admin/tenants/:id" element={<TenantDetalhesPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Clínica Alfa Prime')).toBeInTheDocument()
      expect(screen.getByText('clinica_alfa')).toBeInTheDocument()
    })

    // Testa navegação para Aba 5: Métricas & Erros
    const abaMetricas = screen.getByRole('button', { name: /5\. Métricas & Erros/i })
    await user.click(abaMetricas)

    await waitFor(() => {
      expect(screen.getByText('Histórico de Erros Operacionais Recentes')).toBeInTheDocument()
      expect(screen.getByText('GOOGLE_CALENDAR')).toBeInTheDocument()
    })
  })
})
