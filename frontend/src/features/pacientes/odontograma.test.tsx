import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { Odontograma, type ProcedimentoDente } from './odontograma'

function Harness({ inicial = [] }: { inicial?: ProcedimentoDente[] }) {
  const [v, setV] = useState<ProcedimentoDente[]>(inicial)
  return (
    <>
      <Odontograma value={v} onChange={setV} />
      <pre data-testid="estado">{JSON.stringify(v)}</pre>
    </>
  )
}

describe('Odontograma', () => {
  it('clicar num dente adiciona um procedimento; edita a descrição e remove', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Dente 44' }))
    expect(screen.getByTestId('estado')).toHaveTextContent('[{"dente":44,"procedimento":""}]')

    await user.type(screen.getByLabelText('Procedimento 1'), 'Restauração')
    expect(screen.getByTestId('estado')).toHaveTextContent('"procedimento":"Restauração"')

    await user.click(screen.getByRole('button', { name: 'Remover procedimento 1' }))
    expect(screen.getByTestId('estado')).toHaveTextContent('[]')
  })

  it('"Adicionar procedimento" acrescenta uma linha e escolhe o dente no seletor', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: /adicionar procedimento/i }))
    await user.selectOptions(screen.getByLabelText('Dente do procedimento 1'), '22')
    await user.type(screen.getByLabelText('Procedimento 1'), 'Outra')
    expect(screen.getByTestId('estado')).toHaveTextContent('{"dente":22,"procedimento":"Outra"}')
  })

  it('clicar de novo num dente já selecionado remove (toggle)', async () => {
    const user = userEvent.setup()
    render(<Harness inicial={[{ dente: 44, procedimento: 'X' }]} />)
    expect(screen.getByRole('button', { name: 'Dente 44' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Dente 44' }))
    expect(screen.getByTestId('estado')).toHaveTextContent('[]')
  })

  it('destaca (aria-pressed) os dentes que têm procedimento', () => {
    render(<Harness inicial={[{ dente: 44, procedimento: 'X' }]} />)
    expect(screen.getByRole('button', { name: 'Dente 44' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Dente 22' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
