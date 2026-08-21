import { useState } from 'react'
import {
  Clock,
  Play,
  Settings,
  Server,
  Layers,
  Activity,
  AlertCircle,
  Loader2,
  RotateCw,
  Cpu,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useVendorCelery, type PeriodicTaskItem } from './use-vendor-celery'
import { EditarFrequenciaModal } from './editar-frequencia-modal'

export function CeleryMonitorPage() {
  const {
    tarefas,
    carregandoTarefas,
    recarregarTarefas,
    statusCluster,
    carregandoStatus,
    alternarEnabled,
    alternandoId,
    atualizarFrequencia,
    salvandoFrequencia,
    dispararTarefa,
    disparandoId,
  } = useVendorCelery()

  const [tarefaEmEdicao, setTarefaEmEdicao] = useState<PeriodicTaskItem | null>(null)

  async function handleAlternarSwitch(t: PeriodicTaskItem) {
    const novoStatus = !t.enabled
    try {
      await alternarEnabled({ id: t.id, enabled: novoStatus })
      toast.success(`Tarefa "${t.name}" ${novoStatus ? 'ativada' : 'pausada'} com sucesso!`)
    } catch (err: unknown) {
      const msg = (err as { mensagem?: string })?.mensagem || 'Falha ao alterar status da tarefa.'
      toast.error(msg)
    }
  }

  async function handleDisparar(t: PeriodicTaskItem) {
    try {
      const res = await dispararTarefa(t.id)
      toast.success(res.mensagem || `Tarefa "${t.name}" enviada para execução!`, {
        description: `Task ID: ${res.task_id}`,
      })
    } catch (err: unknown) {
      const msg = (err as { mensagem?: string })?.mensagem || 'Falha ao disparar tarefa no Celery.'
      toast.error(msg)
    }
  }

  async function handleSalvarFrequencia(payload: Parameters<typeof atualizarFrequencia>[0]) {
    try {
      await atualizarFrequencia(payload)
      setTarefaEmEdicao(null)
      toast.success('Frequência de execução atualizada com sucesso!')
    } catch (err: unknown) {
      const msg = (err as { mensagem?: string })?.mensagem || 'Falha ao atualizar frequência.'
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header com título e botão de refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] shadow-inner">
            <Clock className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Celery Beat & Monitoramento de Filas
            </h1>
            <p className="text-xs text-slate-400">
              Gestão de tarefas periódicas em tempo de execução e saúde do cluster assíncrono
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => recarregarTarefas()}
          disabled={carregandoTarefas || carregandoStatus}
          className="border-slate-700 bg-[#0F1B38] text-xs text-slate-300 hover:bg-[#1C2C54] hover:text-white"
        >
          <RotateCw className={`mr-1.5 size-3.5 ${carregandoTarefas ? 'animate-spin' : ''}`} />
          Atualizar Dados
        </Button>
      </div>

      {/* KPI Cards de Infraestrutura */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Broker Redis */}
        <div className="rounded-xl border border-[#1C2C54] bg-[#0F1B38] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Broker (Redis)</span>
            <Server className="size-4 text-slate-500" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            {statusCluster?.redis_conectado ? (
              <>
                <span className="flex size-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" />
                <span className="text-base font-bold text-emerald-400">Conectado</span>
              </>
            ) : (
              <>
                <span className="flex size-2.5 rounded-full bg-red-500 ring-4 ring-red-500/20" />
                <span className="text-base font-bold text-red-400">Desconectado</span>
              </>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">redis://redis:6379/0</p>
        </div>

        {/* 2. Tamanho da Fila Celery */}
        <div className="rounded-xl border border-[#1C2C54] bg-[#0F1B38] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Fila Padrão (celery)</span>
            <Layers className="size-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
            {statusCluster?.tamanho_fila_celery ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Tarefas em espera para execução</p>
        </div>

        {/* 3. Workers Ativos */}
        <div className="rounded-xl border border-[#1C2C54] bg-[#0F1B38] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Workers no Cluster</span>
            <Cpu className="size-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#D4AF37]">
            {statusCluster?.total_workers ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Instâncias Celery Worker ativas</p>
        </div>

        {/* 4. Tarefas Periódicas */}
        <div className="rounded-xl border border-[#1C2C54] bg-[#0F1B38] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Tarefas do Beat</span>
            <Activity className="size-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-100">
            {tarefas.filter((t) => t.enabled).length} / {tarefas.length}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Tarefas ativas / configuradas</p>
        </div>
      </div>

      {/* Tabela de Tarefas Periódicas */}
      <div className="rounded-xl border border-[#1C2C54] bg-[#0F1B38] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-[#D4AF37]" />
            <h2 className="text-sm font-bold text-slate-100">Catálogo de Tarefas Periódicas</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {tarefas.length} tarefas cadastradas
          </span>
        </div>

        <div className="overflow-x-auto">
          {carregandoTarefas ? (
            <div className="flex items-center justify-center py-16 text-xs text-slate-500 gap-2">
              <Loader2 className="size-4 animate-spin text-[#D4AF37]" />
              Carregando tarefas do Celery Beat...
            </div>
          ) : tarefas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <AlertCircle className="size-8 opacity-20" />
              <p className="mt-2 text-xs">Nenhuma tarefa periódica configurada.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold w-24">Status</th>
                  <th className="px-4 py-3 font-semibold">Nome da Tarefa & Descrição</th>
                  <th className="px-4 py-3 font-semibold">Frequência / Agendamento</th>
                  <th className="px-4 py-3 font-semibold">Última Execução</th>
                  <th className="px-4 py-3 font-semibold text-center">Execuções</th>
                  <th className="px-4 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {tarefas.map((tarefa) => {
                  const alternando = alternandoId === tarefa.id
                  const disparando = disparandoId === tarefa.id
                  return (
                    <tr key={tarefa.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Switch Enabled */}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={tarefa.enabled}
                          onClick={() => handleAlternarSwitch(tarefa)}
                          disabled={alternando}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            tarefa.enabled ? 'bg-emerald-500' : 'bg-slate-700'
                          } ${alternando ? 'opacity-50' : ''}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                              tarefa.enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Nome e Descrição */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          {tarefa.name}
                          {tarefa.enabled ? (
                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px] py-0 h-4">
                              Ativa
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-slate-700 text-slate-500 text-[10px] py-0 h-4">
                              Pausada
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400 leading-tight">
                          {tarefa.description || 'Sem descrição cadastrada.'}
                        </p>
                        <span className="mt-1 block font-mono text-[10px] text-slate-500 truncate max-w-md" title={tarefa.task}>
                          {tarefa.task}
                        </span>
                      </td>

                      {/* Frequência */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tarefa.crontab_display !== '-' ? (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="bg-[#1C2C54] text-[#D4AF37] font-mono text-xs">
                              {tarefa.crontab_display}
                            </Badge>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="bg-slate-800 text-slate-200 font-mono text-xs">
                              {tarefa.interval_display}
                            </Badge>
                          </div>
                        )}
                      </td>

                      {/* Última Execução */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-300">
                        {tarefa.last_run_at ? (
                          <div className="flex flex-col">
                            <span>{new Date(tarefa.last_run_at).toLocaleDateString('pt-BR')}</span>
                            <span className="text-[11px] text-slate-500">
                              {new Date(tarefa.last_run_at).toLocaleTimeString('pt-BR')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Nunca executada</span>
                        )}
                      </td>

                      {/* Total Execuções */}
                      <td className="px-4 py-3 text-center font-mono text-slate-300">
                        {tarefa.total_run_count}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTarefaEmEdicao(tarefa)}
                            className="h-7 border-slate-700 bg-slate-900 px-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                            title="Editar Frequência de Execução"
                          >
                            <Settings className="size-3.5 mr-1" />
                            Editar
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleDisparar(tarefa)}
                            disabled={disparando}
                            className="h-7 bg-[#1C2C54] px-2 text-xs font-semibold text-[#D4AF37] hover:bg-[#D4AF37] hover:text-slate-950"
                            title="Disparar Imediatamente"
                          >
                            {disparando ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <>
                                <Play className="size-3 mr-1 fill-current" />
                                Disparar
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal de Edição de Frequência */}
      <EditarFrequenciaModal
        aberto={Boolean(tarefaEmEdicao)}
        aoFechar={() => setTarefaEmEdicao(null)}
        tarefa={tarefaEmEdicao}
        aoSalvar={handleSalvarFrequencia}
        salvando={salvandoFrequencia}
      />
    </div>
  )
}
