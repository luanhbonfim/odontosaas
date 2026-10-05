// Orçamento de bundle (tamanhos em KB **gzip**). Rode depois do build: `npm run build:check`.
// Falha (exit 1) se o carregamento inicial ou algum chunk estourar o limite — evita que
// uma importação estática acidental (ex.: gráficos/calendário no pacote inicial) passe batido.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const ORCAMENTO = {
  /** JS que o navegador baixa para abrir QUALQUER tela (entrada + modulepreload). */
  inicialJs: 180,
  /** CSS do carregamento inicial. */
  inicialCss: 25,
  /** Maior chunk individual (telas com gráficos/calendário ficam perto do limite). */
  maiorChunk: 130,
}

const dist = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist')
const kb = (bytes) => bytes / 1024
const gzipKb = (arquivo) => kb(gzipSync(readFileSync(join(dist, arquivo))).length)

const html = readFileSync(join(dist, 'index.html'), 'utf8')
const refs = (regex) => [...html.matchAll(regex)].map((m) => m[1].replace(/^\//, ''))
const jsIniciais = [
  ...refs(/<script[^>]+type="module"[^>]+src="([^"]+)"/g),
  ...refs(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
]
const cssIniciais = refs(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)

const somaJs = jsIniciais.reduce((total, f) => total + gzipKb(f), 0)
const somaCss = cssIniciais.reduce((total, f) => total + gzipKb(f), 0)

const chunks = readdirSync(join(dist, 'assets'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ arquivo: f, gzip: gzipKb(`assets/${f}`) }))
  .sort((a, b) => b.gzip - a.gzip)
const maior = chunks[0]

const linhas = [
  ['JS inicial', somaJs, ORCAMENTO.inicialJs, `${jsIniciais.length} arquivos`],
  ['CSS inicial', somaCss, ORCAMENTO.inicialCss, `${cssIniciais.length} arquivo(s)`],
  ['Maior chunk', maior.gzip, ORCAMENTO.maiorChunk, maior.arquivo],
]

let estourou = false
console.log('\nOrçamento de bundle (KB gzip)')
for (const [nome, valor, limite, detalhe] of linhas) {
  const ok = valor <= limite
  if (!ok) estourou = true
  console.log(
    `${ok ? 'OK  ' : 'FALHA'}  ${nome.padEnd(12)} ${valor.toFixed(1).padStart(7)} / ${String(limite).padStart(4)}   ${detalhe}`,
  )
}
console.log(`\nTotal de chunks JS: ${chunks.length} (5 maiores: ${chunks
  .slice(0, 5)
  .map((c) => `${c.arquivo.split('-')[0]} ${c.gzip.toFixed(0)}`)
  .join(', ')})`)

if (estourou) {
  console.error('\nOrçamento de bundle estourado. Veja o que entrou no pacote inicial.')
  process.exit(1)
}
