import { setupServer } from 'msw/node'

import { handlers } from './handlers'

// Servidor MSW para os testes (Node). Intercepta as chamadas à API.
export const server = setupServer(...handlers)
