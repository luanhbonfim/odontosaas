import type { ColumnDef } from '@tanstack/react-table'
import {
  Ban,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CircleCheck,
  Clock,
  History,
  MessageSquareText,
  Pencil,
  Plus,
  Repeat,
  Settings2,
  Trash2,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { type ComponentType, type ReactNode, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { CabecalhoDrawer, Campo, CorpoDrawer, LinhaToggle } from '@/components/common/form-kit'
import { DateTime } from '@/components/common/formato'
import { StatusBadge, type VarianteStatus } from '@/components/common/status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProcedimentos } from '@/features/procedimentos/use-procedimentos'
import type { ErroApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import { ConexaoWhatsapp } from './conexao-whatsapp'
import {
  type FilaItem,
  type LogNotificacao,
  type TemplateEntrada,
  type TemplateMensagem,
  useAlternarTemplate,
  useConfiguracao,
  useFila,
  useLogs,
  useRemoverTemplate,
  useSalvarConfiguracao,
  useSalvarTemplate,
  useTemplates,
} from './use-notificacoes'

const classeSelect = cn(
  'h-9 w-full cursor-pointer rounded-md border bg-transparent px-3 text-sm',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
)
const classeTextarea = cn(
  'min-h-28 w-full rounded-md border bg-transparent px-3 py-2 text-sm',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
)

// Tipos de template (também alimentam o seletor ao criar/editar template).
const ROTULO_TIPO: Record<string, string> = {
  CONFIRMACAO: 'Confirmação',
  AGRADECIMENTO: 'Agradecimento',
  LEMBRETE: 'Lembrete',
  CANCELAMENTO: 'Cancelamento',
  REAGENDAMENTO: 'Reagendamento',
}
// Rótulos do histórico: inclui "Resposta" (entradas do paciente, sem template).
const ROTULO_TIPO_HISTORICO: Record<string, string> = {
  ...ROTULO_TIPO,
  RESPOSTA: 'Resposta',
}

// Ícone por tipo de template (cabeçalho do card).
const ICONE_TIPO: Record<string, ComponentType<{ className?: string }>> = {
  CONFIRMACAO: CheckCircle2,
  AGRADECIMENTO: BellRing,
  CANCELAMENTO: XCircle,
  LEMBRETE: Repeat,
  REAGENDAMENTO: CalendarClock,
}

/** Resumo legível da regra de um lembrete (para o card). */
function descricaoLembrete(t: TemplateMensagem): string | null {
  if (t.tipo !== 'LEMBRETE') return null
  if (t.lembrete_tipo === 'RECALL') {
    const proc = t.procedimento_nome ?? 'procedimento'
    return `Recall · ${proc} · a cada ${t.intervalo_meses ?? '?'} meses`
  }
  if (t.lembrete_tipo === 'PRE_CONSULTA') {
    return `Aviso · ${t.horas_antes ?? '?'}h antes da consulta`
  }
  return 'Lembrete'
}

const VARIANTE_LOG: Record<string, VarianteStatus> = {
  ENFILEIRADA: 'neutro',
  ENVIADA: 'info',
  ENTREGUE: 'info',
  LIDA: 'pendente',
  RESPONDIDA: 'sucesso',
  ERRO: 'erro',
}

// Amostra para o preview do template (mesmas variáveis do backend).
const AMOSTRA: Record<string, string> = {
  paciente: 'Maria Silva',
  data: '10/08/2026',
  hora: '09:00',
  dentista: 'Dra. Ana',
  link: 'https://clinica.exemplo/c/abc123',
}
function renderizarPreview(corpo: string): string {
  return corpo.replace(/\{\{(\w+)\}\}/g, (_todo, chave) => AMOSTRA[chave] ?? `{{${chave}}}`)
}

export function NotificacoesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        titulo="WhatsApp"
        descricao="Confirmações e lembretes por WhatsApp: configuração, mensagens e histórico."
      />
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">
            <Settings2 className="size-4" /> Configuração
          </TabsTrigger>
          <TabsTrigger value="templates">
            <MessageSquareText className="size-4" /> Templates
          </TabsTrigger>
          <TabsTrigger value="fila">
            <Clock className="size-4" /> Fila
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="size-4" /> Histórico
          </TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="pt-4">
          <ConfiguracaoTab />
        </TabsContent>
        <TabsContent value="templates" className="pt-4">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="fila" className="pt-4">
          <FilaTab />
        </TabsContent>
        <TabsContent value="historico" className="pt-4">
          <HistoricoTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// --- Aba: Configuração ---
function ConfiguracaoTab() {
  const { data: config, isLoading } = useConfiguracao()
  const { data: templates } = useTemplates()
  const salvar = useSalvarConfiguracao()
  // As permissões só podem ligar se o template correspondente estiver ativo.
  const confirmacaoAtiva = (templates ?? []).some((t) => t.tipo === 'CONFIRMACAO' && t.ativo)
  const cancelamentoAtivo = (templates ?? []).some((t) => t.tipo === 'CANCELAMENTO' && t.ativo)
  const agradecimentoAtivo = (templates ?? []).some((t) => t.tipo === 'AGRADECIMENTO' && t.ativo)
  const reagendamentoAtivo = (templates ?? []).some((t) => t.tipo === 'REAGENDAMENTO' && t.ativo)
  const [dias, setDias] = useState('1')
  const [horario, setHorario] = useState('09:00')
  const [agradecer, setAgradecer] = useState(true)
  const [reagendar, setReagendar] = useState(true)
  const [reagMinutos, setReagMinutos] = useState('1')
  const [cancelarAviso, setCancelarAviso] = useState(true)
  const [cancelarNaoConf, setCancelarNaoConf] = useState(false)
  const [cancelarHoras, setCancelarHoras] = useState('10')
  const [reforcar, setReforcar] = useState(true)
  const [mensagemReforco, setMensagemReforco] = useState('')
  const [ativo, setAtivo] = useState(true)

  useEffect(() => {
    if (config) {
      setDias(String(config.dias_antecedencia ?? 1))
      setHorario((config.horario_envio ?? '09:00').slice(0, 5))
      setAgradecer(config.enviar_agradecimento ?? true)
      setReagendar(config.enviar_reagendamento ?? true)
      setReagMinutos(String(config.reagendamento_minutos ?? 1))
      setCancelarAviso(config.enviar_cancelamento ?? true)
      setCancelarNaoConf(config.cancelar_nao_confirmadas ?? false)
      setCancelarHoras(String(config.cancelar_horas_antes ?? 10))
      setReforcar(config.reforcar_confirmacao ?? true)
      setMensagemReforco(config.mensagem_reforco ?? '')
      setAtivo(config.ativo ?? true)
    }
  }, [config])

  async function onSalvar() {
    try {
      await salvar.mutateAsync({
        id: config?.id,
        dados: {
          dias_antecedencia: Number(dias) || 0,
          horario_envio: horario,
          enviar_agradecimento: agradecer,
          enviar_reagendamento: reagendar,
          reagendamento_minutos: Number(reagMinutos) || 1,
          enviar_cancelamento: cancelarAviso,
          cancelar_nao_confirmadas: cancelarNaoConf,
          cancelar_horas_antes: Number(cancelarHoras) || 10,
          reforcar_confirmacao: reforcar,
          mensagem_reforco: mensagemReforco,
          ativo,
        },
      })
      toast.success('Configuração salva.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível salvar.')
    }
  }

  if (isLoading) return <Skeleton className="h-48 w-full" />

  return (
    <div className="space-y-4">
      <ConexaoWhatsapp />
      <Card>
        <CardContent className="space-y-6 p-6">
          {/* Toggle geral: desligado, apaga/desabilita o resto. */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="ativo" className="text-sm font-medium">
                Notificações ativas
              </Label>
              <p className="text-xs text-muted-foreground">
                Ligue para enviar confirmações e lembretes por WhatsApp.
              </p>
            </div>
            <input
              id="ativo"
              type="checkbox"
              className="size-5 cursor-pointer accent-primary"
              checked={ativo}
              onChange={(e) => {
                if (e.target.checked && !confirmacaoAtiva) {
                  toast.error(
                    'O template de Confirmação está inativo. Ative-o na aba Templates para ligar as notificações.',
                  )
                  return
                }
                setAtivo(e.target.checked)
              }}
            />
          </div>

          {/* fieldset disabled desabilita e apaga todos os campos de uma vez. */}
          <fieldset disabled={!ativo} className="space-y-6 border-t pt-5 disabled:opacity-50">
            {/* Seção: quando enviar a confirmação */}
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="size-4 text-primary" /> Pedido de confirmação
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="dias">Enviar com quantos dias de antecedência</Label>
                  <Input
                    id="dias"
                    type="number"
                    min={0}
                    value={dias}
                    onChange={(e) => setDias(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="horario">Horário de envio</Label>
                  <Input
                    id="horario"
                    type="time"
                    value={horario}
                    onChange={(e) => setHorario(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                O paciente confirma respondendo <strong>SIM</strong> ou <strong>NÃO</strong> (ou
                pelo botão do link).
              </p>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-primary"
                  checked={agradecer}
                  onChange={(e) => {
                    if (e.target.checked && !agradecimentoAtivo) {
                      toast.error(
                        'O template de Agradecimento está inativo. Ative-o na aba Templates para ligar o envio.',
                      )
                      return
                    }
                    setAgradecer(e.target.checked)
                  }}
                />
                Enviar mensagem de agradecimento ao confirmar
              </label>
              {!agradecimentoAtivo && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  O template de Agradecimento está inativo — ative-o na aba{' '}
                  <strong>Templates</strong> para habilitar este envio.
                </p>
              )}
            </section>

            {/* Seção: aviso de reagendamento */}
            <section className="space-y-2 border-t pt-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="size-4 text-primary" /> Reagendamento
              </h3>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-primary"
                  checked={reagendar}
                  onChange={(e) => {
                    if (e.target.checked && !reagendamentoAtivo) {
                      toast.error(
                        'O template de Reagendamento está inativo. Ative-o na aba Templates para ligar o envio.',
                      )
                      return
                    }
                    setReagendar(e.target.checked)
                  }}
                />
                Avisar o paciente quando a consulta for remarcada
              </label>
              <fieldset disabled={!reagendar} className="max-w-xs space-y-1.5 disabled:opacity-50">
                <Label htmlFor="reag_minutos">Disparar quantos minutos depois</Label>
                <Input
                  id="reag_minutos"
                  type="number"
                  min={1}
                  value={reagMinutos}
                  onChange={(e) => setReagMinutos(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Tempo após o reagendamento para o aviso sair (ex.: 1 = no minuto seguinte).
                </p>
              </fieldset>
              {!reagendamentoAtivo && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  O template de Reagendamento está inativo — ative-o na aba{' '}
                  <strong>Templates</strong> para habilitar este envio.
                </p>
              )}
            </section>

            {/* Seção: aviso de cancelamento */}
            <section className="space-y-2 border-t pt-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <XCircle className="size-4 text-primary" /> Aviso de cancelamento
              </h3>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-primary"
                  checked={cancelarAviso}
                  onChange={(e) => {
                    if (e.target.checked && !cancelamentoAtivo) {
                      toast.error(
                        'O template de Cancelamento está inativo. Ative-o na aba Templates para ligar o envio.',
                      )
                      return
                    }
                    setCancelarAviso(e.target.checked)
                  }}
                />
                Avisar o paciente quando a consulta for cancelada
              </label>
              {!cancelamentoAtivo && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  O template de Cancelamento está inativo — ative-o na aba{' '}
                  <strong>Templates</strong> para habilitar este envio.
                </p>
              )}
            </section>

            {/* Seção: reforço quando a resposta não é sim/não */}
            <section className="space-y-2 border-t pt-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Repeat className="size-4 text-primary" /> Reforço da resposta
              </h3>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-primary"
                  checked={reforcar}
                  onChange={(e) => setReforcar(e.target.checked)}
                />
                Se responder algo diferente de SIM/NÃO, pedir de novo
              </label>
              <fieldset disabled={!reforcar} className="max-w-md space-y-1.5 disabled:opacity-50">
                <Label htmlFor="mensagem_reforco">Mensagem de reforço</Label>
                <Input
                  id="mensagem_reforco"
                  placeholder="Por favor, responda apenas com SIM ou NÃO."
                  value={mensagemReforco}
                  onChange={(e) => setMensagemReforco(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Reenviada (com “digitando…”) até o paciente responder certo. Em branco = texto
                  padrão.
                </p>
              </fieldset>
            </section>

            {/* Seção: cancelamento automático de não confirmadas */}
            <section className="space-y-2 border-t pt-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <XCircle className="size-4 text-primary" /> Cancelamento automático
              </h3>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-primary"
                  checked={cancelarNaoConf}
                  onChange={(e) => setCancelarNaoConf(e.target.checked)}
                />
                Cancelar consultas que o paciente não confirmar
              </label>
              <fieldset
                disabled={!cancelarNaoConf}
                className="max-w-xs space-y-1.5 disabled:opacity-50"
              >
                <Label htmlFor="cancelar_horas">Cancelar até quantas horas antes</Label>
                <Input
                  id="cancelar_horas"
                  type="number"
                  min={1}
                  value={cancelarHoras}
                  onChange={(e) => setCancelarHoras(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Faltando estas horas para o início sem confirmação, a consulta é cancelada e sai
                  do Google Agenda (continua na agenda do app).
                </p>
              </fieldset>
            </section>
          </fieldset>

          <div className="flex justify-end">
            <Button onClick={onSalvar} disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando…' : 'Salvar configuração'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// --- Aba: Templates ---
// Ordem fixa dos templates singleton; lembretes vêm depois, por ordem de criação
// (não muda de posição ao ativar/inativar — só novos lembretes entram no fim).
const ORDEM_FIXA = ['CONFIRMACAO', 'CANCELAMENTO', 'AGRADECIMENTO', 'REAGENDAMENTO']
function ordenarTemplates(lista: TemplateMensagem[]): TemplateMensagem[] {
  return [...lista].sort((a, b) => {
    const ia = ORDEM_FIXA.indexOf(a.tipo ?? '')
    const ib = ORDEM_FIXA.indexOf(b.tipo ?? '')
    const pa = ia === -1 ? ORDEM_FIXA.length : ia
    const pb = ib === -1 ? ORDEM_FIXA.length : ib
    if (pa !== pb) return pa - pb
    return (a.id ?? 0) - (b.id ?? 0)
  })
}

function TemplatesTab() {
  const { data, isLoading } = useTemplates()
  const remover = useRemoverTemplate()
  const alternar = useAlternarTemplate()
  const templates = ordenarTemplates(data ?? [])

  async function excluir(template: TemplateMensagem) {
    try {
      await remover.mutateAsync(template.id)
      toast.success('Template removido.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível remover.')
    }
  }

  async function alternarAtivo(template: TemplateMensagem) {
    const ligar = !template.ativo
    try {
      await alternar.mutateAsync({ id: template.id, ativo: ligar })
      toast.success(ligar ? 'Template ativado.' : 'Template inativado.')
    } catch (excecao) {
      // Ex.: tentar inativar o de Agradecimento com o envio ainda ligado.
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível alterar.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Confirmação, cancelamento e agradecimento já vêm prontos (só editar). Você adiciona
          quantos <strong>lembretes</strong> quiser.
        </p>
        <TemplateDrawer
          tiposExistentes={templates.map((t) => t.tipo).filter(Boolean) as string[]}
          trigger={
            <Button size="sm">
              <Plus /> Adicionar lembrete
            </Button>
          }
        />
      </div>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhum template cadastrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const Icone = ICONE_TIPO[t.tipo ?? ''] ?? MessageSquareText
            const resumo = descricaoLembrete(t)
            return (
              <Card key={t.id} className={cn(!t.ativo && 'border-dashed bg-muted/30')}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className={cn('flex min-w-0 items-center gap-2', !t.ativo && 'opacity-50')}>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icone className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium">{ROTULO_TIPO[t.tipo ?? ''] ?? t.tipo}</p>
                        {resumo && (
                          <p className="truncate text-xs text-muted-foreground">{resumo}</p>
                        )}
                      </div>
                      {t.ativo ? (
                        <StatusBadge variante="sucesso">Ativo</StatusBadge>
                      ) : (
                        <StatusBadge variante="neutro">Inativo</StatusBadge>
                      )}
                    </div>
                    {/* Ações no padrão da Equipe: lápis (editar) → ativar/desativar → excluir. */}
                    <div className="flex shrink-0 items-center gap-1">
                      <TemplateDrawer
                        template={t}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar template"
                            aria-label="Editar template"
                          >
                            <Pencil />
                          </Button>
                        }
                      />
                      {t.ativo ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Inativar template"
                          aria-label="Inativar template"
                          disabled={alternar.isPending}
                          onClick={() => alternarAtivo(t)}
                        >
                          <Ban className="text-destructive" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Ativar template"
                          aria-label="Ativar template"
                          disabled={alternar.isPending}
                          onClick={() => alternarAtivo(t)}
                        >
                          <CircleCheck className="text-success" />
                        </Button>
                      )}
                      {/* Só os Lembretes são removíveis; os fixos só editam. */}
                      {t.tipo === 'LEMBRETE' && (
                        <ConfirmDialog
                          titulo="Remover lembrete?"
                          descricao="Remove este lembrete. Esta ação não pode ser desfeita."
                          rotuloConfirmar="Remover"
                          destrutivo
                          onConfirmar={() => excluir(t)}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Remover lembrete">
                              <Trash2 className="text-destructive" />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </div>
                  <p
                    className={cn(
                      'text-sm whitespace-pre-wrap text-muted-foreground',
                      !t.ativo && 'opacity-50',
                    )}
                  >
                    {t.corpo}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TemplateDrawer({
  trigger,
  template,
  tiposExistentes = [],
}: {
  trigger: ReactNode
  template?: TemplateMensagem
  /** Tipos já cadastrados — os singletons ocupados não aparecem no "Novo". */
  tiposExistentes?: string[]
}) {
  const [aberto, setAberto] = useState(false)
  const salvar = useSalvarTemplate()
  const { data: procedimentos } = useProcedimentos()
  const edicao = Boolean(template)
  // No "Novo": só os singletons ainda não criados + Lembrete (sempre pode).
  const disponiveis = edicao
    ? [template!.tipo!]
    : [
        ...['CONFIRMACAO', 'CANCELAMENTO', 'AGRADECIMENTO', 'REAGENDAMENTO'].filter(
          (t) => !tiposExistentes.includes(t),
        ),
        'LEMBRETE',
      ]
  const [tipo, setTipo] = useState('LEMBRETE')
  const [corpo, setCorpo] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [lembreteTipo, setLembreteTipo] = useState('RECALL')
  const [procedimento, setProcedimento] = useState<number>(0)
  const [intervaloMeses, setIntervaloMeses] = useState('6')
  const [horasAntes, setHorasAntes] = useState('2')

  useEffect(() => {
    if (aberto) {
      setTipo(template?.tipo ?? disponiveis[0] ?? 'LEMBRETE')
      setCorpo(template?.corpo ?? '')
      setAtivo(template?.ativo ?? true)
      setLembreteTipo(template?.lembrete_tipo || 'RECALL')
      setProcedimento(template?.procedimento ?? 0)
      setIntervaloMeses(String(template?.intervalo_meses ?? 6))
      setHorasAntes(String(template?.horas_antes ?? 2))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, template])

  async function onSalvar() {
    if (!corpo.trim()) {
      toast.error('Escreva o corpo da mensagem.')
      return
    }
    const dados: TemplateEntrada = { tipo, corpo, ativo }
    if (tipo === 'LEMBRETE') {
      dados.lembrete_tipo = lembreteTipo
      if (lembreteTipo === 'RECALL') {
        dados.procedimento = procedimento || null
        dados.intervalo_meses = Number(intervaloMeses) || null
        dados.horas_antes = null
      } else {
        dados.horas_antes = Number(horasAntes) || null
        dados.procedimento = null
        dados.intervalo_meses = null
      }
    }
    try {
      await salvar.mutateAsync({ id: template?.id, dados })
      toast.success(edicao ? 'Template atualizado.' : 'Template criado.')
      setAberto(false)
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível salvar.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <CabecalhoDrawer
          icone={MessageSquareText}
          titulo={edicao ? 'Editar template' : 'Novo lembrete'}
          descricao={
            <>
              Variáveis disponíveis: {'{{paciente}}'}, {'{{data}}'}, {'{{hora}}'}, {'{{dentista}}'}{' '}
              e {'{{link}}'}.
            </>
          }
        />

        <CorpoDrawer>
          <Campo id="tipo" label="Tipo">
            <select
              id="tipo"
              className={classeSelect}
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              disabled={edicao}
            >
              {disponiveis.map((valor) => (
                <option key={valor} value={valor}>
                  {ROTULO_TIPO[valor] ?? valor}
                </option>
              ))}
            </select>
          </Campo>

          {tipo === 'LEMBRETE' && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <Campo id="lembrete_tipo" label="Tipo de lembrete">
                <select
                  id="lembrete_tipo"
                  className={classeSelect}
                  value={lembreteTipo}
                  onChange={(e) => setLembreteTipo(e.target.value)}
                >
                  <option value="RECALL">Recall por procedimento</option>
                  <option value="PRE_CONSULTA">Aviso antes da consulta</option>
                </select>
              </Campo>
              {lembreteTipo === 'RECALL' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo id="proc_lembrete" label="Procedimento">
                    <select
                      id="proc_lembrete"
                      className={classeSelect}
                      value={String(procedimento)}
                      onChange={(e) => setProcedimento(Number(e.target.value))}
                    >
                      <option value="0">Selecione…</option>
                      {(procedimentos ?? [])
                        .filter((p) => p.ativo || p.id === procedimento)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                    </select>
                  </Campo>
                  <Campo id="intervalo_meses" label="Intervalo (meses)">
                    <Input
                      id="intervalo_meses"
                      type="number"
                      min={1}
                      value={intervaloMeses}
                      onChange={(e) => setIntervaloMeses(e.target.value)}
                    />
                  </Campo>
                </div>
              ) : (
                <Campo
                  id="horas_antes"
                  label="Avisar quantas horas antes"
                  className="max-w-xs"
                  ajuda="Só para pacientes confirmados."
                >
                  <Input
                    id="horas_antes"
                    type="number"
                    min={1}
                    value={horasAntes}
                    onChange={(e) => setHorasAntes(e.target.value)}
                  />
                </Campo>
              )}
            </div>
          )}

          <Campo id="corpo" label="Mensagem">
            <textarea
              id="corpo"
              className={classeTextarea}
              placeholder="Olá, {{paciente}}! Sua consulta é dia {{data}} às {{hora}}."
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
            />
          </Campo>

          <Campo label="Prévia">
            <div className="rounded-md border bg-muted p-3 text-sm whitespace-pre-wrap">
              {corpo ? renderizarPreview(corpo) : '—'}
            </div>
          </Campo>

          <LinhaToggle
            titulo="Template ativo"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
          />
        </CorpoDrawer>

        <SheetFooter>
          <SheetClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </SheetClose>
          <Button type="button" onClick={onSalvar} disabled={salvar.isPending}>
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// --- Aba: Fila (o que ainda vai sair) ---
function rotuloFila(item: FilaItem): string {
  if (item.tipo === 'LEMBRETE' && item.lembrete_tipo === 'PRE_CONSULTA') {
    return 'Aviso antes da consulta'
  }
  return ROTULO_TIPO[item.tipo] ?? item.tipo
}

function FilaTab() {
  const { data, isLoading } = useFila()
  const itens = data ?? []

  const colunas: ColumnDef<FilaItem, unknown>[] = useMemo(
    () => [
      { accessorKey: 'paciente_nome', header: 'Paciente' },
      { id: 'tipo', header: 'Mensagem', cell: ({ row }) => rotuloFila(row.original) },
      {
        id: 'consulta',
        header: 'Consulta em',
        cell: ({ row }) => <DateTime iso={row.original.consulta_inicio} />,
      },
      {
        id: 'previsto',
        header: 'Previsto para',
        cell: ({ row }) =>
          row.original.atrasado ? (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
              <Clock className="size-3.5" /> Sai no próximo envio
            </span>
          ) : (
            <DateTime iso={row.original.previsto_para} />
          ),
      },
      {
        id: 'numero',
        header: 'Número',
        cell: ({ row }) =>
          row.original.telefone_ok ? (
            <StatusBadge variante="sucesso">OK</StatusBadge>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
              <TriangleAlert className="size-3.5" /> Sem WhatsApp válido
            </span>
          ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Mensagens automáticas que <strong>ainda vão sair</strong>: pedidos de confirmação pendentes
        e avisos de pacientes já confirmados. Atualiza sozinho a cada 30s.
      </p>
      <DataTable
        columns={colunas}
        data={itens}
        carregando={isLoading}
        vazio="Nenhuma mensagem na fila."
      />
    </div>
  )
}

// --- Aba: Histórico ---
function HistoricoTab() {
  const [direcao, setDirecao] = useState('')
  const [status, setStatus] = useState('')
  const { data, isLoading } = useLogs({ direcao, status })

  const colunas: ColumnDef<LogNotificacao, unknown>[] = useMemo(
    () => [
      { accessorKey: 'paciente_nome', header: 'Paciente' },
      {
        id: 'tipo',
        header: 'Tipo',
        cell: ({ row }) =>
          ROTULO_TIPO_HISTORICO[row.original.tipo ?? ''] ?? row.original.tipo ?? '—',
      },
      {
        id: 'direcao',
        header: 'Direção',
        cell: ({ row }) => (row.original.direcao === 'RECEBIDA' ? 'Recebida' : 'Enviada'),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge variante={VARIANTE_LOG[row.original.status ?? ''] ?? 'neutro'}>
            {row.original.status}
          </StatusBadge>
        ),
      },
      {
        id: 'resposta',
        header: 'Resposta',
        cell: ({ row }) =>
          row.original.resposta_paciente || <span className="text-muted-foreground">—</span>,
      },
      {
        id: 'quando',
        header: 'Quando',
        cell: ({ row }) =>
          row.original.enviado_em ? (
            <DateTime iso={row.original.enviado_em} />
          ) : (
            <DateTime iso={row.original.criado_em} />
          ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Filtrar por direção"
          className={cn(classeSelect, 'w-auto')}
          value={direcao}
          onChange={(e) => setDirecao(e.target.value)}
        >
          <option value="">Toda direção</option>
          <option value="ENVIADA">Enviada</option>
          <option value="RECEBIDA">Recebida</option>
        </select>
        <select
          aria-label="Filtrar por status"
          className={cn(classeSelect, 'w-auto')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todo status</option>
          {Object.keys(VARIANTE_LOG).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <DataTable
        columns={colunas}
        data={data ?? []}
        carregando={isLoading}
        vazio="Nenhuma notificação registrada."
      />
    </div>
  )
}
