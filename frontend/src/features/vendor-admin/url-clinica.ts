/**
 * Monta a URL de uma clínica (tenant) a partir do domínio dela, adaptando ao ambiente.
 *
 * Usa o MESMO protocolo e porta da janela atual do painel:
 *   - dev:  http://<dominio>:5173/...   (Vite)
 *   - prod: https://<dominio>/...       (sem porta)
 *
 * Evita o bug de abrir a clínica com `http://...:5173` fixo em produção.
 */
export function urlDaClinica(dominio: string, path = '/'): string {
  const proto = window.location.protocol // 'http:' | 'https:'
  const porta = window.location.port // '5173' em dev, '' em prod (443)
  const sufixoPorta = porta ? `:${porta}` : ''
  const caminho = path.startsWith('/') ? path : `/${path}`
  return `${proto}//${dominio}${sufixoPorta}${caminho}`
}
