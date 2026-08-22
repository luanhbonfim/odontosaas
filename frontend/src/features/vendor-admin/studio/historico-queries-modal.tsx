import { useState } from 'react'
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Trash2,
  ArrowUpRight,
  Database,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { HistoricoItem } from './use-vendor-studio'

interface HistoricoQueriesModalProps {
  aberto: boolean
  aoFechar: () => void
  historico: HistoricoItem[]
  aoSelecionarQuery: (sql: string, schema: string) => void
  aoLimparHistorico: () => void
}

export function HistoricoQueriesModal({
  aberto,
  aoFechar,
  historico,
  aoSelecionarQuery,
  aoLimparHistorico,
}: HistoricoQueriesModalProps) {
  const [busca, setBusca] = useState('')

  const itensFiltrados = historico.filter(
    (item) =>
      item.sql.toLowerCase().includes(busca.toLowerCase()) ||
      item.schema.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-2xl border-[#1E2D56] bg-[#111D3B] text-slate-100">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <History className="size-5 text-[#D4AF37]" />
              <DialogTitle className="text-lg font-bold text-slate-100">
                Histórico de Consultas SQL
              </DialogTitle>
            </div>
            {historico.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={aoLimparHistorico}
                className="h-8 text-xs text-rose-400 hover:bg-rose-950/50 hover:text-rose-300"
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Limpar Histórico
              </Button>
            )}
          </div>
          <DialogDescription className="text-xs text-slate-400">
            Últimas {historico.length} consultas executadas na sua sessão do Database Studio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-500" />
            <Input
              placeholder="Filtrar por SQL ou nome de schema..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-9 border-[#1E2D56] bg-[#0B132B]/80 pl-9 text-xs text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="max-h-[380px] space-y-2.5 overflow-y-auto pr-1">
            {itensFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-slate-500">
                <Database className="size-8 opacity-30" />
                <p className="mt-2 text-xs">Nenhuma consulta encontrada no histórico.</p>
              </div>
            ) : (
              itensFiltrados.map((item) => (
                <div
                  key={item.id}
                  className="group rounded-lg border border-[#1E2D56] bg-[#0B132B]/80 p-3 transition-colors hover:bg-[#0B132B]"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      {item.sucesso ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-medium">
                          <CheckCircle2 className="size-3.5" />
                          Sucesso
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 font-medium">
                          <XCircle className="size-3.5" />
                          Erro
                        </span>
                      )}
                      <span className="text-slate-500">•</span>
                      <span className="font-mono text-slate-400">schema: <strong>{item.schema}</strong></span>
                      <span className="text-slate-500">•</span>
                      <Badge
                        variant="outline"
                        className={
                          item.modo === 'RW'
                            ? 'border-red-500/40 text-red-400 text-[10px] py-0 h-4'
                            : 'border-emerald-500/40 text-emerald-400 text-[10px] py-0 h-4'
                        }
                      >
                        {item.modo}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="size-3" />
                        {new Date(item.dataHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      {item.duracao_ms !== undefined && (
                        <span className="text-[11px] font-mono text-slate-500">{item.duracao_ms}ms</span>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          aoSelecionarQuery(item.sql, item.schema)
                          aoFechar()
                        }}
                        className="h-6 gap-1 px-2 text-[11px] font-medium bg-[#1C2C54] hover:bg-[#D4AF37] hover:text-slate-950 text-slate-200"
                      >
                        Usar Query
                        <ArrowUpRight className="size-3" />
                      </Button>
                    </div>
                  </div>

                  <pre className="mt-2 max-h-20 overflow-x-auto rounded bg-[#0B132B] p-2 font-mono text-xs text-slate-300">
                    {item.sql}
                  </pre>

                  {item.erro && (
                    <p className="mt-1.5 text-[11px] text-red-400/90 font-mono">
                      Erro: {item.erro}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
