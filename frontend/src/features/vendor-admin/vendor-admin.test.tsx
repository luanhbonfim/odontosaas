import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { VendorLoginPage } from './vendor-login-page'
import { VendorShell } from './vendor-shell'
import { VendorDashboardPage } from './vendor-dashboard-page'
import { vendorTokenStore } from './vendor-token-store'

// Mock useVendorAuth para testes de Login e Shell
vi.mock('./use-vendor-auth', () => ({
  useVendorAuth: () => ({
    entrar: vi.fn().mockResolvedValue(undefined),
    sair: vi.fn(),
    operador: {
      email: 'root@plataforma.cloud',
      nome: 'Root Operator',
      is_staff: true,
      is_superuser: true,
    },
    autenticado: true,
  }),
}))

// Mock de chamadas à API do Vendor
vi.mock('./vendor-api-client', () => ({
  vendorApi: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/tenants/')) {
        return Promise.resolve({
          data: [
            {
              id: 1,
              schema_name: 'clinica_alfa',
              nome_fantasia: 'Clínica Alfa',
              razao_social: 'Alfa Odontologia LTDA',
              cnpj: '11222333000199',
              ativo: true,
              status_assinatura: 'ATIVA',
              plano_assinatura: { id: 1, nome: 'Plano Pro', preco_mensal: 299.9 },
              vigencia_fim: '2026-12-31',
              criado_em: '2026-01-01T00:00:00Z',
            },
            {
              id: 2,
              schema_name: 'clinica_beta',
              nome_fantasia: 'Clínica Beta',
              razao_social: 'Beta Odontologia LTDA',
              cnpj: '22333444000188',
              ativo: false,
              status_assinatura: 'INADIMPLENTE',
              plano_assinatura: { id: 2, nome: 'Plano Básico', preco_mensal: 149.9 },
              vigencia_fim: '2026-02-01',
              criado_em: '2026-01-15T00:00:00Z',
            },
          ],
        })
      }
      if (url.includes('/celery/tarefas/status/')) {
        return Promise.resolve({
          data: {
            redis_conectado: true,
            filas: [{ nome: 'celery', tamanho: 0 }],
            workers: [{ nome: 'celery@worker1', status: 'ONLINE' }],
            total_workers_online: 1,
          },
        })
      }
      if (url.includes('/planos/')) {
        return Promise.resolve({
          data: [
            {
              id: 1,
              nome: 'Plano Pro',
              preco_mensal: 299.9,
              periodicidade: 'MENSAL',
              limite_dentistas: 5,
              limite_usuarios: 10,
            },
          ],
        })
      }
      return Promise.resolve({ data: {} })
    }),
    post: vi.fn().mockResolvedValue({ data: { access: 'jwt-access', refresh: 'jwt-refresh' } }),
  },
}))

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

function renderComQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Vendor Admin - Sprint V6', () => {
  it('renderiza formulário de login de operador com opção 2FA', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <VendorLoginPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Painel da Plataforma')).toBeInTheDocument()
    expect(screen.getByText(/Vendor Admin/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/E-mail institucional/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Senha/i)).toBeInTheDocument()

    // Clica para exibir campo 2FA
    const botaoMfa = screen.getByRole('button', { name: /Adicionar código 2FA/i })
    await user.click(botaoMfa)

    expect(screen.getByLabelText(/Código 2FA/i)).toBeInTheDocument()
  })

  it('renderiza o layout VendorShell com links de navegação e dados do operador', () => {
    render(
      <MemoryRouter initialEntries={['/plataforma-admin']}>
        <Routes>
          <Route path="/plataforma-admin" element={<VendorShell />}>
            <Route index element={<div>Página Conteúdo Vendor</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Clínicas / Tenants')).toBeInTheDocument()
    expect(screen.getByText('Planos de Assinatura')).toBeInTheDocument()
    expect(screen.getByText('Database Studio')).toBeInTheDocument()
    expect(screen.getByText('Celery Beat & Filas')).toBeInTheDocument()
    expect(screen.getByText('Trilha de Auditoria')).toBeInTheDocument()
    expect(screen.getByText('[PAINEL DA PLATAFORMA]')).toBeInTheDocument()
    expect(screen.getByText('Página Conteúdo Vendor')).toBeInTheDocument()
  })

  it('renderiza o Dashboard do Vendor com KPIs e métricas consolidadas', async () => {
    renderComQueryClient(<VendorDashboardPage />)

    expect(screen.getByText('Visão Geral da Plataforma')).toBeInTheDocument()
    expect(screen.getByText('Total Clínicas')).toBeInTheDocument()
    expect(screen.getByText('Ativas')).toBeInTheDocument()
    expect(screen.getByText('A Vencer (15d)')).toBeInTheDocument()
    expect(screen.getByText('Planos Vencidos')).toBeInTheDocument()
    expect(screen.getByText('Bloqueadas')).toBeInTheDocument()
    expect(screen.getByText('MRR Estimado')).toBeInTheDocument()

    // Aguarda preenchimento dos dados do mock
    expect(await screen.findByText('Clínica Alfa')).toBeInTheDocument()
    expect(screen.getByText('clinica_alfa')).toBeInTheDocument()
    expect(screen.getAllByText('Clínica Beta').length).toBeGreaterThan(0)
    expect(screen.getByText('clinica_beta')).toBeInTheDocument()
  })

  it('testa vendorTokenStore definir e limpar sessão', () => {
    vendorTokenStore.definir({
      access: 'test-access',
      refresh: 'test-refresh',
      operador: { email: 'op@test.com', is_staff: true },
    })

    expect(vendorTokenStore.autenticado).toBe(true)
    expect(vendorTokenStore.access).toBe('test-access')
    expect(vendorTokenStore.refresh).toBe('test-refresh')
    expect(vendorTokenStore.operador?.email).toBe('op@test.com')

    vendorTokenStore.limpar()
    expect(vendorTokenStore.autenticado).toBe(false)
    expect(vendorTokenStore.access).toBeNull()
  })
})
