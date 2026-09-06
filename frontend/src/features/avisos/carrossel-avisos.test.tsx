import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CarrosselAvisos } from './carrossel-avisos'

const { avisosAtivosMock } = vi.hoisted(() => ({ avisosAtivosMock: vi.fn() }))
vi.mock('./use-avisos', () => ({ useAvisosAtivos: avisosAtivosMock }))

const AVISO_1 = {
  id: 1,
  titulo: 'Novo módulo de Estoque',
  descricao: 'Compras e fornecedores.',
  imagem_url: '',
  icone: 'megafone',
  link_url: '',
  link_rotulo: '',
}
const AVISO_2 = {
  id: 2,
  titulo: 'Parcelamento na consulta',
  descricao: '',
  imagem_url: '',
  icone: 'sparkles',
  link_url: 'https://exemplo.com/novidades',
  link_rotulo: 'Ver detalhes',
}

describe('CarrosselAvisos', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })
  afterEach(() => vi.clearAllMocks())

  it('não renderiza nada quando não há avisos vigentes', () => {
    avisosAtivosMock.mockReturnValue({ data: [] })
    render(<CarrosselAvisos />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('abre sozinho quando há avisos e a sessão ainda não dispensou', () => {
    avisosAtivosMock.mockReturnValue({ data: [AVISO_1] })
    render(<CarrosselAvisos />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Novo módulo de Estoque')).toBeInTheDocument()
    expect(screen.getByText('Compras e fornecedores.')).toBeInTheDocument()
  })

  it('não abre se já foi dispensado nesta sessão', () => {
    sessionStorage.setItem('avisos_dispensados', '1')
    avisosAtivosMock.mockReturnValue({ data: [AVISO_1] })
    render(<CarrosselAvisos />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('navega entre slides e mostra o link do aviso', async () => {
    avisosAtivosMock.mockReturnValue({ data: [AVISO_1, AVISO_2] })
    const user = userEvent.setup()
    render(<CarrosselAvisos />)

    expect(screen.getByText('Novo módulo de Estoque')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /próximo aviso/i }))
    expect(screen.getByText('Parcelamento na consulta')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver detalhes' })).toHaveAttribute(
      'href',
      'https://exemplo.com/novidades',
    )

    await user.click(screen.getByRole('button', { name: /aviso anterior/i }))
    expect(screen.getByText('Novo módulo de Estoque')).toBeInTheDocument()
  })

  it('fechar seta o sessionStorage e não reabre no mesmo render', async () => {
    avisosAtivosMock.mockReturnValue({ data: [AVISO_1] })
    const user = userEvent.setup()
    render(<CarrosselAvisos />)

    await user.click(screen.getByRole('button', { name: /^fechar$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(sessionStorage.getItem('avisos_dispensados')).toBe('1')
  })
})
