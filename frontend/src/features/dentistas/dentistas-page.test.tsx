import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DentistasPage } from './dentistas-page'

const { dentistasMock, sessaoMock } = vi.hoisted(() => ({
  dentistasMock: vi.fn(),
  sessaoMock: vi.fn(),
}))
vi.mock('./use-dentistas', () => ({ useDentistas: dentistasMock }))
vi.mock('@/features/auth/use-sessao', () => ({ useSessao: sessaoMock }))
vi.mock('./dentista-form-drawer', () => ({
  DentistaFormDrawer: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
}))
vi.mock('./acoes-dentista', () => ({ AcoesDentista: () => null }))

const AMOSTRA = [
  {
    id: 1,
    nome_completo: 'Dra. Ana Lima',
    cro: 'SP-111',
    especialidades: [1, 2],
    especialidades_nomes: ['Ortodontia', 'Endodontia'],
    ativo: true,
  },
  {
    id: 2,
    nome_completo: 'Dr. Bruno Sá',
    cro: 'SP-222',
    especialidades: [],
    especialidades_nomes: [],
    ativo: false,
  },
]

function preparar(papel: string, dentistas = AMOSTRA, extra = {}) {
  sessaoMock.mockReturnValue({ usuario: { papel }, carregando: false, erro: false })
  dentistasMock.mockReturnValue({ data: dentistas, isLoading: false, isError: false, ...extra })
}

describe('DentistasPage', () => {
  afterEach(() => {
    dentistasMock.mockReset()
    sessaoMock.mockReset()
  })

  it('lista com nome, CRO, especialidades (nomes) e status', () => {
    preparar('ADMIN')
    render(<DentistasPage />)
    expect(screen.getByText('Dra. Ana Lima')).toBeInTheDocument()
    expect(screen.getByText('Ortodontia, Endodontia')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Inativo')).toBeInTheDocument()
  })

  it('filtra pela busca (nome ou CRO)', async () => {
    preparar('ADMIN')
    const user = userEvent.setup()
    render(<DentistasPage />)
    await user.type(screen.getByPlaceholderText(/buscar por nome ou cro/i), 'bruno')
    expect(screen.getByText('Dr. Bruno Sá')).toBeInTheDocument()
    expect(screen.queryByText('Dra. Ana Lima')).not.toBeInTheDocument()
  })

  it('mostra "Novo dentista" para Gerente/Admin', () => {
    preparar('ADMIN')
    render(<DentistasPage />)
    expect(screen.getByRole('button', { name: /novo dentista/i })).toBeInTheDocument()
  })

  it('esconde "Novo dentista" para a Recepção', () => {
    preparar('RECEPCAO')
    render(<DentistasPage />)
    expect(screen.queryByRole('button', { name: /novo dentista/i })).not.toBeInTheDocument()
  })

  it('mostra estado vazio', () => {
    preparar('ADMIN', [])
    render(<DentistasPage />)
    expect(screen.getByText('Nenhum dentista cadastrado.')).toBeInTheDocument()
  })

  it('mostra erro', () => {
    preparar('ADMIN', [], { isError: true })
    render(<DentistasPage />)
    expect(screen.getByText('Não foi possível carregar os dentistas')).toBeInTheDocument()
  })
})
