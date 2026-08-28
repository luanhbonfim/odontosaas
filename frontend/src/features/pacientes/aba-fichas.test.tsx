import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AbaFichas } from './aba-fichas'

const { fichasMock } = vi.hoisted(() => ({ fichasMock: vi.fn() }))
vi.mock('./use-paciente-detalhe', () => ({ useFichasDoPaciente: fichasMock }))

function renderizar() {
  return render(
    <MemoryRouter>
      <AbaFichas pacienteId={5} />
    </MemoryRouter>,
  )
}

describe('AbaFichas', () => {
  afterEach(() => vi.clearAllMocks())

  it('vazio: mostra aviso de nenhuma ficha', () => {
    fichasMock.mockReturnValue({ data: [], isLoading: false })
    renderizar()
    expect(screen.getByText('Nenhuma ficha registrada.')).toBeInTheDocument()
  })

  it('lista ficha avulsa e ficha vinculada a consulta', () => {
    fichasMock.mockReturnValue({
      data: [
        {
          id: 1,
          consulta: null,
          dentes: [],
          anotacoes: '',
          criado_em: '2026-07-01T12:00:00Z',
        },
        {
          id: 2,
          consulta: 10,
          consulta_inicio: '2026-07-05T13:00:00Z',
          consulta_dentista_nome: 'Dra. Ana',
          dentes: [{ dente: 44, procedimento: 'Restauração' }],
          anotacoes: 'Restauração no 44.',
          criado_em: '2026-07-05T13:30:00Z',
        },
      ],
      isLoading: false,
    })
    renderizar()

    expect(screen.getByText(/ficha avulsa/i)).toBeInTheDocument()
    expect(screen.getByText(/consulta em/i)).toBeInTheDocument()
    expect(screen.getByText('Dra. Ana', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Odontograma ainda não preenchido.')).toBeInTheDocument()
    expect(screen.getByText('1 dente(s) tratado(s).')).toBeInTheDocument()
    expect(screen.getByText('Restauração no 44.')).toBeInTheDocument()
  })

  it('link "Nova ficha" aponta pra rota de criação', () => {
    fichasMock.mockReturnValue({ data: [], isLoading: false })
    renderizar()
    expect(screen.getByRole('link', { name: /nova ficha/i })).toHaveAttribute(
      'href',
      '/pacientes/5/fichas/nova',
    )
  })
})
