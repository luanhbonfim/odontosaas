import { CalendarDays, Loader2, Search, User } from 'lucide-react'
import { type KeyboardEvent, useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { cn } from '@/lib/utils'
import { formatarCpf, formatarDataHora } from '@/lib/utils/format'

import { ROTULO_STATUS } from '../agenda/use-agenda'
import { MIN_CARACTERES_BUSCA, useBusca } from './use-busca'

type Opcao = {
  chave: string
  tipo: 'paciente' | 'consulta'
  rotulo: string
  detalhe: string
  para: string
}

/** Busca global (Topbar): botão/atalho Ctrl+K abre uma paleta com resultados de
 * pacientes e consultas; ↑/↓ navegam, Enter abre, Esc fecha. */
export function BuscaGlobal() {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [ativo, setAtivo] = useState(0)
  const navegar = useNavigate()
  const idLista = useId()
  const debounced = useDebounce(termo, 300)
  const { data, isFetching, isError } = useBusca(debounced)

  useEffect(() => {
    function aoTeclar(evento: globalThis.KeyboardEvent) {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault()
        setAberto(true)
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  const opcoesPacientes: Opcao[] = (data?.pacientes ?? []).map((p) => ({
    chave: `p-${p.id}`,
    tipo: 'paciente',
    rotulo: p.nome_completo,
    detalhe: [p.cpf ? formatarCpf(p.cpf) : '', p.ativo ? '' : 'Inativo'].filter(Boolean).join(' · '),
    para: `/pacientes/${p.id}`,
  }))
  const opcoesConsultas: Opcao[] = (data?.consultas ?? []).map((c) => ({
    chave: `c-${c.id}`,
    tipo: 'consulta',
    rotulo: c.paciente_nome,
    detalhe: [formatarDataHora(c.inicio), c.procedimento, ROTULO_STATUS[c.status] ?? c.status]
      .filter(Boolean)
      .join(' · '),
    para: `/agenda?consulta=${c.id}`,
  }))
  const opcoes = [...opcoesPacientes, ...opcoesConsultas]
  const consultou = debounced.trim().length >= MIN_CARACTERES_BUSCA
  const idOpcao = (indice: number) => `${idLista}-op-${indice}`

  function alternar(valor: boolean) {
    setAberto(valor)
    if (!valor) {
      setTermo('')
      setAtivo(0)
    }
  }

  function abrir(opcao: Opcao) {
    alternar(false)
    navegar(opcao.para)
  }

  function aoTeclarNoCampo(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'ArrowDown' && opcoes.length) {
      evento.preventDefault()
      setAtivo((i) => (i + 1) % opcoes.length)
    } else if (evento.key === 'ArrowUp' && opcoes.length) {
      evento.preventDefault()
      setAtivo((i) => (i - 1 + opcoes.length) % opcoes.length)
    } else if (evento.key === 'Enter' && opcoes[ativo]) {
      evento.preventDefault()
      abrir(opcoes[ativo])
    }
  }

  function renderGrupo(titulo: string, itens: Opcao[], deslocamento: number) {
    if (itens.length === 0) return null
    return (
      <li role="presentation">
        <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">{titulo}</p>
        <ul role="group" aria-label={titulo}>
          {itens.map((opcao, i) => {
            const indice = deslocamento + i
            const Icone = opcao.tipo === 'paciente' ? User : CalendarDays
            return (
              // Teclado: tratado no campo (padrão combobox: ↑/↓/Enter com aria-activedescendant).
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <li
                key={opcao.chave}
                id={idOpcao(indice)}
                role="option"
                aria-selected={indice === ativo}
                onMouseMove={() => setAtivo(indice)}
                onClick={() => abrir(opcao)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm',
                  indice === ativo && 'bg-accent text-accent-foreground',
                )}
              >
                <Icone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{opcao.rotulo}</span>
                  {opcao.detalhe && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {opcao.detalhe}
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </li>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label="Buscar paciente ou consulta"
        onClick={() => setAberto(true)}
        className="gap-2 text-muted-foreground"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Buscar…</span>
        <kbd className="hidden rounded border px-1.5 text-[10px] font-medium md:inline">Ctrl K</kbd>
      </Button>

      <Dialog open={aberto} onOpenChange={alternar}>
        <DialogContent className="top-[20%] max-w-xl translate-y-0 gap-3 p-4">
          <DialogTitle className="sr-only">Busca global</DialogTitle>
          <DialogDescription className="sr-only">
            Busque pacientes por nome ou CPF e consultas por paciente ou procedimento.
          </DialogDescription>
          <div className="relative pr-6">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              role="combobox"
              aria-label="Buscar paciente ou consulta"
              aria-expanded={opcoes.length > 0}
              aria-controls={idLista}
              aria-activedescendant={opcoes[ativo] ? idOpcao(ativo) : undefined}
              aria-autocomplete="list"
              placeholder="Paciente (nome ou CPF) ou consulta…"
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value)
                setAtivo(0)
              }}
              onKeyDown={aoTeclarNoCampo}
              className="pl-9"
            />
          </div>

          <ul
            id={idLista}
            role="listbox"
            aria-label="Resultados da busca"
            className="max-h-[50vh] overflow-y-auto"
          >
            {renderGrupo('Pacientes', opcoesPacientes, 0)}
            {renderGrupo('Consultas', opcoesConsultas, opcoesPacientes.length)}
          </ul>

          <div aria-live="polite" className="text-center text-sm text-muted-foreground">
            {!consultou && `Digite ao menos ${MIN_CARACTERES_BUSCA} caracteres.`}
            {consultou && isError && 'Não foi possível buscar. Tente novamente.'}
            {consultou && !isError && isFetching && opcoes.length === 0 && (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Buscando…
              </span>
            )}
            {consultou && !isError && !isFetching && opcoes.length === 0 && 'Nenhum resultado.'}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
