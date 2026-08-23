import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import type { ErroApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { useEhDesktop } from '@/stores/ui'

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
  // No mobile a semana (7 colunas) não cabe: começa na visão Dia com toolbar compacta.
  const desktop = useEhDesktop()
  // Semana/Mês no mobile: precisam de largura → o wrapper rola na horizontal (sem premium).
  const [precisaLargura, setPrecisaLargura] = useState(false)

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
            {/* Mobile em Semana/Mês: rola na horizontal com largura mínima (colunas legíveis). */}
            <div className={cn(!desktop && precisaLargura && 'overflow-x-auto')}>
              <div className={cn(!desktop && precisaLargura && 'min-w-[680px]')}>
            <FullCalendar
              // Remonta ao cruzar o breakpoint para aplicar initialView/toolbar do modo certo.
              key={desktop ? 'desktop' : 'mobile'}
              ref={calRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={desktop ? 'timeGridWeek' : 'timeGridDay'}
              locale={LOCALE_PT_BR}
              // Mesmos botões (Mês/Semana/Dia) no mobile e no desktop; no mobile a
              // toolbar empilha via CSS (ver index.css) e cabe na tela estreita.
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              events={eventos}
              // Ao trocar de visão, marca se precisa de largura (Semana/Mês) para o
              // wrapper rolar horizontalmente no mobile em vez de espremer as colunas.
              datesSet={(arg) => setPrecisaLargura(arg.view.type !== 'timeGridDay')}
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
              // Mês: clicar num dia abre a visão daquele dia. Dia/Semana: um clique
              // simples (ou toque no mobile) já abre a criação da consulta (padrão 1h).
              dateClick={(info) => {
                if (info.view.type === 'dayGridMonth') {
                  calRef.current?.getApi().changeView('timeGridDay', info.dateStr)
                  return
                }
                const fim = new Date(info.date.getTime() + 60 * 60 * 1000)
                setModal({
                  modo: 'criar',
                  inicio: paraInputLocal(info.date),
                  fim: paraInputLocal(fim),
                })
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
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ConsultaModal estado={modal} aoFechar={() => setModal(null)} />
    </div>
  )
}
