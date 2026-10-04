import axe from 'axe-core'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/** Roda o axe (WCAG 2.1 A/AA) num trecho renderizado e devolve as violações em texto
 * legível (`regra: seletores`). `color-contrast` fica de fora: o jsdom não calcula
 * cores — o contraste é conferido no navegador (auditoria ao vivo / tokens do tema). */
export async function violacoesAxe(container: Element): Promise<string[]> {
  const resultado = await axe.run(container, {
    runOnly: { type: 'tag', values: TAGS },
    rules: { 'color-contrast': { enabled: false } },
  })
  return resultado.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  )
}
