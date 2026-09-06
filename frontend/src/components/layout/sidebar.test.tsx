import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Papel, PermissoesModulo } from '@/features/auth/use-sessao'

import { Sidebar } from './sidebar'

const { sessaoMock } = vi.hoisted(() => ({ sessaoMock: vi.fn() }))
vi.mock('@/features/auth/use-sessao', () => ({ useSessao: sessaoMock }))

// Espelha os defaults atuais da MATRIZ (apps/usuarios/perfis.py) pros papéis
// personalizáveis — ADMIN/DENTISTA_GERENTE nunca têm mapa (sempre visível).
const PERMISSOES_RECEPCAO: PermissoesModulo = {
  agenda: { ver: true, criar: true, editar: true, excluir: true },
  pacientes: { ver: true, criar: true, editar: true, excluir: true },
  convenios: { ver: true, criar: true, editar: true, excluir: true },
  dentistas: { ver: true, criar: false, editar: false, excluir: false },
  procedimentos: { ver: true, criar: true, editar: true, excluir: true },
  estoque: { ver: true, criar: true, editar: true, excluir: true },
  financeiro: { ver: true, criar: true, editar: true, excluir: true },
  notificacoes: { ver: true, criar: true, editar: true, excluir: true },
  usuarios: { ver: false, criar: false, editar: false, excluir: false },
}
const PERMISSOES_DENTISTA: PermissoesModulo = {
  agenda: { ver: true, criar: true, editar: true, excluir: true },
  pacientes: { ver: true, criar: true, editar: true, excluir: true },
  convenios: { ver: true, criar: false, editar: false, excluir: false },
  dentistas: { ver: true, criar: false, editar: false, excluir: false },
  procedimentos: { ver: true, criar: true, editar: true, excluir: true },
  estoque: { ver: true, criar: false, editar: false, excluir: false },
  financeiro: { ver: false, criar: false, editar: false, excluir: false },
  notificacoes: { ver: false, criar: false, editar: false, excluir: false },
  usuarios: { ver: false, criar: false, editar: false, excluir: false },
}

function renderComPapel(papel: Papel | null, permissoesModulo?: PermissoesModulo) {
  sessaoMock.mockReturnValue({
    usuario: papel ? { papel, permissoesModulo } : null,
    carregando: false,
    erro: false,
  })
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  )
}

describe('Sidebar (menu por papel)', () => {
  afterEach(() => sessaoMock.mockReset())

  it('ADMIN vê todos os módulos', () => {
    renderComPapel('ADMIN')
    const modulos = [
      'Dashboard',
      'Agenda',
      'Pacientes',
      'Dentistas',
      // Estoque virou módulo com telas separadas (Operação):
      'Insumos',
      'Categorias',
      'Movimentações',
      'Fornecedores',
      'Alertas',
      // Financeiro virou módulo com telas separadas:
      'Visão Geral',
      'Contas a Receber',
      'Contas a Pagar',
      'WhatsApp',
      'Integrações',
      'Equipe',
      'Permissões',
    ]
    for (const modulo of modulos) {
      expect(screen.getByRole('link', { name: modulo })).toBeInTheDocument()
    }
  })

  it('RECEPCAO vê Financeiro (permissão padrão) mas não vê Integrações nem Permissões', () => {
    renderComPapel('RECEPCAO', PERMISSOES_RECEPCAO)
    expect(screen.getByRole('link', { name: 'Contas a Receber' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Integrações' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Permissões' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toBeInTheDocument()
    // Equipe é sempre False por padrão (fora da MATRIZ da Recepção hoje).
    expect(screen.queryByRole('link', { name: 'Equipe' })).not.toBeInTheDocument()
  })

  it('DENTISTA não vê Financeiro nem WhatsApp (mas vê Integrações)', () => {
    renderComPapel('DENTISTA', PERMISSOES_DENTISTA)
    expect(screen.queryByRole('link', { name: 'Contas a Receber' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument()
    // Integrações é aberto ao dentista (vê a sua); e os módulos gerais.
    expect(screen.getByRole('link', { name: 'Integrações' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Agenda' })).toBeInTheDocument()
    // Dentista agora também cadastra procedimentos (com valor).
    expect(screen.getByRole('link', { name: 'Procedimentos' })).toBeInTheDocument()
  })

  it('Gerente/Admin revoga "Ver" de Convênios da Recepção -> some do menu dela', () => {
    renderComPapel('RECEPCAO', {
      ...PERMISSOES_RECEPCAO,
      convenios: { ver: false, criar: false, editar: false, excluir: false },
    })
    expect(screen.queryByRole('link', { name: 'Convênios' })).not.toBeInTheDocument()
    // O resto do menu dela continua intacto.
    expect(screen.getByRole('link', { name: 'Agenda' })).toBeInTheDocument()
  })

  it('sem sessão carregada, oculta os itens restritos por papel fixo', () => {
    renderComPapel(null)
    // Permissões/Integrações continuam com restrição fixa de papel (não são
    // personalizáveis) — só essas dependem só do papel, sem precisar do mapa.
    expect(screen.queryByRole('link', { name: 'Permissões' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Integrações' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('ADMIN não vê Integrações nem WhatsApp quando desabilitados no plano da clínica', () => {
    sessaoMock.mockReturnValue({
      usuario: {
        papel: 'ADMIN',
        clinica: {
          schema: 'demo',
          nomeFantasia: 'Demo',
          modulos: {
            google_calendar: false,
            whatsapp: false,
            financeiro: true,
            estoque: true,
          },
        },
      },
      carregando: false,
      erro: false,
    })
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: 'Integrações' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Contas a Receber' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Insumos' })).toBeInTheDocument()
  })
})
