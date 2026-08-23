import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { VendorLoginPage } from './vendor-login-page'
import { ProvisionarTenantModal } from './tenants/provisionar-tenant-modal'
import { TenantDetalhesPage } from './tenants/tenant-detalhes-page'
import { DatabaseStudioPage } from './studio/database-studio-page'
import { CeleryMonitorPage } from './celery/celery-monitor-page'
import { PaginaPublicaPlataforma } from '@/features/public/pagina-publica-plataforma'
import { NaoEncontradaPage } from '@/features/error/nao-encontrada-page'

// Mock do vendorApi
vi.mock('./vendor-api-client', () => ({
  vendorApi: {
    get: vi.fn().mockImplementation((url: string, config?: { params?: Record<string, string> }) => {
      if (url.includes('/planos/')) {
        return Promise.resolve({
          data: [
            { id: 1, nome: 'Plano Básico', periodicidade: 'MENSAL', limite_dentistas: 2, limite_usuarios: 5, storage_max_mb: 1024, sync_google_ativo: false, whatsapp_waha_ativo: false },
            { id: 2, nome: 'Plano Premium', periodicidade: 'ANUAL', limite_dentistas: 10, limite_usuarios: 20, storage_max_mb: 5120, sync_google_ativo: true, whatsapp_waha_ativo: true },
          ],
        })
      }
      if (url.includes('/tenants/1/')) {
        return Promise.resolve({
          data: {
            id: 1,
            nome_fantasia: 'Clínica Odonto Prime',
            razao_social: 'Odonto Prime Ltda',
            cnpj: '12.345.678/0001-90',
            schema_name: 'odonto_prime',
            ativo: true,
            status_efetivo: 'ATIVA',
            status_assinatura: 'ATIVA',
            data_inicio_contrato: '2026-08-01',
            vigencia_fim: '2027-08-01',
            dominios: [{ id: 1, domain: 'odonto_prime.localhost', is_primary: true }],
            plano_detalhes: { id: 2, nome: 'Plano Premium', periodicidade: 'ANUAL' },
            modulos_efetivos: { sync_google: true, whatsapp_waha: true, financeiro: true, estoque: true },
            override_limite_dentistas: null,
            override_limite_usuarios: null,
            override_storage_max_mb: null,
          },
        })
      }
      if (url.includes('/tenants/2/')) {
        // Tenant com módulos desabilitados
        return Promise.resolve({
          data: {
            id: 2,
            nome_fantasia: 'Consultório Simples',
            schema_name: 'consultorio_simples',
            ativo: true,
            status_efetivo: 'ATIVA',
            status_assinatura: 'ATIVA',
            data_inicio_contrato: '2026-08-01',
            vigencia_fim: '2026-09-01',
            dominios: [{ id: 2, domain: 'consultorio_simples.localhost', is_primary: true }],
            plano_detalhes: { id: 1, nome: 'Plano Básico', periodicidade: 'MENSAL' },
            modulos_efetivos: { sync_google: false, whatsapp_waha: false, financeiro: false, estoque: false },
          },
        })
      }
      if (url.includes('/studio/schemas/')) {
        return Promise.resolve({
          data: {
            schemas: [{ schema_name: 'public', total_tabelas: 10 }, { schema_name: 'odonto_prime', total_tabelas: 25 }],
          },
        })
      }
      if (url.includes('/studio/tables/')) {
        return Promise.resolve({
          data: {
            schema: config?.params?.schema || 'public',
            tabelas: [
              {
                tabela: 'tenants_clinica',
                colunas: [{ nome: 'id', tipo: 'bigint', nullable: false, default: null, is_pk: true }, { nome: 'nome_fantasia', tipo: 'varchar(150)', nullable: false, default: null, is_pk: false }],
              },
            ],
          },
        })
      }
      if (url.includes('/status')) {
        return Promise.resolve({
          data: { redis_conectado: true, tamanho_fila_celery: 0, workers_ativos: [{ nome: 'celery@node1', tarefas_ativas: 0 }], total_workers: 1 },
        })
      }
      if (url.includes('/celery')) {
        return Promise.resolve({
          data: [
            { id: 1, name: 'sincronizar-google-incremental', task: 'apps.integracoes.tasks.sincronizar_incremental_todos_tenants', enabled: true, interval_display: 'a cada 15 minutes', crontab_display: '-' },
          ],
        })
      }
      return Promise.reject(new Error(`URL não mockada: ${url}`))
    }),
    post: vi.fn().mockImplementation((url: string, payload?: Record<string, unknown>) => {
      if (url.includes('/auth/login/')) {
        return Promise.resolve({
          data: {
            access: 'access-token-vendor-mock',
            refresh: 'refresh-token-vendor-mock',
            usuario: { nome: 'Admin Master', email: 'admin@proclinica.com.br', is_staff: true, is_superuser: true },
          },
        })
      }
      if (url.includes('/tenants/')) {
        return Promise.resolve({
          data: { id: 3, nome_fantasia: payload?.nome_fantasia, schema_name: payload?.schema_name },
        })
      }
      if (url.includes('/studio/executar/')) {
        return Promise.resolve({
          data: {
            schema: payload?.schema || 'public',
            modo: payload?.modo || 'RO',
            colunas: ['id', 'nome_fantasia'],
            linhas: [[1, 'Clínica Odonto Prime']],
            total_linhas: 1,
            linhas_afetadas: 0,
            truncado: false,
            duracao_ms: 8.2,
          },
        })
      }
      return Promise.reject(new Error(`URL POST não mockada: ${url}`))
    }),
    patch: vi.fn().mockResolvedValue({ data: { status: 'ok' } }),
  },
}))

function criarWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
}

describe('Sprint V9 — Suíte E2E e Hardening do Vendor Admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('V9.E2E-1: Fluxo de autenticação de operador no host público (/plataforma-admin/login)', async () => {
    const user = userEvent.setup()
    const Wrapper = criarWrapper()

    render(
      <Wrapper>
        <VendorLoginPage />
      </Wrapper>
    )

    expect(screen.getByText(/admin/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@proclinica.com.br')
    await user.type(screen.getByLabelText(/senha/i), 'ProClinica@2026')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(screen.queryByText(/entrando/i)).not.toBeInTheDocument()
    })
  })

  it('V9.E2E-2: Modal de provisionamento com auto-slugificação e cálculo de vigência', async () => {
    const user = userEvent.setup()
    const Wrapper = criarWrapper()

    render(
      <Wrapper>
        <ProvisionarTenantModal trigger={<button>Nova Clínica</button>} />
      </Wrapper>
    )

    await user.click(screen.getByRole('button', { name: /nova clínica/i }))

    expect(await screen.findByText(/provisionar nova clínica/i)).toBeInTheDocument()

    // Digita nome da clínica e confere auto-slugificação de schema
    const inputNome = screen.getByLabelText(/nome fantasia da clínica/i)
    await user.type(inputNome, 'Clínica Sorriso Dourado')

    const inputSchema = screen.getByLabelText(/schema postgresql/i)
    expect(inputSchema).toHaveValue('clinica_sorriso_dourado')
  })

  it('V9.E2E-3: Navegação entre abas de detalhes do tenant', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/tenants/1']}>
          <Routes>
            <Route path="/tenants/:id" element={<TenantDetalhesPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText('Clínica Odonto Prime')).toBeInTheDocument()

    // Confere presença das 7 abas
    expect(screen.getByRole('button', { name: /1\. Dados Gerais/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /2\. Assinatura/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /3\. Google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /4\. WhatsApp/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /5\. Métricas/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /6\. Suporte/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /7\. Trilha/i })).toBeInTheDocument()

    // Alterna para aba Assinatura
    await user.click(screen.getByRole('button', { name: /2\. Assinatura/i }))
    expect(await screen.findByText(/plano comercial/i)).toBeInTheDocument()
  })

  it('V9.E2E-4: Exibição da Página Institucional / Vendas no Domínio Raiz', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PaginaPublicaPlataforma />
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Landing page de vendas: headline do hero e seções institucionais.
    expect(
      screen.getByRole('heading', { level: 1, name: /gestão completa da sua clínica/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /módulos & recursos/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /um plano para cada fase/i })).toBeInTheDocument()
  })

  it('V9.E2E-5: Tratativa de 404 (Página Não Encontrada) com botão de navegação', () => {
    const Wrapper = criarWrapper()
    render(
      <Wrapper>
        <NaoEncontradaPage />
      </Wrapper>
    )

    expect(screen.getByText('404 | Não Encontrado')).toBeInTheDocument()
    expect(screen.getByText('Página Não Encontrada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /voltar/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /página inicial/i })).toBeInTheDocument()
  })

  it('V9.E2E-6: Execução de query no Database Studio', async () => {
    const user = userEvent.setup()
    const Wrapper = criarWrapper()

    render(
      <Wrapper>
        <DatabaseStudioPage />
      </Wrapper>
    )

    expect(await screen.findByText(/database studio/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /executar/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /executar/i }))
    expect(await screen.findByText('Clínica Odonto Prime')).toBeInTheDocument()
  })

  it('V9.E2E-7: Celery Monitor com switches e estado do Redis', async () => {
    const Wrapper = criarWrapper()

    render(
      <Wrapper>
        <CeleryMonitorPage />
      </Wrapper>
    )

    expect(await screen.findByText(/celery beat/i)).toBeInTheDocument()
    expect(screen.getByText(/sincronizar-google-incremental/i)).toBeInTheDocument()
    expect(screen.getByText('Conectado')).toBeInTheDocument()
  })
})
