import { execSync } from 'node:child_process'

/** Prepara a clínica `e2e` (idempotente) antes da suíte. O comando padrão roda no
 * container do backend; sobrescreva com `E2E_PREPARAR_CMD` (ex.: python direto no host). */
export default function globalSetup() {
  const comando =
    process.env.E2E_PREPARAR_CMD ?? 'docker exec odonto_web python manage.py preparar_e2e'
  console.log(`[e2e] preparando a clínica de testes: ${comando}`)
  execSync(comando, { stdio: 'inherit' })
}
