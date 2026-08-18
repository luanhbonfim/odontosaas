import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgendaPage } from './agenda-page'

const { consultasMock, atualizarMock, revertMock, changeViewMock } = vi.hoisted(() => ({
  consultasMock: vi.fn(),
  atualizarMock: vi.fn(),
  revertMock: vi.fn(),
  changeViewMock: vi.fn(),
}))

type Vista = { type: string }
type FCProps = {
  events: { id: string; title: string; backgroundColor: string }[]
  eventDisplay: string
  select: (info: { start: Date; end: Date; view: Vista }) => void
  dateClick: (info: { dateStr: string; view: Vista }) => void
  eventClick: (info: { event: { id: string } }) => void
  eventDrop: (info: {
    event: { id: string; start: Date; end: Date | null }
    revert: () => void
  }) => void
}

// FullCalendar é frágil no jsdom -> mock (forwardRef p/ expor getApi().changeView)
// que dispara as interações via botões, carregando a vista (view.type) do gatilho.
vi.mock('@fullcalendar/react', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    default: React.forwardRef((props: FCProps, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({ getApi: () => ({ changeView: changeViewMock }) }))
      const slot = { start: new Date('2026-08-10T09:00'), end: new Date('2026-08-10T09:30') }
      return (
        <div data-testid="calendario" data-event-display={props.eventDisplay}>
          {props.events.map((e) => (
            <button
              key={e.id}
              data-cor={e.backgroundColor}
              onClick={() => props.eventClick({ event: { id: e.id } })}
            >
              {e.title}
            </button>
          ))}
          <button onClick={() => props.select({ ...slot, view: { type: 'timeGridWeek' } })}>
            slot-semana
          </button>
          <button onClick={() => props.select({ ...slot, view: { type: 'dayGridMonth' } })}>
            slot-mes
          </button>
          <button
            onClick={() =>
              props.dateClick({ dateStr: '2026-08-10', view: { type: 'dayGridMonth' } })
            }
          >
            dia-mes
          </button>
          <button
            onClick={() =>
              props.eventDrop({
                event: {
                  id: '1',
                  start: new Date('2026-08-11T10:00'),
                  end: new Date('2026-08-11T10:30'),
                },
                revert: revertMock,
              })
            }
          >
            arrastar
          </button>
        </div>
      )
    }),
  }
})
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }))
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }))
vi.mock('@fullcalendar/interaction', () => ({ default: {} }))
// Modal isolado (testado à parte) -> só mostra "modo:identificador".
vi.mock('./consulta-modal', () => ({
  ConsultaModal: ({
    estado,
  }: {
    estado: { modo: string; consulta?: { id: number }; inicio?: string } | null
  }) =>
    estado ? (
      <div data-testid="modal">
        {estado.modo}:{estado.modo === 'criar' ? estado.inicio : estado.consulta!.id}
      </div>
    ) : null,
}))
vi.mock('./use-agenda', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./use-agenda')>()),
  useConsultas: consultasMock,
  useAtualizarConsulta: () => ({ mutateAsync: atualizarMock }),
}))

const CONSULTA_AG = {
  id: 1,
  paciente_nome: 'João',
  procedimento: 'Limpeza',
  inicio: '2026-08-10T13:00:00Z',
  fim: '2026-08-10T13:30:00Z',
  status: 'AGENDADA',
  status_confirmacao: 'PENDENTE',
  dentista_nome: 'Ana',
}
const CONSULTA_RE = {
  id: 2,
  paciente_nome: 'Maria',
  procedimento: 'Extração',
  inicio: '2026-08-10T15:00:00Z',
  fim: '2026-08-10T15:30:00Z',
  status: 'REALIZADA',
  status_confirmacao: 'CONFIRMADA',
  dentista_nome: 'Ana',
}

function renderPage() {
  render(
    <MemoryRouter>
      <AgendaPage />
    </MemoryRouter>,
  )
}

describe('AgendaPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('renderiza o calendário com eventos coloridos + legenda', () => {
    consultasMock.mockReturnValue({ data: [CONSULTA_AG, CONSULTA_RE], isError: false })
    renderPage()
    expect(screen.getByRole('heading', { name: 'Agenda' })).toBeInTheDocument()
    // AGENDADA + PENDENTE -> azul; REALIZADA -> verde-escuro.
    expect(screen.getByText('João — Limpeza')).toHaveAttribute('data-cor', '#3b82f6')
    expect(screen.getByText('Maria — Extração')).toHaveAttribute('data-cor', '#15803d')
    expect(screen.getByText('Agendada (Confirmada)')).toBeInTheDocument() // legenda nova
    expect(screen.getByText('Faltou')).toBeInTheDocument()
    // Fundo preenchido (bloco), não a "bolinha" do mês.
    expect(screen.getByTestId('calendario')).toHaveAttribute('data-event-display', 'block')
  })

  it('mostra erro quando a carga falha', () => {
    consultasMock.mockReturnValue({ data: undefined, isError: true })
    renderPage()
    expect(screen.queryByTestId('calendario')).toBeNull()
    expect(screen.getByText(/não foi possível carregar a agenda/i)).toBeInTheDocument()
  })

  it('clicar num horário livre (semana) abre o modal de agendar', async () => {
    consultasMock.mockReturnValue({ data: [], isError: false })
    renderPage()
    await userEvent.setup().click(screen.getByRole('button', { name: 'slot-semana' }))
    expect(screen.getByTestId('modal')).toHaveTextContent('criar:2026-08-10T09:00')
  })

  it('no mês, clicar num dia NÃO cria consulta e abre a visão daquele dia', async () => {
    consultasMock.mockReturnValue({ data: [], isError: false })
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'slot-mes' }))
    expect(screen.queryByTestId('modal')).toBeNull() // não cria
    await user.click(screen.getByRole('button', { name: 'dia-mes' }))
    expect(changeViewMock).toHaveBeenCalledWith('timeGridDay', '2026-08-10')
    expect(screen.queryByTestId('modal')).toBeNull()
  })

  it('clicar numa consulta AGENDADA abre o modal de edição', async () => {
    consultasMock.mockReturnValue({ data: [CONSULTA_AG], isError: false })
    renderPage()
    await userEvent.setup().click(screen.getByText('João — Limpeza'))
    expect(screen.getByTestId('modal')).toHaveTextContent('editar:1')
  })

  it('clicar numa consulta não-agendada abre o modal em modo visualização', async () => {
    consultasMock.mockReturnValue({ data: [CONSULTA_RE], isError: false })
    renderPage()
    await userEvent.setup().click(screen.getByText('Maria — Extração'))
    expect(screen.getByTestId('modal')).toHaveTextContent('visualizar:2')
  })

  it('arrastar um evento reagenda a consulta (PATCH início/fim)', async () => {
    consultasMock.mockReturnValue({ data: [CONSULTA_AG], isError: false })
    atualizarMock.mockResolvedValue({})
    renderPage()
    await userEvent.setup().click(screen.getByRole('button', { name: 'arrastar' }))
    expect(atualizarMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        dados: expect.objectContaining({ inicio: expect.any(String) }),
      }),
    )
    expect(revertMock).not.toHaveBeenCalled()
  })
})
