import { useState, useMemo } from 'react'
import {
  Database,
  Play,
  History,
  Download,
  Search,
  Table as TableIcon,
  Key,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  RotateCw,
  ChevronRight,
  ChevronDown,
  Info,
  Check,
  Copy,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useVendorStudio, type ColunaInfo } from './use-vendor-studio'
import { JustificativaEscritaModal } from './justificativa-escrita-modal'
import { HistoricoQueriesModal } from './historico-queries-modal'

const LIMITES_OPCOES = [50, 100, 250, 500, 1000]

export function DatabaseStudioPage() {
  const [schemaSelecionado, setSchemaSelecionado] = useState('public')
  const [modo, setModo] = useState<'RO' | 'RW'>('RO')
  const [limiteLinhas, setLimiteLinhas] = useState(100)
  const [sql, setSql] = useState('SELECT * FROM information_schema.tables LIMIT 10;')
  const [filtroTabelas, setFiltroTabelas] = useState('')
  const [tabelaExpandida, setTabelaExpandida] = useState<string | null>(null)
  const [modalJustificativaAberto, setModalJustificativaAberto] = useState(false)
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false)
  const [copiadoCell, setCopiadoCell] = useState<string | null>(null)

  const {
    schemas,
    carregandoSchemas,
    tabelas,
    carregandoTabelas,
    recarregarTabelas,
    executarQuery,
    executando,
    erroExecucao,
    resultadoAtual,
    historico,
    limparHistorico,
  } = useVendorStudio(schemaSelecionado)

  // Filtragem de tabelas
  const tabelasFiltradas = useMemo(() => {
    return tabelas.filter((t) =>
      t.tabela.toLowerCase().includes(filtroTabelas.toLowerCase())
    )
  }, [tabelas, filtroTabelas])

  // Submissão do SQL
  async function dispararExecucao(justificativaParam?: string) {
    const sqlLimpo = sql.trim()
    if (!sqlLimpo) {
      toast.error('Informe um comando SQL para executar.')
      return
    }

    if (modo === 'RW' && !justificativaParam) {
      setModalJustificativaAberto(true)
      return
    }

    try {
      const res = await executarQuery({
        schema: schemaSelecionado,
        sql: sqlLimpo,
        modo,
        limite_linhas: limiteLinhas,
        justificativa: justificativaParam,
      })

      if (modalJustificativaAberto) {
        setModalJustificativaAberto(false)
      }

      if (res.modo === 'RW') {
        toast.success(`Comando RW executado com sucesso! Linhas afetadas: ${res.linhas_afetadas}`)
      } else {
        toast.success(`Consulta executada em ${res.duracao_ms}ms (${res.total_linhas} linhas)`)
      }
    } catch (err: unknown) {
      const msg = (err as { mensagem?: string })?.mensagem || 'Erro na execução da instrução SQL.'
      toast.error(msg)
    }
  }

  // Exportação CSV
  function exportarCSV() {
    if (!resultadoAtual || !resultadoAtual.colunas.length) return
    const cabecalho = resultadoAtual.colunas.join(',')
    const linhasCsv = resultadoAtual.linhas.map((row) =>
      row
        .map((val) => {
          if (val === null || val === undefined) return ''
          const str = String(val).replace(/"/g, '""')
          return `"${str}"`
        })
        .join(',')
    )
    const conteudo = [cabecalho, ...linhasCsv].join('\n')
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query_${schemaSelecionado}_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Resultados exportados em CSV.')
  }

  // Exportação JSON
  function exportarJSON() {
    if (!resultadoAtual || !resultadoAtual.colunas.length) return
    const objetos = resultadoAtual.linhas.map((row) => {
      const obj: Record<string, unknown> = {}
      resultadoAtual.colunas.forEach((col, idx) => {
        obj[col] = row[idx]
      })
      return obj
    })
    const blob = new Blob([JSON.stringify(objetos, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query_${schemaSelecionado}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Resultados exportados em JSON.')
  }

  // Inserir snippet rápido de SELECT
  function inserirSelectTabela(tabelaNome: string) {
    setSql(`SELECT * FROM ${tabelaNome} LIMIT ${limiteLinhas};`)
  }

  function copiarCelula(valor: unknown, chave: string) {
    const texto = valor === null ? 'null' : String(valor)
    navigator.clipboard.writeText(texto)
    setCopiadoCell(chave)
    setTimeout(() => setCopiadoCell(null), 1500)
    toast.success('Copiado para a área de transferência')
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col space-y-3 p-4 md:p-6 overflow-hidden">
      {/* Header Superior da Barra de Ferramentas do Studio */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1C2C54] bg-[#0F1B38] p-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#D4AF37]/15 text-[#D4AF37]">
            <Database className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Database Studio
              <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-[10px]">
                PostgreSQL
              </Badge>
            </h1>
            <p className="text-xs text-slate-400">Console SQL interativo com isolamento de schema e auditoria</p>
          </div>
        </div>

        {/* Controles de Contexto & Execução */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Schema */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Schema:</span>
            <select
              value={schemaSelecionado}
              onChange={(e) => {
                setSchemaSelecionado(e.target.value)
                setTabelaExpandida(null)
              }}
              disabled={carregandoSchemas || executando}
              className="h-8 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-slate-100 focus:border-[#D4AF37] focus:outline-none"
            >
              {schemas.map((s) => (
                <option key={s.schema_name} value={s.schema_name}>
                  {s.schema_name} ({s.total_tabelas} tab)
                </option>
              ))}
            </select>
          </div>

          {/* Alternador de Modo RO / RW */}
          <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 p-0.5">
            <button
              type="button"
              onClick={() => setModo('RO')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                modo === 'RO'
                  ? 'bg-emerald-500/20 text-emerald-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Modo Seguro: Permite apenas comandos de leitura (SELECT) sob o role odonto_studio_ro."
            >
              <ShieldCheck className="size-3.5" />
              Read-Only
            </button>
            <button
              type="button"
              onClick={() => setModo('RW')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                modo === 'RW'
                  ? 'bg-red-500/20 text-red-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Modo DML/Escrita: Exclusivo para SuperAdmin. Exige justificativa auditada."
            >
              <ShieldAlert className="size-3.5" />
              Escrita (RW)
            </button>
          </div>

          {/* Limite de Linhas */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Limite:</span>
            <select
              value={limiteLinhas}
              onChange={(e) => setLimiteLinhas(Number(e.target.value))}
              disabled={executando}
              className="h-8 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 focus:border-[#D4AF37] focus:outline-none"
            >
              {LIMITES_OPCOES.map((lim) => (
                <option key={lim} value={lim}>
                  {lim} linhas
                </option>
              ))}
            </select>
          </div>

          {/* Botão de Histórico */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalHistoricoAberto(true)}
            className="h-8 border-slate-700 bg-slate-900 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <History className="mr-1.5 size-3.5 text-slate-400" />
            Histórico ({historico.length})
          </Button>

          {/* Botão Executar */}
          <Button
            size="sm"
            onClick={() => dispararExecucao()}
            disabled={executando || !sql.trim()}
            className="h-8 bg-[#D4AF37] text-xs font-bold text-slate-950 hover:bg-[#E5C158] disabled:opacity-50"
          >
            {executando ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Play className="mr-1.5 size-3.5 fill-current" />
                Executar (Ctrl+Enter)
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Grid Principal: Explorer de Tabelas (Esquerda) e Console + Resultados (Direita) */}
      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-12 overflow-hidden">
        {/* Painel Esquerdo: Dicionário & Tabelas do Schema */}
        <div className="flex flex-col rounded-xl border border-[#1C2C54] bg-[#0F1B38] p-3 md:col-span-3 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <TableIcon className="size-4 text-[#D4AF37]" />
              <span>Tabelas ({tabelas.length})</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => recarregarTabelas()}
              disabled={carregandoTabelas}
              className="size-6 text-slate-400 hover:text-slate-200"
              title="Recarregar tabelas"
            >
              <RotateCw className={`size-3.5 ${carregandoTabelas ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Busca de tabela */}
          <div className="relative my-2">
            <Search className="absolute left-2.5 top-2 size-3.5 text-slate-500" />
            <Input
              placeholder="Filtrar tabelas..."
              value={filtroTabelas}
              onChange={(e) => setFiltroTabelas(e.target.value)}
              className="h-7.5 border-slate-800 bg-slate-900 pl-8 text-xs text-slate-100 placeholder:text-slate-500"
            />
          </div>

          {/* Lista de Tabelas */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-1">
            {carregandoTabelas ? (
              <div className="flex items-center justify-center py-8 text-slate-500 text-xs gap-2">
                <Loader2 className="size-4 animate-spin" />
                Carregando dicionário...
              </div>
            ) : tabelasFiltradas.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">Nenhuma tabela encontrada.</p>
            ) : (
              tabelasFiltradas.map((tab) => {
                const expandida = tabelaExpandida === tab.tabela
                return (
                  <div
                    key={tab.tabela}
                    className="rounded-md border border-slate-800/80 bg-slate-900/40 text-xs overflow-hidden"
                  >
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-slate-800/50 cursor-pointer text-left"
                      onClick={() => setTabelaExpandida(expandida ? null : tab.tabela)}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {expandida ? (
                          <ChevronDown className="size-3.5 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="size-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="font-mono text-slate-200 truncate" title={tab.tabela}>
                          {tab.tabela}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="secondary" className="bg-slate-800 text-[10px] px-1.5 py-0 h-4">
                          {tab.colunas.length} cols
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            inserirSelectTabela(tab.tabela)
                          }}
                          className="size-5 text-slate-400 hover:text-[#D4AF37]"
                          title="Inserir SELECT na tela"
                        >
                          <Play className="size-2.5" />
                        </Button>
                      </div>
                    </button>

                    {/* Colunas da tabela */}
                    {expandida && (
                      <div className="border-t border-slate-800 bg-slate-950/70 p-2 space-y-1">
                        {tab.colunas.map((col: ColunaInfo) => (
                          <div
                            key={col.nome}
                            className="flex items-center justify-between text-[11px] font-mono text-slate-400"
                          >
                            <span className="flex items-center gap-1">
                              {col.is_pk && (
                                <span title="Chave Primária" className="inline-flex">
                                  <Key className="size-2.5 text-[#D4AF37]" />
                                </span>
                              )}
                              <span className={col.is_pk ? 'text-amber-300 font-semibold' : 'text-slate-300'}>
                                {col.nome}
                              </span>
                            </span>
                            <span className="text-[10px] text-slate-500">{col.tipo}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Painel Direito: Editor SQL (Topo) e Resultados (Base) */}
        <div className="flex flex-col rounded-xl border border-[#1C2C54] bg-[#0F1B38] p-3 md:col-span-9 overflow-hidden shadow-sm space-y-3">
          {/* Editor SQL com atalho Ctrl+Enter */}
          <div className="flex flex-col rounded-lg border border-slate-700 bg-slate-950 p-2 relative">
            <div className="flex items-center justify-between pb-1 text-[11px] text-slate-400 border-b border-slate-800/80 mb-1.5">
              <span className="font-mono text-[#D4AF37] font-semibold">Console SQL</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500">Pressione Ctrl+Enter para executar</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSql('SELECT ')}
                  className="h-5 px-1.5 text-[10px] text-slate-400 hover:text-white"
                >
                  Limpar
                </Button>
              </div>
            </div>

            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault()
                  dispararExecucao()
                }
              }}
              rows={5}
              placeholder="Digite o comando SQL aqui... (ex: SELECT * FROM agenda_consulta ORDER BY id DESC LIMIT 50;)"
              className="w-full resize-y bg-transparent font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none"
              spellCheck={false}
            />
          </div>

          {/* Painel de Resultados */}
          <div className="flex flex-1 flex-col rounded-lg border border-slate-800 bg-slate-950/60 overflow-hidden">
            {/* Barra de Status e Exportação do Resultado */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-200">Resultado da Consulta</span>
                {resultadoAtual && (
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <span className="font-mono text-emerald-400 font-medium">
                      {resultadoAtual.total_linhas} linhas retornadas
                    </span>
                    <span>•</span>
                    <span className="font-mono text-slate-400">{resultadoAtual.duracao_ms}ms</span>
                    {resultadoAtual.truncado && (
                      <>
                        <span>•</span>
                        <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px] py-0">
                          Truncado ({limiteLinhas} max)
                        </Badge>
                      </>
                    )}
                  </div>
                )}
              </div>

              {resultadoAtual && resultadoAtual.colunas.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportarCSV}
                    className="h-6 gap-1 px-2 text-[11px] border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  >
                    <Download className="size-3" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportarJSON}
                    className="h-6 gap-1 px-2 text-[11px] border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  >
                    <Download className="size-3" />
                    JSON
                  </Button>
                </div>
              )}
            </div>

            {/* Visualizador de Tabela de Resultados */}
            <div className="flex-1 overflow-auto p-1">
              {erroExecucao ? (
                <div className="m-3 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-300">
                  <AlertCircle className="size-4 shrink-0 text-red-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-red-200">Falha na execução SQL:</p>
                    <pre className="font-mono text-[11px] text-red-300/90 whitespace-pre-wrap">
                      {erroExecucao.mensagem}
                    </pre>
                  </div>
                </div>
              ) : !resultadoAtual ? (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center text-slate-500">
                  <Info className="size-8 opacity-20" />
                  <p className="mt-2 text-xs">Execute uma consulta SQL para visualizar os registros.</p>
                  <p className="text-[11px] text-slate-600">Dica: Selecione uma tabela à esquerda para gerar o SELECT automaticamente.</p>
                </div>
              ) : resultadoAtual.colunas.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-12 text-center text-emerald-400">
                  <Check className="size-8" />
                  <p className="mt-2 text-xs font-semibold">Comando executado com sucesso!</p>
                  <p className="text-[11px] text-slate-400">Linhas afetadas: {resultadoAtual.linhas_afetadas}</p>
                </div>
              ) : (
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-900 text-slate-300 shadow-xs z-10">
                    <tr>
                      <th className="p-2 border-b border-r border-slate-800 text-slate-500 w-10 text-center select-none">
                        #
                      </th>
                      {resultadoAtual.colunas.map((col) => (
                        <th
                          key={col}
                          className="p-2 border-b border-r border-slate-800 font-semibold text-slate-200 whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultadoAtual.linhas.map((linha, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-1.5 border-r border-slate-800 text-slate-600 text-center select-none text-[11px]">
                          {idx + 1}
                        </td>
                        {linha.map((val, colIdx) => {
                          const cellKey = `${idx}-${colIdx}`
                          const foiCopiado = copiadoCell === cellKey
                          const ehNulo = val === null || val === undefined
                          return (
                            <td
                              key={colIdx}
                              onClick={() => copiarCelula(val, cellKey)}
                              className="p-1.5 border-r border-slate-800/60 text-slate-300 whitespace-nowrap max-w-xs truncate cursor-pointer hover:bg-slate-700/40 relative group"
                              title="Clique para copiar valor"
                            >
                              {ehNulo ? (
                                <span className="text-slate-600 italic">null</span>
                              ) : typeof val === 'boolean' ? (
                                <span className={val ? 'text-emerald-400' : 'text-rose-400'}>
                                  {String(val)}
                                </span>
                              ) : (
                                String(val)
                              )}
                              <span className="absolute right-1 top-1.5 hidden group-hover:block text-slate-400">
                                {foiCopiado ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modais de Justificativa e Histórico */}
      <JustificativaEscritaModal
        aberto={modalJustificativaAberto}
        aoFechar={() => setModalJustificativaAberto(false)}
        aoConfirmar={(justificativa) => dispararExecucao(justificativa)}
        schema={schemaSelecionado}
        sql={sql}
        executando={executando}
      />

      <HistoricoQueriesModal
        aberto={modalHistoricoAberto}
        aoFechar={() => setModalHistoricoAberto(false)}
        historico={historico}
        aoSelecionarQuery={(sqlHist, schemaHist) => {
          setSql(sqlHist)
          setSchemaSelecionado(schemaHist)
        }}
        aoLimparHistorico={limparHistorico}
      />
    </div>
  )
}
