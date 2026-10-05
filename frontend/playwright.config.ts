import { defineConfig, devices } from '@playwright/test'

import { URL_E2E } from './e2e/constantes'

// E2E dos fluxos críticos (login → agendar → confirmar → atender → financeiro).
//
// Pré-requisitos: backend no ar (docker compose up -d db redis web). O setup global
// (e2e/global-setup.ts) prepara a clínica isolada `e2e` — nunca toca no tenant `demo`.
//
// Navegador: por padrão usa o Microsoft Edge já instalado (sem download). Em CI ou sem
// Edge: `npx playwright install chromium` e rode com `E2E_CANAL=chromium`.
const canal = process.env.E2E_CANAL ?? 'msedge'

export default defineConfig({
  testDir: './e2e',
  // Os fluxos compartilham a mesma clínica e dependem uns dos outros: 1 worker, em ordem.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: URL_E2E,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'fluxos',
      use: { ...devices['Desktop Chrome'], channel: canal === 'chromium' ? undefined : canal },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
