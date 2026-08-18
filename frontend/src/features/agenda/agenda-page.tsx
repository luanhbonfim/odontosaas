import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import type { ErroApi } from '@/lib/api/client'

import { ConsultaModal, type EstadoModal } from './consulta-modal'
import {
  LEGENDA_AGENDA,
  LOCALE_PT_BR,
  consultaParaEvento,
  paraInputLocal,
  useAtualizarConsulta,
  useConsultas,
} from './use-agenda'

function mensagemErro(excecao: unknown, padrao: string): string {
  const e = excecao as ErroApi
  const campos = e.campos ? Object.values(e.campos).flat() : []
  return campos.length ? campos.join(' ') : (e.mensagem ?? padrao)
}

export function AgendaPage() {
  const { data, isError } = useConsultas()
  const atualizar = useAtualizarConsulta()
  const calRef = useRef<FullCalendar>(null)
  const [modal, setModal] = useState<EstadoModal | null>(null)
  const eventos = (data ?? []).map(consultaParaEvento)

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Agenda"
        descricao="Clique num horário para agendar, num evento para editar, ou arraste para reagendar."
      />

      {/* Legenda das cores por status + confirmação */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {LEGENDA_AGENDA.map((s) => (
          <span key={s.chave} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: s.cor }}
            />
            {s.rotulo}
          </span>
        ))}
      </div>

      {isError ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Não foi possível carregar a agenda. Tente novamente.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <FullCalendar
              ref={calRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              locale={LOCALE_PT_BR}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              events={eventos}
              // Bloco preenchido com a cor do status (sem a "bolinha" do mês).
              eventDisplay="block"
              height="auto"
              nowIndicator
              allDaySlot={false}
              slotMinTime="07:00:00"
              slotMaxTime="24:00:00"
              firstDay={1}
              // Interações (estilo Google Agenda):
              selectable
              selectMirror
              editable
              // No mês, clicar num dia abre a visão daquele dia (não cria consulta).
              dateClick={(info) => {
                if (info.view.type === 'dayGridMonth') {
                  calRef.current?.getApi().changeView('timeGridDay', info.dateStr)
                }
              }}
              select={(info) => {
                if (info.view.type === 'dayGridMonth') return
                setModal({
                  modo: 'criar',
                  inicio: paraInputLocal(info.start),
                  fim: paraInputLocal(info.end),
                })
              }}
              eventClick={(info) => {
                const consulta = (data ?? []).find((c) => String(c.id) === info.event.id)
                if (!consulta) return
                setModal(
                  consulta.status === 'AGENDADA'
                    ? { modo: 'editar', consulta }
                    : { modo: 'visualizar', consulta },
                )
              }}
              eventDrop={async (info) => {
                const ini = info.event.start
                const fim = info.event.end ?? ini
                if (!ini || !fim) return
                try {
                  await atualizar.mutateAsync({
                    id: Number(info.event.id),
                    dados: { inicio: ini.toISOString(), fim: fim.toISOString() },
                  })
                  toast.success('Consulta reagendada.')
                } catch (excecao) {
                  info.revert()
                  toast.error(mensagemErro(excecao, 'Não foi possível reagendar.'))
                }
              }}
              eventResize={async (info) => {
                const ini = info.event.start
                const fim = info.event.end ?? ini
                if (!ini || !fim) return
                try {
                  await atualizar.mutateAsync({
                    id: Number(info.event.id),
                    dados: { inicio: ini.toISOString(), fim: fim.toISOString() },
                  })
                  toast.success('Consulta reagendada.')
                } catch (excecao) {
                  info.revert()
                  toast.error(mensagemErro(excecao, 'Não foi possível reagendar.'))
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      <ConsultaModal estado={modal} aoFechar={() => setModal(null)} />
    </div>
  )
}
