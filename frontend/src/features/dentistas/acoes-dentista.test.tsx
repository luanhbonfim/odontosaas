import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AcoesDentista } from './acoes-dentista'
import type { Dentista } from './use-dentistas'

const { removerMock } = vi.hoisted(() => ({ removerMock: vi.fn() }))
vi.mock('./use-dentistas', () => ({ useRemoverDentista: () => ({ mutateAsync: removerMock }) }))
// O drawer de edição é testado à parte; aqui isolamos as ações.
vi.mock('./dentista-form-drawer', () => ({ DentistaFormDrawer: () => null }))

const DENTISTA = { id: 7, nome_completo: 'Dr. Bruno Sá', cro: 'SP-2' } as unknown as Dentista

describe('AcoesDentista', () => {
  afterEach(() => vi.clearAllMocks())

  it('excluir pede confirmação e chama a remoção', async () => {
    removerMock.mockResolvedValue({})
    const user = userEvent.setup()
    render(<AcoesDentista dentista={DENTISTA} />)

    // não remove antes de confirmar
    await user.click(screen.getByRole('button', { name: /excluir dr\. bruno sá/i }))
    expect(await screen.findByText('Excluir dentista?')).toBeInTheDocument()
    expect(removerMock).not.toHaveBeenCalled()

    // confirma
    await user.click(screen.getByRole('button', { name: /^excluir$/i }))
    await waitFor(() => expect(removerMock).toHaveBeenCalledWith(7))
  })
})
