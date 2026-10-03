import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BuscaGlobal } from './busca-global'

const { buscaMock } = vi.hoisted(() => ({ buscaMock: vi.fn() }))
vi.mock('./use-busca', () => ({ MIN_CARACTERES_BUSCA: 2, useBusca: buscaMock }))
// Sem atraso no teste: o debounce é testado à parte.
vi.mock('@/lib/hooks/use-debounce', () => ({ useDebounce: (valor: string) => valor }))

const RESULTADO = {
  pacientes: [
    { id: 7, nome_completo: 'Ana Beatriz', cpf: '11122233344', ativo: true, telefone_whatsapp: '' },
  ],
  consultas: [
    {
      id: 21,
      inicio: '2026-10-07T12:00:00Z',
      status: 'AGENDADA',
      paciente_id: 7,
      paciente_nome: 'Ana Beatriz',
      dentista_nome: 'Dr. Um',
      procedimento: 'Limpeza',
    },
  ],
}

function Local() {
  const l = useLocation()
  return <p data-testid="local">{l.pathname + l.search}</p>
}

function renderBusca() {
  render(
    <MemoryRouter>
      <BuscaGlobal />
      <Local />
    </MemoryRouter>,
  )
}

async function abrirEDigitar(user: ReturnType<typeof userEvent.setup>, texto: string) {
  await user.click(screen.getByRole('button', { name: 'Buscar paciente ou consulta' }))
  await user.type(screen.getByRole('combobox'), texto)
}

describe('BuscaGlobal', () => {
  afterEach(() => vi.clearAllMocks())

  it('abre pelo botão, pede 2+ caracteres e mostra os grupos com resultados', async () => {
    buscaMock.mockReturnValue({ data: undefined, isFetching: false, isError: false })
    const user = userEvent.setup()
    renderBusca()
    await user.click(screen.getByRole('button', { name: 'Buscar paciente ou consulta' }))
    expect(screen.getByText('Digite ao menos 2 caracteres.')).toBeInTheDocument()

    buscaMock.mockReturnValue({ data: RESULTADO, isFetching: false, isError: false })
    await user.type(screen.getByRole('combobox'), 'ana')
    expect(screen.getByText('Pacientes')).toBeInTheDocument()
    expect(screen.getByText('Consultas')).toBeInTheDocument()
    expect(screen.getByText('111.222.333-44')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('clicar num paciente navega para a ficha e fecha', async () => {
    buscaMock.mockReturnValue({ data: RESULTADO, isFetching: false, isError: false })
    const user = userEvent.setup()
    renderBusca()
    await abrirEDigitar(user, 'ana')
    await user.click(screen.getAllByRole('option')[0])
    expect(screen.getByTestId('local')).toHaveTextContent('/pacientes/7')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('↓ + Enter abre a consulta na agenda (deep link)', async () => {
    buscaMock.mockReturnValue({ data: RESULTADO, isFetching: false, isError: false })
    const user = userEvent.setup()
    renderBusca()
    await abrirEDigitar(user, 'ana')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(screen.getByTestId('local')).toHaveTextContent('/agenda?consulta=21')
  })

  it('bloco null (sem permissão) não aparece', async () => {
    buscaMock.mockReturnValue({
      data: { pacientes: RESULTADO.pacientes, consultas: null },
      isFetching: false,
      isError: false,
    })
    const user = userEvent.setup()
    renderBusca()
    await abrirEDigitar(user, 'ana')
    expect(screen.getByText('Pacientes')).toBeInTheDocument()
    expect(screen.queryByText('Consultas')).not.toBeInTheDocument()
  })

  it('mostra vazio e erro', async () => {
    buscaMock.mockReturnValue({
      data: { pacientes: [], consultas: [] },
      isFetching: false,
      isError: false,
    })
    const user = userEvent.setup()
    renderBusca()
    await abrirEDigitar(user, 'zzz')
    expect(screen.getByText('Nenhum resultado.')).toBeInTheDocument()

    buscaMock.mockReturnValue({ data: undefined, isFetching: false, isError: true })
    await user.type(screen.getByRole('combobox'), 'z')
    expect(screen.getByText('Não foi possível buscar. Tente novamente.')).toBeInTheDocument()
  })

  it('Ctrl+K abre a busca', () => {
    buscaMock.mockReturnValue({ data: undefined, isFetching: false, isError: false })
    renderBusca()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
