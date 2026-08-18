import { type ReactNode, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DateTime, Money } from '@/components/common/formato'
import { StatusBadge, type VarianteStatus } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDentistas } from '@/features/dentistas/use-dentistas'
import { useEnviarConfirmacao } from '@/features/notificacoes/use-notificacoes'
import { useProcedimentos } from '@/features/procedimentos/use-procedimentos'
import {
  type Plano,
  usePaciente,
  usePlanosDoPaciente,
} from '@/features/pacientes/use-paciente-detalhe'
import { usePacientes } from '@/features/pacientes/use-pacientes'
import type { ErroApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import {
  type Consulta,
  type ConsultaEntrada,
  ROTULO_STATUS,
  deInputLocal,
  paraInputLocal,
  useAtualizarConsulta,
  useCriarConsulta,
  useRemoverConsulta,
  useTransicaoConsulta,
} from './use-agenda'

/** Criar (início/fim pré-preenchidos do slot) ou editar uma consulta AGENDADA. */
type EstadoEdicao =
  { modo: 'criar'; inicio: string; fim: string } | { modo: 'editar'; consulta: Consulta }

/** Estado do modal: criar/editar (formulário) ou visualizar (somente leitura). */
export type EstadoModal = EstadoEdicao | { modo: 'visualizar'; consulta: Consulta }

const classeSelect = cn(
  'h-9 w-full cursor-pointer rounded-md border bg-transparent px-3 text-sm',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
)

/** Badge do estado de sincronização com o Google Calendar. */
const SYNC_GOOGLE: Record<string, { variante: VarianteStatus; rotulo: string }> = {
  SINCRONIZADO: { variante: 'sucesso', rotulo: 'Sincronizado' },
  ERRO: { variante: 'erro', rotulo: 'Erro de sync' },
  PENDENTE: { variante: 'pendente', rotulo: 'Pendente' },
}

function BadgeSyncGoogle({ sync }: { sync: string | null | undefined }) {
  if (!sync) return <span className="text-muted-foreground">—</span>
  const item = SYNC_GOOGLE[sync] ?? { variante: 'neutro' as VarianteStatus, rotulo: sync }
  return <StatusBadge variante={item.variante}>{item.rotulo}</StatusBadge>
}

type ConvenioOpcao = { id: number; nome: string; vencido: boolean }

/** Convênios distintos (ativos) dos planos do paciente, p/ o seletor de cobrança. */
function derivarConvenios(planos: Plano[]): ConvenioOpcao[] {
  const agora = new Date()
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
  const vistos = new Set<number>()
  const lista: ConvenioOpcao[] = []
  for (const p of planos) {
    if (p.convenio && p.status === 'ATIVO' && !vistos.has(p.convenio)) {
      vistos.add(p.convenio)
      lista.push({
        id: p.convenio,
        nome: p.convenio_nome ?? 'Convênio',
        vencido: Boolean(p.validade && p.validade < hoje),
      })
    }
  }
  return lista
}

/** Busca e escolhe um paciente (nome/CPF, servidor). Só ativos. */
function SeletorPaciente({
  nome,
  aoEscolher,
}: {
  nome: string
  aoEscolher: (id: number, nome: string) => void
}) {
  const [busca, setBusca] = useState('')
  const { data } = usePacientes({
    pagina: 1,
    busca,
    ordenacao: '',
    ativo: 'true',
    dentistaResponsavel: '',
  })
  const resultados = (data?.results ?? []).slice(0, 6)

  if (nome) {
    return (
      <div className="flex items-center justify-between rounded-md border bg-muted px-3 py-1.5 text-sm">
        <span className="font-medium">{nome}</span>
        <button
          type="button"
          className="cursor-pointer text-xs text-muted-foreground hover:text-destructive"
          onClick={() => aoEscolher(0, '')}
        >
          Trocar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Input
        placeholder="Buscar paciente pelo nome ou CPF…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {busca && (
        <div className="max-h-40 overflow-y-auto rounded-md border">
          {resultados.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum paciente encontrado.</p>
          ) : (
            resultados.map((p) => (
              <button
                key={p.id}
                type="button"
                className="block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  aoEscolher(p.id, p.nome_completo)
                  setBusca('')
                }}
              >
                {p.nome_completo}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function ConsultaModal({
  estado,
  aoFechar,
}: {
  estado: EstadoModal | null
  aoFechar: () => void
}) {
  if (!estado) return null
  if (estado.modo === 'visualizar') {
    return <VisualizacaoConsulta consulta={estado.consulta} aoFechar={aoFechar} />
  }
  return <Formulario estado={estado} aoFechar={aoFechar} />
}

/** Modal somente-leitura das consultas não-agendadas (realizadas, canceladas, etc.). */
function VisualizacaoConsulta({
  consulta,
  aoFechar,
}: {
  consulta: Consulta
  aoFechar: () => void
}) {
  const transicao = useTransicaoConsulta()

  async function finalizar() {
    try {
      await transicao.mutateAsync({ id: consulta.id, acao: 'finalizar' })
      toast.success('Atendimento finalizado.')
      aoFechar()
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível finalizar o atendimento.')
    }
  }

  const linhas: [string, ReactNode][] = [
    ['Paciente', consulta.paciente_nome],
    ['Dentista', consulta.dentista_nome],
    ['Início', <DateTime iso={consulta.inicio} />],
    ['Fim', <DateTime iso={consulta.fim} />],
    ['Procedimento', consulta.procedimento_catalogo_nome || consulta.procedimento || '—'],
    [
      'Valor',
      consulta.valor && Number(consulta.valor) > 0 ? <Money valor={consulta.valor} /> : '—',
    ],
    ['Status', ROTULO_STATUS[consulta.status ?? ''] ?? consulta.status],
    ['Google Agenda', <BadgeSyncGoogle sync={consulta.sync_google} />],
  ]
  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Consulta</DialogTitle>
          <DialogDescription>
            Detalhes do atendimento (somente leitura — não é uma consulta agendada).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {linhas.map(([rotulo, valor]) => (
            <div key={rotulo} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{rotulo}</span>
              <span className="text-sm font-medium">{valor}</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          {consulta.status === 'EM_ATENDIMENTO' && (
            <Button type="button" onClick={finalizar} disabled={transicao.isPending}>
              Finalizar atendimento
            </Button>
          )}
          <Button variant="outline" type="button" onClick={aoFechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Formulario({ estado, aoFechar }: { estado: EstadoEdicao; aoFechar: () => void }) {
  const criar = useCriarConsulta()
  const atualizar = useAtualizarConsulta()
  const remover = useRemoverConsulta()
  const transicao = useTransicaoConsulta()
  const enviarConfirmacao = useEnviarConfirmacao()
  const { data: dentistas } = useDentistas()
  const editando = estado.modo === 'editar'
  const consulta = editando ? estado.consulta : null

  const [pacienteId, setPacienteId] = useState(consulta?.paciente ?? 0)
  const [pacienteNome, setPacienteNome] = useState(consulta?.paciente_nome ?? '')
  const [dentista, setDentista] = useState(consulta ? String(consulta.dentista) : '')
  const [inicio, setInicio] = useState(editando ? paraInputLocal(consulta!.inicio) : estado.inicio)
  const [fim, setFim] = useState(editando ? paraInputLocal(consulta!.fim) : estado.fim)
  const [procedimentoCatalogo, setProcedimentoCatalogo] = useState<number>(
    consulta?.procedimento_catalogo ?? 0,
  )
  const [observacoes, setObservacoes] = useState(consulta?.observacoes ?? '')
  const [valor, setValor] = useState(consulta ? String(consulta.valor ?? '') : '')
  const [convenio, setConvenio] = useState<number>(consulta?.convenio ?? 0) // 0 = particular
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Catálogo de procedimentos (ativos) para o select do agendamento.
  const { data: procedimentos } = useProcedimentos()
  const procedimentosAtivos = (procedimentos ?? []).filter(
    (p) => p.ativo || p.id === procedimentoCatalogo,
  )

  // Convênios do paciente (dos planos ativos) -> opções de cobrança.
  const { data: planos } = usePlanosDoPaciente(pacienteId || 0)
  const conveniosPaciente = derivarConvenios(planos ?? [])
  const convenioVencido = Boolean(conveniosPaciente.find((c) => c.id === convenio)?.vencido)

  // Dentistas que podem atender: os vinculados ao paciente (responsável +
  // compartilhados). Se o paciente não tem vínculo, libera todos. Em edição,
  // mantém o dentista já marcado mesmo que hoje esteja fora do vínculo.
  const { data: pacienteInfo } = usePaciente(pacienteId || 0)
  const dentistasPermitidos = useMemo(() => {
    const todos = dentistas ?? []
    if (!pacienteInfo) return todos
    const ids = new Set<number>()
    if (pacienteInfo.dentista_responsavel) ids.add(pacienteInfo.dentista_responsavel)
    for (const id of pacienteInfo.dentistas_compartilhados ?? []) ids.add(id)
    if (ids.size === 0) return todos
    if (consulta?.dentista) ids.add(consulta.dentista)
    return todos.filter((d) => ids.has(d.id))
  }, [dentistas, pacienteInfo, consulta])

  async function excluir() {
    if (!consulta) return
    try {
      await remover.mutateAsync(consulta.id)
      toast.success('Consulta excluída.')
      aoFechar()
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível excluir a consulta.')
    }
  }

  async function iniciar() {
    if (!consulta) return
    try {
      await transicao.mutateAsync({ id: consulta.id, acao: 'iniciar' })
      toast.success('Atendimento iniciado.')
      aoFechar()
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível iniciar o atendimento.')
    }
  }

  async function enviarConf() {
    if (!consulta) return
    try {
      const log = await enviarConfirmacao.mutateAsync(consulta.id)
      if (log.status === 'ERRO')
        toast.error('Falha ao enviar a confirmação (verifique o WhatsApp).')
      else toast.success('Pedido de confirmação enviado.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível enviar a confirmação.')
    }
  }

  async function salvar() {
    setErro('')
    if (!pacienteId) {
      setErro('Selecione o paciente.')
      return
    }
    if (!dentista) {
      setErro('Selecione o dentista.')
      return
    }
    if (!inicio || !fim) {
      setErro('Informe início e fim.')
      return
    }
    if (!valor || Number(valor) <= 0) {
      setErro('Informe o valor da consulta.')
      return
    }
    if (convenioVencido) {
      setErro('Convênio vencido: renove a validade do plano para agendar por ele.')
      return
    }
    const dados: ConsultaEntrada = {
      paciente: pacienteId,
      dentista: Number(dentista),
      inicio: deInputLocal(inicio),
      fim: deInputLocal(fim),
      procedimento_catalogo: procedimentoCatalogo || null,
      observacoes,
      valor,
      convenio: convenio || null,
    }
    setSalvando(true)
    try {
      if (editando) await atualizar.mutateAsync({ id: consulta!.id, dados })
      else await criar.mutateAsync(dados)
      toast.success(editando ? 'Consulta atualizada.' : 'Consulta agendada.')
      aoFechar()
    } catch (excecao) {
      const e = excecao as ErroApi
      const camposMsgs = e.campos ? Object.values(e.campos).flat() : []
      setErro(camposMsgs.length ? camposMsgs.join(' ') : (e.mensagem ?? 'Não foi possível salvar.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar consulta' : 'Agendar consulta'}</DialogTitle>
          <DialogDescription>
            {editando ? 'Altere os dados da consulta.' : 'Preencha os dados do atendimento.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>Paciente</Label>
              {/* Enviar confirmação: só p/ consultas AGENDADA ainda PENDENTES. */}
              {editando &&
                consulta?.status === 'AGENDADA' &&
                consulta?.status_confirmacao === 'PENDENTE' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={enviarConf}
                    disabled={enviarConfirmacao.isPending}
                  >
                    {enviarConfirmacao.isPending ? 'Enviando…' : 'Enviar confirmação'}
                  </Button>
                )}
            </div>
            <SeletorPaciente
              nome={pacienteNome}
              aoEscolher={(id, nome) => {
                setPacienteId(id)
                setPacienteNome(nome)
                setConvenio(0) // troca de paciente reseta a cobrança
                setDentista('') // e o dentista (a lista depende do paciente)
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dentista">Dentista</Label>
            <select
              id="dentista"
              className={cn(classeSelect, !pacienteId && 'cursor-not-allowed opacity-60')}
              value={dentista}
              onChange={(e) => setDentista(e.target.value)}
              disabled={!pacienteId}
            >
              <option value="">Selecione…</option>
              {dentistasPermitidos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome_completo}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {pacienteId
                ? 'Apenas o dentista responsável e os compartilhados do paciente.'
                : 'Selecione o paciente primeiro.'}
            </p>
          </div>

          {/* Cobrança: sempre visível. Sem convênio -> travado em Particular;
              com convênio -> escolhe qual (ou Particular). */}
          <div className="space-y-1.5">
            <Label htmlFor="convenio">Cobrança</Label>
            <select
              id="convenio"
              className={cn(
                classeSelect,
                conveniosPaciente.length === 0 && 'cursor-not-allowed opacity-60',
              )}
              value={String(convenio)}
              onChange={(e) => setConvenio(Number(e.target.value))}
              disabled={conveniosPaciente.length === 0}
            >
              <option value="0">Particular</option>
              {conveniosPaciente.map((c) => (
                <option key={c.id} value={c.id}>
                  Convênio — {c.nome}
                  {c.vencido ? ' (vencido)' : ''}
                </option>
              ))}
            </select>
            {convenioVencido && (
              <p className="text-xs text-destructive">
                Convênio vencido — renove a validade do plano para agendar por ele.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inicio">Início</Label>
              <Input
                id="inicio"
                type="datetime-local"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fim">Fim</Label>
              <Input
                id="fim"
                type="datetime-local"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="procedimento">Procedimento</Label>
              <select
                id="procedimento"
                className={classeSelect}
                value={String(procedimentoCatalogo)}
                onChange={(e) => setProcedimentoCatalogo(Number(e.target.value))}
              >
                <option value="0">Selecione…</option>
                {procedimentosAtivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor">
                Valor{' '}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </Label>
              <Input
                id="valor"
                inputMode="decimal"
                aria-required="true"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacoes">Observação</Label>
            <Input
              id="observacoes"
              placeholder="Observações do atendimento (opcional)"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          {/* Iniciar atendimento: só quando o paciente CONFIRMOU. */}
          {editando &&
            consulta?.status === 'AGENDADA' &&
            consulta?.status_confirmacao === 'CONFIRMADA' && (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={iniciar}
                disabled={transicao.isPending}
              >
                Iniciar atendimento
              </Button>
            )}

          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>

        {/* Ações principais, abaixo de tudo: Excluir (esq.), Cancelar e Salvar. */}
        <DialogFooter className="flex-wrap">
          {editando && (
            <ConfirmDialog
              titulo="Excluir consulta?"
              descricao="A consulta agendada será removida definitivamente."
              rotuloConfirmar="Excluir"
              destrutivo
              onConfirmar={excluir}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Excluir consulta"
                  className="mr-auto text-destructive hover:text-destructive"
                >
                  Excluir
                </Button>
              }
            />
          )}
          <Button variant="outline" type="button" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={salvando || convenioVencido}>
            {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Agendar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
