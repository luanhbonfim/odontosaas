import { type Page, expect, test } from '@playwright/test'

import { ADMIN_EMAIL, ADMIN_SENHA, DENTISTA_NOME, PACIENTE_NOME } from './constantes'

// Fluxo crítico da clínica, em ordem e sobre a mesma consulta:
//   login → agendar → confirmar → atender → pagamento → financeiro.
// Cada passo depende do anterior (o setup global zera a clínica `e2e` antes da suíte).
test.describe.configure({ mode: 'serial' })

const VALOR = '250'
const DESCRICAO_CONTA = `Consulta particular - ${PACIENTE_NOME}`

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(ADMIN_EMAIL)
  await page.getByLabel('Senha', { exact: true }).fill(ADMIN_SENHA)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

/** Abre a consulta do dia seguinte (10:00) clicando no evento do calendário. */
async function abrirConsultaAmanha(page: Page) {
  await page.goto('/agenda')
  await page.locator('.fc-timeGridDay-button').click()
  await page.locator('.fc-next-button').click()
  await page.locator('.fc-event', { hasText: PACIENTE_NOME }).click()
}

test('login: credenciais erradas mostram erro e as corretas entram no dashboard', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(ADMIN_EMAIL)
  await page.getByLabel('Senha', { exact: true }).fill('senha-errada')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText(/e-mail ou senha inválidos/i)).toBeVisible()
  await expect(page).toHaveURL(/\/login/)

  await login(page)
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
})

test('agendar: cria a consulta de amanhã às 10:00 pela agenda', async ({ page }) => {
  await login(page)
  await page.goto('/agenda')
  await page.locator('.fc-timeGridDay-button').click()
  await page.locator('.fc-next-button').click()
  await page.locator('.fc-timegrid-slot-lane[data-time="10:00:00"]').click()

  const modal = page.getByRole('dialog')
  await modal.getByPlaceholder('Buscar paciente pelo nome ou CPF…').fill('E2E')
  await modal.getByRole('button', { name: PACIENTE_NOME }).click()
  await modal.getByLabel('Dentista').selectOption({ label: DENTISTA_NOME })
  await modal.getByLabel('Valor').fill(VALOR)
  await modal.getByRole('button', { name: /^salvar|agendar/i }).click()

  await expect(page.locator('.fc-event', { hasText: PACIENTE_NOME })).toBeVisible()
})

test('confirmar: a recepção confirma manualmente e a consulta fica pronta para atender', async ({
  page,
}) => {
  await login(page)
  await abrirConsultaAmanha(page)

  const modal = page.getByRole('dialog')
  await expect(modal.getByRole('button', { name: 'Iniciar atendimento' })).toHaveCount(0)
  await modal.getByRole('button', { name: 'Confirmar manualmente' }).click()
  await expect(page.getByText('Consulta confirmada manualmente.')).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Iniciar atendimento' })).toBeVisible()
})

test('atender: inicia e finaliza o atendimento', async ({ page }) => {
  await login(page)
  await abrirConsultaAmanha(page)
  await page.getByRole('dialog').getByRole('button', { name: 'Iniciar atendimento' }).click()

  // Em atendimento a consulta abre em modo leitura, com "Finalizar atendimento".
  await abrirConsultaAmanha(page)
  const modal = page.getByRole('dialog')
  await expect(modal.getByText('Em atendimento')).toBeVisible()
  await modal.getByRole('button', { name: 'Finalizar atendimento' }).click()
  await expect(page.getByText('Atendimento finalizado.')).toBeVisible()
  // Realizada e ainda sem pagamento: o evento ganha o aviso "sem pagamento registrado".
  await expect(page.getByRole('img', { name: 'Sem pagamento registrado' })).toBeVisible()
})

test('pagamento: registra a forma de pagamento e gera a conta a receber', async ({ page }) => {
  await login(page)
  await abrirConsultaAmanha(page)
  const modal = page.getByRole('dialog')
  await modal.getByRole('button', { name: /método de pagamento|pagamento/i }).first().click()

  const pagamento = page.getByRole('dialog').last()
  await pagamento.getByLabel('Forma de pagamento').selectOption('PIX')
  await pagamento.getByRole('button', { name: 'Salvar' }).click()
  // A visualização por baixo reflete valor e forma salvos (sem fechar/reabrir).
  const visualizacao = page.getByRole('dialog')
  await expect(visualizacao.getByText('(Pix)')).toBeVisible()
  await expect(visualizacao.getByRole('button', { name: 'Editar pagamento' })).toBeVisible()
})

test('financeiro: a conta aparece em Contas a Receber, é quitada e reflete na Visão Geral', async ({
  page,
}) => {
  await login(page)
  await page.goto('/financeiro/receber')
  const linha = page.getByRole('row', { name: new RegExp(DESCRICAO_CONTA) })
  await expect(linha).toBeVisible()
  await expect(linha).toContainText('250,00')
  await linha.getByRole('button', { name: 'Marcar como pago' }).click()
  await expect(page.getByText('Lançamento marcado como pago.')).toBeVisible()
  await expect(linha.getByRole('button', { name: 'Desfazer pagamento' })).toBeVisible()

  await page.goto('/financeiro')
  const recebido = page.locator('div', { hasText: /^Recebido/ }).first()
  await expect(recebido).toContainText('250,00')
})

test('busca global: Ctrl+K encontra o paciente e abre a ficha', async ({ page }) => {
  await login(page)
  await page.keyboard.press('Control+k')
  const busca = page.getByRole('combobox', { name: 'Buscar paciente ou consulta' })
  await busca.fill('Paciente E2E')
  await expect(page.getByRole('option', { name: new RegExp(PACIENTE_NOME) }).first()).toBeVisible()
  await busca.press('Enter')
  await expect(page).toHaveURL(/\/pacientes\/\d+/)
})

test('auditoria: as ações do fluxo ficam registradas com quem as realizou', async ({ page }) => {
  await login(page)
  await page.goto('/auditoria')
  await page.getByLabel('Filtrar por tipo de registro').selectOption('LancamentoFinanceiro')
  const linha = page.getByRole('row', { name: /Lançamento financeiro/ }).first()
  await expect(linha).toBeVisible()
  // Regressão: antes do fix toda ação via API aparecia como "Sistema".
  await expect(linha).toContainText(ADMIN_EMAIL)
})
