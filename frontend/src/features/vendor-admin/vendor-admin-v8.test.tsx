import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DatabaseStudioPage } from './studio/database-studio-page'
import { CeleryMonitorPage } from './celery/celery-monitor-page'

// Mock do vendorApi
vi.mock('./vendor-api-client', () => ({
  vendorApi: {
    get: vi.fn().mockImplementation((url: string, config?: { params?: Record<string, string> }) => {
      // Database Studio: Schemas
      if (url.includes('/studio/schemas/')) {
        return Promise.resolve({
          data: {
            schemas: [
              { schema_name: 'public', total_tabelas: 12 },
              { schema_name: 'clinica_alfa', total_tabelas: 24 },
            ],
          },
        })
      }
      // Database Studio: Tables
      if (url.includes('/studio/tables/')) {
        const schema = config?.params?.schema || 'public'
        return Promise.resolve({
          data: {
            schema,
            tabelas: [
              {
                tabela: 'tenants_clinica',
                colunas: [
                  { nome: 'id', tipo: 'bigint', nullable: false, default: null, is_pk: true },
                  { nome: 'nome_fantasia', tipo: 'varchar(150)', nullable: false, default: null, is_pk: false },
                  { nome: 'ativo', tipo: 'boolean', nullable: false, default: 'true', is_pk: false },
                ],
              },
              {
                tabela: 'agenda_consulta',
                colunas: [
                  { nome: 'id', tipo: 'bigint', nullable: false, default: null, is_pk: true },
                  { nome: 'status', tipo: 'varchar(20)', nullable: false, default: null, is_pk: false },
                  { nome: 'inicio', tipo: 'timestamptz', nullable: false, default: null, is_pk: false },
                ],
              },
            ],
          },
        })
      }
      // Celery: Status do Cluster
      if (url.includes('/status')) {
        return Promise.resolve({
          data: {
            redis_conectado: true,
            tamanho_fila_celery: 3,
            workers_ativos: [{ nome: 'celery@worker-1', tarefas_ativas: 1 }],
            total_workers: 1,
          },
        })
      }
      if (url.includes('/celery')) {
        return Promise.resolve({
          data: [
            {
              id: 1,
              name: 'sincronizar-google-incremental',
              task: 'apps.integracoes.tasks.sincronizar_incremental_todos_tenants',
              enabled: true,
              description: 'Sincronização incremental do Google Calendar.',
              interval_display: 'a cada 15 minutes',
              crontab_display: '-',
              total_run_count: 42,
              last_run_at: '2026-08-20T10:00:00Z',
              every: 15,
              period: 'minutes',
            },
            {
              id: 2,
              name: 'disparar-lembretes-whatsapp',
              task: 'apps.notificacoes.tasks.disparar_lembretes_todos_tenants',
              enabled: false,
              description: 'Disparos de lembretes via WhatsApp.',
              interval_display: 'a cada 1 hours',
              crontab_display: '-',
              total_run_count: 10,
              last_run_at: null,
              every: 1,
              period: 'hours',
            },
          ],
        })
      }
      return Promise.reject(new Error(`URL não mockada: ${url}`))
    }),
    post: vi.fn().mockImplementation((url: string, payload?: Record<string, unknown>) => {
      if (url.includes('/studio/executar/')) {
        return Promise.resolve({
          data: {
            schema: payload?.schema || 'public',
            modo: payload?.modo || 'RO',
            colunas: ['id', 'nome_fantasia', 'ativo'],
            linhas: [
              [1, 'Clínica Sorriso Perfeito', true],
              [2, 'Odonto Central', false],
            ],
            total_linhas: 2,
            linhas_afetadas: 0,
            truncado: false,
            duracao_ms: 14.5,
          },
        })
      }
      if (url.includes('/disparar/')) {
        return Promise.resolve({
          data: {
            mensagem: 'Tarefa disparada com sucesso.',
            task_name: 'apps.integracoes.tasks.sincronizar_incremental_todos_tenants',
            task_id: 'task-uuid-mock-123',
          },
        })
      }
      return Promise.reject(new Error(`URL POST não mockada: ${url}`))
    }),
    patch: vi.fn().mockImplementation((url: string, payload?: Record<string, unknown>) => {
      if (url.includes('/celery/1/')) {
        return Promise.resolve({
          data: {
            id: 1,
            name: 'sincronizar-google-incremental',
            task: 'apps.integracoes.tasks.sincronizar_incremental_todos_tenants',
            enabled: payload?.enabled ?? true,
            description: 'Sincronização incremental do Google Calendar.',
            interval_display: payload?.every ? `a cada ${payload.every} ${payload.period}` : 'a cada 15 minutes',
            crontab_display: payload?.crontab_minute ? `${payload.crontab_minute} * * * *` : '-',
            total_run_count: 42,
            last_run_at: '2026-08-20T10:00:00Z',
          },
        })
      }
      return Promise.reject(new Error(`URL PATCH não mockada: ${url}`))
    }),
  },
}))

function renderComProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Sprint V8 — Frontend: Database Studio & Celery Monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  // --------------------------------------------------------------------------
  // 1. Database Studio Tests
  // --------------------------------------------------------------------------
  describe('Database Studio (SQL Console & Schema Explorer)', () => {
    it('deve renderizar o título, schemas e navegador de tabelas', async () => {
      renderComProviders(<DatabaseStudioPage />)

      expect(screen.getByRole('heading', { name: /database studio/i })).toBeInTheDocument()
      expect(screen.getByText('PostgreSQL')).toBeInTheDocument()

      // Verifica carregamento de schemas e tabelas
      await waitFor(() => {
        expect(screen.getByText(/public \(12 tab\)/i)).toBeInTheDocument()
        expect(screen.getByText('tenants_clinica')).toBeInTheDocument()
        expect(screen.getByText('agenda_consulta')).toBeInTheDocument()
      })
    })

    it('deve expandir tabela para exibir dicionário de colunas e chave primária', async () => {
      const user = userEvent.setup()
      renderComProviders(<DatabaseStudioPage />)

      await waitFor(() => {
        expect(screen.getByText('tenants_clinica')).toBeInTheDocument()
      })

      // Clica na tabela para expandir colunas
      await user.click(screen.getByText('tenants_clinica'))

      await waitFor(() => {
        expect(screen.getByText('nome_fantasia')).toBeInTheDocument()
        expect(screen.getByText('varchar(150)')).toBeInTheDocument()
      })
    })

    it('deve executar consulta SQL em modo Read-Only e exibir tabela de resultados', async () => {
      const user = userEvent.setup()
      renderComProviders(<DatabaseStudioPage />)

      const botaoExecutar = screen.getByRole('button', { name: /executar/i })
      await user.click(botaoExecutar)

      await waitFor(() => {
        expect(screen.getByText(/2 linhas retornadas/i)).toBeInTheDocument()
        expect(screen.getByText('Clínica Sorriso Perfeito')).toBeInTheDocument()
        expect(screen.getByText('Odonto Central')).toBeInTheDocument()
      })
    })

    it('deve abrir modal de justificativa ao tentar executar em modo Escrita (RW)', async () => {
      const user = userEvent.setup()
      renderComProviders(<DatabaseStudioPage />)

      // Alterna para modo RW
      const botaoRW = screen.getByRole('button', { name: /escrita \(rw\)/i })
      await user.click(botaoRW)

      // Clica em Executar
      const botaoExecutar = screen.getByRole('button', { name: /executar/i })
      await user.click(botaoExecutar)

      // Modal de justificativa deve aparecer
      await waitFor(() => {
        expect(screen.getByText(/confirmar execução em modo de escrita/i)).toBeInTheDocument()
        expect(screen.getByText(/ação crítica de superadministrador/i)).toBeInTheDocument()
      })

      // Valida que botão de confirmação está desabilitado com menos de 10 caracteres
      const textarea = screen.getByPlaceholderText(/ex: correção manual/i)
      const botaoConfirmar = screen.getByRole('button', { name: /confirmar & executar/i })

      expect(botaoConfirmar).toBeDisabled()

      await user.type(textarea, 'Correção emergencial de dados autorizada')
      expect(botaoConfirmar).not.toBeDisabled()
    })

    it('deve abrir modal de histórico de consultas e permitir reuso de query', async () => {
      const user = userEvent.setup()
      renderComProviders(<DatabaseStudioPage />)

      // Executa uma query primeiro
      await user.click(screen.getByRole('button', { name: /executar/i }))

      // Abre histórico
      const botaoHistorico = screen.getByRole('button', { name: /histórico/i })
      await user.click(botaoHistorico)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /histórico de consultas sql/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /usar query/i })).toBeInTheDocument()
      })
    })
  })

  // --------------------------------------------------------------------------
  // 2. Celery Monitor Tests
  // --------------------------------------------------------------------------
  describe('Celery Beat & Monitoramento de Filas', () => {
    it('deve renderizar os 4 KPI Cards de infraestrutura do cluster', async () => {
      renderComProviders(<CeleryMonitorPage />)

      expect(screen.getByRole('heading', { name: /celery beat & monitoramento de filas/i })).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText('Conectado')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument() // Fila celery
        expect(screen.getByText('1')).toBeInTheDocument() // Workers
      })
    })

    it('deve listar as tarefas periódicas com switches de status e botões de ação', async () => {
      renderComProviders(<CeleryMonitorPage />)

      await waitFor(() => {
        expect(screen.getByText('sincronizar-google-incremental')).toBeInTheDocument()
        expect(screen.getByText('disparar-lembretes-whatsapp')).toBeInTheDocument()
        expect(screen.getByText('a cada 15 minutes')).toBeInTheDocument()
      })

      expect(screen.getAllByRole('button', { name: /disparar/i })).toHaveLength(2)
      expect(screen.getAllByRole('button', { name: /editar/i })).toHaveLength(2)
    })

    it('deve permitir alternar o switch de status (enabled/disabled)', async () => {
      const user = userEvent.setup()
      renderComProviders(<CeleryMonitorPage />)

      await waitFor(() => {
        expect(screen.getByText('sincronizar-google-incremental')).toBeInTheDocument()
      })

      const switches = screen.getAllByRole('switch')
      expect(switches[0]).toHaveAttribute('aria-checked', 'true')

      // Clica para desabilitar
      await user.click(switches[0])
    })

    it('deve abrir modal de edição de frequência e permitir ajuste de agendamento', async () => {
      const user = userEvent.setup()
      renderComProviders(<CeleryMonitorPage />)

      await waitFor(() => {
        expect(screen.getByText('sincronizar-google-incremental')).toBeInTheDocument()
      })

      const botoesEditar = screen.getAllByRole('button', { name: /editar/i })
      await user.click(botoesEditar[0])

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /editar frequência da tarefa/i })).toBeInTheDocument()
        expect(screen.getByLabelText(/a cada \(valor\):/i)).toHaveValue(15)
      })

      // Alterna para aba de Expressão Cron
      const botaoCron = screen.getByRole('button', { name: /expressão cron/i })
      await user.click(botaoCron)

      expect(screen.getByText(/minuto:/i)).toBeInTheDocument()
      expect(screen.getByText(/hora:/i)).toBeInTheDocument()
      expect(screen.getByText(/dia semana:/i)).toBeInTheDocument()
    })
  })
})
