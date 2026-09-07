import { ChevronRight, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/common/empty-state'
import { LinhaToggle } from '@/components/common/form-kit'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ErroApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import {
  type CelulaPermissao,
  type PapelCustomizavel,
  usePermissoesModulo,
  useSalvarPermissoesModulo,
} from './use-permissoes'

const PAPEIS: { valor: PapelCustomizavel; rotulo: string }[] = [
  { valor: 'RECEPCAO', rotulo: 'Recepção' },
  { valor: 'DENTISTA', rotulo: 'Dentista' },
]

type CampoCrud = 'criar' | 'editar' | 'excluir'

/** Substantivo (+ artigo/gênero) usado nas frases descritivas de cada módulo —
 * ex.: "Permite cadastrar nova consulta" em vez do genérico "Criar". */
const CONFIG_MODULO: {
  valor: string
  rotulo: string
  substantivo: string
  artigo: 'o' | 'a'
  novo: 'novo' | 'nova'
}[] = [
  { valor: 'agenda', rotulo: 'Agenda', substantivo: 'consulta', artigo: 'a', novo: 'nova' },
  { valor: 'pacientes', rotulo: 'Pacientes', substantivo: 'paciente', artigo: 'o', novo: 'novo' },
  { valor: 'convenios', rotulo: 'Convênios', substantivo: 'convênio', artigo: 'o', novo: 'novo' },
  { valor: 'dentistas', rotulo: 'Dentistas', substantivo: 'dentista', artigo: 'o', novo: 'novo' },
  {
    valor: 'procedimentos',
    rotulo: 'Procedimentos',
    substantivo: 'procedimento',
    artigo: 'o',
    novo: 'novo',
  },
  { valor: 'estoque', rotulo: 'Estoque', substantivo: 'insumo', artigo: 'o', novo: 'novo' },
  { valor: 'financeiro', rotulo: 'Financeiro', substantivo: 'lançamento', artigo: 'o', novo: 'novo' },
  {
    valor: 'notificacoes',
    rotulo: 'WhatsApp',
    substantivo: 'modelo de mensagem',
    artigo: 'o',
    novo: 'novo',
  },
  { valor: 'usuarios', rotulo: 'Equipe', substantivo: 'usuário', artigo: 'o', novo: 'novo' },
]

const ROTULO_CURTO: Record<CampoCrud, string> = {
  criar: 'Criar',
  editar: 'Editar',
  excluir: 'Excluir',
}

function rotuloCampo(campo: CampoCrud, cfg: (typeof CONFIG_MODULO)[number]): string {
  if (campo === 'criar') return `Permite cadastrar ${cfg.novo} ${cfg.substantivo}`
  if (campo === 'editar') return `Permite editar ${cfg.artigo} ${cfg.substantivo}`
  return `Permite excluir ${cfg.artigo} ${cfg.substantivo}`
}

function CardModulo({
  rotuloPapel,
  cfg,
  celula,
  aberto,
  aoAlternarAberto,
  aoMudar,
}: {
  rotuloPapel: string
  cfg: (typeof CONFIG_MODULO)[number]
  celula: CelulaPermissao
  aberto: boolean
  aoAlternarAberto: () => void
  aoMudar: (campo: 'ver' | CampoCrud, valor: boolean) => void
}) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={aoAlternarAberto}
          aria-expanded={aberto}
          aria-label={`${aberto ? 'Recolher' : 'Expandir'} permissões de ${cfg.rotulo}`}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
        >
          <ChevronRight className={cn('size-4 transition-transform', aberto && 'rotate-90')} />
        </button>
        <button
          type="button"
          onClick={aoAlternarAberto}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium"
        >
          {cfg.rotulo}
        </button>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
          Ver
          <input
            type="checkbox"
            aria-label={`${rotuloPapel} — ${cfg.rotulo} — Ver`}
            className="size-4 cursor-pointer accent-primary"
            checked={celula.ver}
            onChange={(e) => aoMudar('ver', e.target.checked)}
          />
        </label>
      </div>
      {aberto && (
        <div className="space-y-2 border-t p-3">
          {!celula.ver && (
            <p className="text-xs text-muted-foreground">
              Ative &quot;Ver&quot; acima para liberar as permissões abaixo.
            </p>
          )}
          {(['criar', 'editar', 'excluir'] as const).map((campo) => (
            <LinhaToggle
              key={campo}
              titulo={rotuloCampo(campo, cfg)}
              aria-label={`${rotuloPapel} — ${cfg.rotulo} — ${ROTULO_CURTO[campo]}`}
              checked={celula[campo]}
              disabled={!celula.ver}
              onChange={(e) => aoMudar(campo, e.target.checked)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GrupoPapel({
  papel,
  rotulo,
  grade,
  aoMudar,
}: {
  papel: PapelCustomizavel
  rotulo: string
  grade: CelulaPermissao[]
  aoMudar: (modulo: string, campo: 'ver' | CampoCrud, valor: boolean) => void
}) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set())

  function alternar(modulo: string) {
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(modulo)) novo.delete(modulo)
      else novo.add(modulo)
      return novo
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{rotulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {CONFIG_MODULO.map((cfg) => {
          const celula = grade.find((c) => c.papel === papel && c.modulo === cfg.valor)
          if (!celula) return null
          return (
            <CardModulo
              key={cfg.valor}
              rotuloPapel={rotulo}
              cfg={cfg}
              celula={celula}
              aberto={abertos.has(cfg.valor)}
              aoAlternarAberto={() => alternar(cfg.valor)}
              aoMudar={(campo, valor) => aoMudar(cfg.valor, campo, valor)}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}

export function PermissoesPage() {
  const { data, isLoading, isError } = usePermissoesModulo()
  const salvar = useSalvarPermissoesModulo()
  const [grade, setGrade] = useState<CelulaPermissao[] | null>(null)

  useEffect(() => {
    if (data) setGrade(data)
  }, [data])

  function aoMudar(papel: PapelCustomizavel, modulo: string, campo: 'ver' | CampoCrud, valor: boolean) {
    setGrade((atual) =>
      (atual ?? []).map((celula) => {
        if (celula.papel !== papel || celula.modulo !== modulo) return celula
        // Sem "ver" não faz sentido ter criar/editar/excluir marcados.
        if (campo === 'ver' && !valor) {
          return { ...celula, ver: false, criar: false, editar: false, excluir: false }
        }
        return { ...celula, [campo]: valor }
      }),
    )
  }

  async function salvarGrade() {
    if (!grade) return
    try {
      await salvar.mutateAsync(grade)
      toast.success('Permissões salvas.')
    } catch (excecao) {
      toast.error((excecao as ErroApi).mensagem ?? 'Não foi possível salvar as permissões.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Permissões"
        descricao='Defina quais telas a Recepção e o Dentista enxergam. Clique numa tela para detalhar o que cada um pode criar, editar ou excluir nela. Gerente e Admin sempre têm acesso total.'
      />

      {isError ? (
        <EmptyState
          icone={Lock}
          titulo="Acesso restrito"
          descricao="Só Gerente ou Admin podem configurar permissões."
        />
      ) : isLoading || !grade ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {PAPEIS.map((p) => (
              <GrupoPapel
                key={p.valor}
                papel={p.valor}
                rotulo={p.rotulo}
                grade={grade}
                aoMudar={(modulo, campo, valor) => aoMudar(p.valor, modulo, campo, valor)}
              />
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={salvarGrade} disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
