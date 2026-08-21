import { useState, useEffect } from 'react'
import { Clock, Calendar, AlertCircle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PeriodicTaskItem } from './use-vendor-celery'

interface EditarFrequenciaModalProps {
  aberto: boolean
  aoFechar: () => void
  tarefa: PeriodicTaskItem | null
  aoSalvar: (payload: {
    id: number
    every?: number
    period?: string
    crontab_minute?: string
    crontab_hour?: string
    crontab_day_of_week?: string
  }) => Promise<void> | void
  salvando: boolean
}

export function EditarFrequenciaModal({
  aberto,
  aoFechar,
  tarefa,
  aoSalvar,
  salvando,
}: EditarFrequenciaModalProps) {
  const [tipoAgendamento, setTipoAgendamento] = useState<'intervalo' | 'crontab'>('intervalo')
  const [every, setEvery] = useState(15)
  const [period, setPeriod] = useState('minutes')
  const [cronMinute, setCronMinute] = useState('*')
  const [cronHour, setCronHour] = useState('*')
  const [cronDayOfWeek, setCronDayOfWeek] = useState('*')

  useEffect(() => {
    if (tarefa) {
      if (tarefa.crontab_display !== '-') {
        setTipoAgendamento('crontab')
        setCronMinute(tarefa.crontab_minute || '*')
        setCronHour(tarefa.crontab_hour || '*')
        setCronDayOfWeek(tarefa.crontab_day_of_week || '*')
      } else {
        setTipoAgendamento('intervalo')
        setEvery(tarefa.every || 15)
        setPeriod(tarefa.period || 'minutes')
      }
    }
  }, [tarefa])

  if (!tarefa) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (tipoAgendamento === 'intervalo') {
      aoSalvar({
        id: tarefa!.id,
        every: Number(every),
        period,
      })
    } else {
      aoSalvar({
        id: tarefa!.id,
        crontab_minute: cronMinute.trim() || '*',
        crontab_hour: cronHour.trim() || '*',
        crontab_day_of_week: cronDayOfWeek.trim() || '*',
      })
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !salvando && !v && aoFechar()}>
      <DialogContent className="max-w-md border-slate-700 bg-[#0F1B38] text-slate-100">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#D4AF37]/20 text-[#D4AF37]">
              <Clock className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-100">
                Editar Frequência da Tarefa
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-mono">
                {tarefa.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Seletor de Tipo de Agendamento */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-900/80 p-1">
            <button
              type="button"
              onClick={() => setTipoAgendamento('intervalo')}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                tipoAgendamento === 'intervalo'
                  ? 'bg-[#1C2C54] text-[#D4AF37] shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="size-3.5" />
              Intervalo Regular
            </button>
            <button
              type="button"
              onClick={() => setTipoAgendamento('crontab')}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                tipoAgendamento === 'crontab'
                  ? 'bg-[#1C2C54] text-[#D4AF37] shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="size-3.5" />
              Expressão Cron
            </button>
          </div>

          {tipoAgendamento === 'intervalo' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="input-every" className="text-xs text-slate-300">
                  A cada (valor):
                </Label>
                <Input
                  id="input-every"
                  type="number"
                  min={1}
                  value={every}
                  onChange={(e) => setEvery(Math.max(1, Number(e.target.value)))}
                  className="h-8 border-slate-700 bg-slate-900 text-xs text-slate-100"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="select-period" className="text-xs text-slate-300">
                  Unidade de Tempo:
                </Label>
                <select
                  id="select-period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 focus:border-[#D4AF37] focus:outline-none"
                >
                  <option value="seconds">Segundos</option>
                  <option value="minutes">Minutos</option>
                  <option value="hours">Horas</option>
                  <option value="days">Dias</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Minuto:</Label>
                  <Input
                    placeholder="*"
                    value={cronMinute}
                    onChange={(e) => setCronMinute(e.target.value)}
                    className="h-8 border-slate-700 bg-slate-900 font-mono text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Hora:</Label>
                  <Input
                    placeholder="*"
                    value={cronHour}
                    onChange={(e) => setCronHour(e.target.value)}
                    className="h-8 border-slate-700 bg-slate-900 font-mono text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Dia Semana:</Label>
                  <Input
                    placeholder="*"
                    value={cronDayOfWeek}
                    onChange={(e) => setCronDayOfWeek(e.target.value)}
                    className="h-8 border-slate-700 bg-slate-900 font-mono text-xs text-slate-100"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Dica: Use <code>*</code> para todos, ou valores como <code>*/15</code> (a cada 15 min), <code>0 3</code> (3h da manhã).
              </p>
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <AlertCircle className="size-3.5 text-[#D4AF37]" />
              <span>Aplicação Imediata no Cluster</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed">
              A frequência é atualizada no banco de dados do Beat e entra em vigor no próximo ciclo sem necessidade de reinício dos containers.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={aoFechar}
              disabled={salvando}
              className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="bg-[#D4AF37] font-semibold text-slate-950 hover:bg-[#E5C158]"
            >
              {salvando ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Frequência'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
