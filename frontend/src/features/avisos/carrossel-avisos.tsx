import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { iconeAviso } from './icones'
import { useAvisosAtivos } from './use-avisos'

/** Exportada para `use-auth.ts` limpar ao logar de novo (nova sessão de login
 * reabre os avisos, mesmo na mesma aba/navegador). */
export const CHAVE_AVISOS_DISPENSADOS = 'avisos_dispensados'

function jaDispensadoNestaSessao(): boolean {
  try {
    return sessionStorage.getItem(CHAVE_AVISOS_DISPENSADOS) === '1'
  } catch {
    return false
  }
}

function marcarDispensado() {
  try {
    sessionStorage.setItem(CHAVE_AVISOS_DISPENSADOS, '1')
  } catch {
    // sessionStorage indisponível (ex.: modo privado) — só não persiste a dispensa.
  }
}

/** Popup em carrossel com as novidades vigentes, aberto uma vez por sessão de
 * login (fecha e some até a pessoa deslogar/logar de novo). */
export function CarrosselAvisos() {
  const { data: avisos } = useAvisosAtivos()
  const [aberto, setAberto] = useState(false)
  const [indice, setIndice] = useState(0)

  useEffect(() => {
    if (avisos && avisos.length > 0 && !jaDispensadoNestaSessao()) {
      setAberto(true)
    }
  }, [avisos])

  const total = avisos?.length ?? 0

  useEffect(() => {
    if (!aberto || total <= 1) return
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'ArrowRight') setIndice((i) => (i + 1) % total)
      if (evento.key === 'ArrowLeft') setIndice((i) => (i - 1 + total) % total)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto, total])

  function fechar() {
    marcarDispensado()
    setAberto(false)
  }

  if (!avisos || avisos.length === 0) return null

  return (
    <Dialog open={aberto} onOpenChange={(novoAberto) => !novoAberto && fechar()}>
      <DialogContent
        className={cn(
          'max-w-2xl gap-0 overflow-hidden rounded-xl border-none p-0 shadow-2xl',
          '[&>button]:z-10 [&>button]:rounded-full [&>button]:bg-black/30 [&>button]:p-1.5',
          '[&>button]:text-white [&>button]:backdrop-blur-sm [&>button]:hover:bg-black/40 [&>button]:hover:text-white',
        )}
      >

        <DialogTitle className="sr-only">Novidades</DialogTitle>

        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${indice * 100}%)` }}
          >
            {avisos.map((aviso) => {
              const IconeAviso = iconeAviso(aviso.icone)
              return (
                <div key={aviso.id} className="w-full shrink-0">
                  <div className="relative h-64 w-full overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/70">
                    {aviso.imagem_url ? (
                      <img
                        src={aviso.imagem_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <IconeAviso className="size-20 text-primary-foreground/40" strokeWidth={1.5} />
                      </div>
                    )}
                    <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                      <Megaphone className="size-3" />
                      Novidade
                    </div>
                    {total > 1 && (
                      <div className="absolute bottom-3 right-4 rounded-full bg-black/30 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                        {indice + 1}/{total}
                      </div>
                    )}
                  </div>

                  <div className="px-8 pb-8 pt-6">
                    <h3 className="text-2xl font-semibold tracking-tight">{aviso.titulo}</h3>
                    {aviso.descricao && (
                      <p className="mt-2.5 text-base leading-relaxed text-muted-foreground">
                        {aviso.descricao}
                      </p>
                    )}
                    {aviso.link_url && (
                      <Button asChild className="mt-5">
                        <a href={aviso.link_url} target="_blank" rel="noreferrer">
                          {aviso.link_rotulo || 'Saiba mais'}
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {total > 1 && (
          <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setIndice((i) => (i - 1 + total) % total)}
              aria-label="Aviso anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex items-center gap-1.5">
              {avisos.map((aviso, i) => (
                <button
                  key={aviso.id}
                  type="button"
                  aria-label={`Ir para o aviso ${i + 1}`}
                  onClick={() => setIndice(i)}
                  className={cn(
                    'h-1.5 cursor-pointer rounded-full transition-all',
                    i === indice ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50',
                  )}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setIndice((i) => (i + 1) % total)}
              aria-label="Próximo aviso"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
