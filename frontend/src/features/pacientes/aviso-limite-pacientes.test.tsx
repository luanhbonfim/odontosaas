import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { violacoesAxe } from '@/test/axe'

import { AvisoLimitePacientes } from './aviso-limite-pacientes'

const { cotaMock, sessaoMock } = vi.hoisted(() => ({ cotaMock: vi.fn(), sessaoMock: vi.fn() }))
vi.mock('./use-pacientes', () => ({ useCotaPacientes: cotaMock }))
vi.mock('@/features/auth/use-sessao', () => ({ useSessao: sessaoMock }))

const cota = (sobrescrever = {}) => ({
  data: {
    atual: 50,
    limite: 100,
    ilimitado: false,
    percentual: 50,
    atingiu_limite: false,
    proximo_do_limite: false,
    ...sobrescrever,
  },
})

function renderizar() {
  return render(
    <MemoryRouter>
      <AvisoLimitePacientes />
    </MemoryRouter>,
  )
}

describe('AvisoLimitePacientes', () => {
  afterEach(() => vi.clearAllMocks())

  it('não aparece com folga, ilimitado ou sem dados', () => {
    sessaoMock.mockReturnValue({ usuario: { papel: 'ADMIN' } })
    cotaMock.mockReturnValue(cota())
    const { container, rerender } = renderizar()
    expect(container).toBeEmptyDOMElement()

    cotaMock.mockReturnValue(cota({ ilimitado: true, limite: null }))
    rerender(
      <MemoryRouter>
        <AvisoLimitePacientes />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()

    cotaMock.mockReturnValue({ data: undefined })
    rerender(
      <MemoryRouter>
        <AvisoLimitePacientes />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('perto do limite: aviso (status) com link do plano para gerente/admin', async () => {
    sessaoMock.mockReturnValue({ usuario: { papel: 'DENTISTA_GERENTE' } })
    cotaMock.mockReturnValue(cota({ atual: 92, percentual: 92, proximo_do_limite: true }))
    const { container } = renderizar()
    expect(screen.getByRole('status')).toHaveTextContent('92 de 100 pacientes ativos.')
    expect(screen.getByRole('link', { name: /upgrade/i })).toHaveAttribute('href', '/meu-plano')
    expect(await violacoesAxe(container)).toEqual([])
  })

  it('limite atingido: alerta de bloqueio; recepção é orientada a falar com o gerente', () => {
    sessaoMock.mockReturnValue({ usuario: { papel: 'RECEPCAO' } })
    cotaMock.mockReturnValue(
      cota({ atual: 100, percentual: 100, atingiu_limite: true, proximo_do_limite: true }),
    )
    renderizar()
    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent('não é possível cadastrar nem reativar')
    expect(alerta).toHaveTextContent('peça ao gerente')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
