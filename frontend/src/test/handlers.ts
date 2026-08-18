import { http, HttpResponse } from 'msw'

// Handlers padrão do MSW. Cada feature adiciona/override os seus com
// `server.use(...)` dentro do próprio teste. Mantém um exemplo mínimo.
export const handlers = [http.get('/api/health-check/', () => HttpResponse.json({ status: 'ok' }))]
