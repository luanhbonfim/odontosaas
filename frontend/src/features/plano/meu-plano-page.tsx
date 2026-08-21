import {
  Sparkles,
  Users,
  Stethoscope,
  HardDrive,
  CheckCircle2,
  XCircle,
  Calendar,
  CreditCard,
  MessageCircle,
  Mail,
  Phone,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  Building2,
  Layers,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/common/status-badge'
import { useMeuPlano } from './use-meu-plano'

export function MeuPlanoPage() {
  const { data, isLoading } = useMeuPlano()

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <PageHeader
          titulo="Meu Plano &amp; Assinatura"
          descricao="Detalhes da sua contratação, limites operacionais e consumo de recursos."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader
          titulo="Meu Plano &amp; Assinatura"
          descricao="Detalhes da sua contratação, limites operacionais e consumo de recursos."
        />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Não foi possível carregar os detalhes do plano no momento.
          </CardContent>
        </Card>
      </div>
    )
  }

  const { clinica, plano, status, capacidade, modulos, upgrade } = data

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        titulo="Meu Plano &amp; Assinatura"
        descricao="Acompanhe os detalhes da sua assinatura, capacidade da clínica e consumo de recursos."
      />

      {/* Alerta de Vencimento se aplicável */}
      {status.vencido ? (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/40 text-destructive flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-5 shrink-0" />
            <div>
              <p className="font-bold text-sm">A vigência do seu plano expirou</p>
              <p className="text-xs opacity-90">
                A data final da sua assinatura foi atingida em {new Date(status.vigencia_fim as string).toLocaleDateString('pt-BR')}. Renove com o suporte para evitar bloqueios.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="destructive" className="shrink-0 font-semibold cursor-pointer">
            <a href={upgrade.whatsapp_url} target="_blank" rel="noreferrer">
              Renovar Agora
            </a>
          </Button>
        </div>
      ) : status.dias_restantes !== null && status.dias_restantes <= 7 ? (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <Clock className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-bold text-sm">Renovação próxima do vencimento</p>
              <p className="text-xs opacity-90">
                Seu plano {status.dias_restantes === 0 ? 'vence hoje' : status.dias_restantes === 1 ? 'vence amanhã' : `vence em ${status.dias_restantes} dias`} ({status.vigencia_fim ? new Date(`${(status.vigencia_fim as string).split('T')[0]}T12:00:00`).toLocaleDateString('pt-BR') : ''}).
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-500 text-white font-semibold shrink-0 cursor-pointer">
            <a href={upgrade.whatsapp_url} target="_blank" rel="noreferrer">
              Falar com Comercial
            </a>
          </Button>
        </div>
      ) : null}

      {/* Grid Principal: Cartão do Plano Atual & Vigência */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card do Plano Contratado */}
        <Card className="md:col-span-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-md">
          <CardHeader className="flex flex-row items-start justify-between pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Sparkles className="size-5 text-[#D4AF37]" />
                  {plano.nome}
                </CardTitle>
                <StatusBadge
                  variante={status.vencido ? 'erro' : status.ativo ? 'sucesso' : 'pendente'}
                  className="ml-2 font-semibold"
                >
                  {status.vencido ? 'EXPIRADO' : status.status_efetivo}
                </StatusBadge>
              </div>
              <CardDescription>
                Contrato vinculado a <strong className="text-foreground">{clinica.nome_fantasia}</strong> ({clinica.schema_name})
              </CardDescription>
            </div>

            <div className="text-right">
              <span className="text-3xl font-extrabold text-foreground tracking-tight">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plano.preco_mensal)}
              </span>
              <span className="text-xs text-muted-foreground block">/{plano.periodicidade === 'ANUAL' ? 'ano' : 'mês'}</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-lg bg-muted/40 border text-xs">
              <div>
                <span className="text-muted-foreground block">Ciclo de Cobrança:</span>
                <span className="font-semibold text-foreground mt-0.5 block">{plano.periodicidade_display}</span>
              </div>

              <div>
                <span className="text-muted-foreground block">Data de Vigência / Vencimento:</span>
                <span className="font-semibold text-foreground mt-0.5 block font-mono">
                  {status.vigencia_fim
                    ? new Date(status.vigencia_fim + 'T12:00:00').toLocaleDateString('pt-BR')
                    : 'Permanente (Vitalício)'}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block">Situação Contratual:</span>
                <span className="font-semibold text-foreground mt-0.5 block">
                  {status.vencido
                    ? '⚠️ Regularização Pendente'
                    : status.dias_restantes !== null
                    ? `Em dia (${status.dias_restantes} dias restantes)`
                    : 'Contrato Vitalício'}
                </span>
              </div>
            </div>

            {/* Módulos Inclusos */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="size-3.5" />
                Módulos &amp; Recursos Habilitados no Seu Plano
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2 rounded border bg-card/60">
                  {modulos.financeiro ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-muted-foreground" />}
                  <span className={modulos.financeiro ? 'font-medium' : 'text-muted-foreground'}>Módulo Financeiro</span>
                </div>

                <div className="flex items-center gap-2 p-2 rounded border bg-card/60">
                  {modulos.estoque ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-muted-foreground" />}
                  <span className={modulos.estoque ? 'font-medium' : 'text-muted-foreground'}>Controle de Estoque</span>
                </div>

                <div className="flex items-center gap-2 p-2 rounded border bg-card/60">
                  {modulos.sync_google ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-muted-foreground" />}
                  <span className={modulos.sync_google ? 'font-medium' : 'text-muted-foreground'}>Google Calendar</span>
                </div>

                <div className="flex items-center gap-2 p-2 rounded border bg-card/60">
                  {modulos.whatsapp_waha ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-muted-foreground" />}
                  <span className={modulos.whatsapp_waha ? 'font-medium' : 'text-muted-foreground'}>WhatsApp WAHA</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card de Atendimento Comercial & Upgrade */}
        <Card className="border-[#D4AF37]/30 bg-gradient-to-br from-card via-[#D4AF37]/5 to-[#D4AF37]/10 flex flex-col justify-between shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="size-4 text-[#D4AF37]" />
              Precisa de Mais Recursos?
            </CardTitle>
            <CardDescription className="text-xs">
              Aumente o limite de dentistas, usuários ou desbloqueie integrações avançadas para sua clínica.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-card border space-y-2">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="size-3.5 text-[#D4AF37]" />
                Suporte Comercial PróClínica
              </p>
              <div className="space-y-1 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="size-3 text-[#D4AF37]" />
                  <span>{upgrade.contato_comercial_email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="size-3 text-[#D4AF37]" />
                  <span>+55 (11) 99999-9999</span>
                </div>
              </div>
            </div>

            <Button asChild className="w-full bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 font-bold cursor-pointer shadow-sm">
              <a href={upgrade.whatsapp_url} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4 mr-2" />
                Falar com Especialista
                <ArrowUpRight className="size-3.5 ml-1" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Seção de Capacidade & Consumo em Tempo Real */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Users className="size-4 text-[#D4AF37]" />
          Capacidade &amp; Consumo de Recursos em Tempo Real
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Dentistas */}
          <Card className="border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Dentistas Ativos
              </CardTitle>
              <Stethoscope className="size-4 text-primary" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">{capacidade.dentistas.atual}</span>
                <span className="text-xs text-muted-foreground">
                  de {capacidade.dentistas.ilimitado ? 'Ilimitados' : capacidade.dentistas.limite}
                </span>
              </div>

              {!capacidade.dentistas.ilimitado && (
                <div className="space-y-1">
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all rounded-full ${
                        capacidade.dentistas.atingiu_limite
                          ? 'bg-destructive'
                          : capacidade.dentistas.percentual > 80
                          ? 'bg-amber-500'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(capacidade.dentistas.percentual, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{capacidade.dentistas.percentual}% ocupado</span>
                    {capacidade.dentistas.atingiu_limite && <span className="text-destructive font-bold">Limite atingido</span>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usuários da Equipe */}
          <Card className="border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Usuários da Equipe
              </CardTitle>
              <Users className="size-4 text-primary" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">{capacidade.usuarios.atual}</span>
                <span className="text-xs text-muted-foreground">
                  de {capacidade.usuarios.ilimitado ? 'Ilimitados' : capacidade.usuarios.limite}
                </span>
              </div>

              {!capacidade.usuarios.ilimitado && (
                <div className="space-y-1">
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all rounded-full ${
                        capacidade.usuarios.atingiu_limite
                          ? 'bg-destructive'
                          : capacidade.usuarios.percentual > 80
                          ? 'bg-amber-500'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(capacidade.usuarios.percentual, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{capacidade.usuarios.percentual}% ocupado</span>
                    {capacidade.usuarios.atingiu_limite && <span className="text-destructive font-bold">Limite atingido</span>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pacientes Cadastrados */}
          <Card className="border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pacientes Ativos
              </CardTitle>
              <Calendar className="size-4 text-primary" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">{capacidade.pacientes.atual}</span>
                <span className="text-xs text-muted-foreground">
                  de {capacidade.pacientes.ilimitado ? 'Ilimitados' : capacidade.pacientes.limite}
                </span>
              </div>

              {!capacidade.pacientes.ilimitado && (
                <div className="space-y-1">
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all rounded-full"
                      style={{ width: `${Math.min(capacidade.pacientes.percentual, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{capacidade.pacientes.percentual}% ocupado</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Armazenamento */}
          <Card className="border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Armazenamento
              </CardTitle>
              <HardDrive className="size-4 text-primary" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">{capacidade.armazenamento_mb.atual_mb} MB</span>
                <span className="text-xs text-muted-foreground">de {capacidade.armazenamento_mb.limite_mb} MB</span>
              </div>

              <div className="space-y-1">
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all rounded-full"
                    style={{ width: `${Math.min(capacidade.armazenamento_mb.percentual, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{capacidade.armazenamento_mb.percentual}% utilizado</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
