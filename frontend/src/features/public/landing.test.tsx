import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/test/server'

import { PaginaPublicaPlataforma } from './pagina-publica-plataforma'
import { gerarLinkWhatsApp, NUMERO_COMERCIAL } from './whatsapp'
import type { PlanoPublico } from './use-planos-publicos'

const PLANOS: PlanoPublico[] = [
  {
    id: 1,
    nome: 'Básico',
    periodicidade: 'MENSAL',
    preco_mensal: '149.00',
    preco_anual: '1430.00',
    limite_dentistas: 2,
    limite_usuarios: 4,
    limite_pacientes_ativos: 500,
    limite_armazenamento_mb: 2048,
    modulo_financeiro_ativo: false,
    modulo_estoque_ativo: false,
    sync_google_ativo: true,
    whatsapp_waha_ativo: false,
  },
  {
    id: 2,
    nome: 'Profissional',
    periodicidade: 'MENSAL',
    preco_mensal: '299.00',
    preco_anual: '2870.00',
    limite_dentistas: 6,
    limite_usuarios: 12,
    limite_pacientes_ativos: 3000,
    limite_armazenamento_mb: 10240,
    modulo_financeiro_ativo: true,
    modulo_estoque_ativo: true,
    sync_google_ativo: true,
    whatsapp_waha_ativo: true,
  },
]

function mockPlanos(dados: PlanoPublico[] = PLANOS) {
  server.use(http.get('/api/plataforma/planos/', () => HttpResponse.json(dados)))
}

function renderLanding() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PaginaPublicaPlataforma />
    </QueryClientProvider>,
  )
}

describe('Landing page — PaginaPublicaPlataforma', () => {
  it('renderiza as seções principais', async () => {
    mockPlanos()
    renderLanding()

    // Hero
    expect(
      screen.getByRole('heading', { level: 1, name: /gestão completa da sua clínica/i }),
    ).toBeInTheDocument()
    // Recursos, Integrações, Planos, FAQ
    expect(screen.getByRole('heading', { name: /módulos & recursos/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /conectado às ferramentas/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /um plano para cada fase/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /ainda com dúvidas/i })).toBeInTheDocument()

    // Planos carregados do backend mockado
    expect(await screen.findByRole('heading', { name: 'Profissional' })).toBeInTheDocument()
  })

  it('alterna entre mensal e anual mudando o preço exibido', async () => {
    mockPlanos()
    const user = userEvent.setup()
    renderLanding()

    const cardProfissional = (await screen.findByRole('heading', { name: 'Profissional' }))
      .closest('article') as HTMLElement
    const card = within(cardProfissional)

    // Padrão: mensal → R$ 299
    expect(card.getByText(/R\$\s?299/)).toBeInTheDocument()

    // Alterna para anual → R$ 2.870 + badge de economia
    await user.click(screen.getByRole('button', { name: /anual/i }))

    await waitFor(() => expect(card.getByText(/R\$\s?2\.870/)).toBeInTheDocument())
    expect(card.getByText(/economize/i)).toBeInTheDocument()
    expect(card.queryByText(/R\$\s?299\b/)).toBeNull()
  })

  it('gera o link de WhatsApp com número comercial e mensagem do plano', async () => {
    mockPlanos()
    renderLanding()

    const link = (await screen.findByRole('link', {
      name: /contratar profissional/i,
    })) as HTMLAnchorElement

    expect(link.href).toContain(`https://wa.me/${NUMERO_COMERCIAL}`)
    expect(decodeURIComponent(link.href)).toContain('Plano Profissional (Mensal)')
  })

  it('usa o fallback estático quando o endpoint falha', async () => {
    server.use(
      http.get('/api/plataforma/planos/', () => new HttpResponse(null, { status: 500 })),
    )
    renderLanding()

    // Planos de fallback (Básico/Profissional/Enterprise) — aguarda o retry do hook
    expect(
      await screen.findByRole('heading', { name: 'Enterprise' }, { timeout: 5000 }),
    ).toBeInTheDocument()
  })
})

describe('gerarLinkWhatsApp', () => {
  it('monta a URL com a periodicidade legível', () => {
    const link = gerarLinkWhatsApp('Enterprise', 'ANUAL')
    expect(link).toContain(`https://wa.me/${NUMERO_COMERCIAL}?text=`)
    expect(decodeURIComponent(link)).toContain(
      'Olá! Tenho interesse no Plano Enterprise (Anual) do PróClínica Cloud.',
    )
  })
})
