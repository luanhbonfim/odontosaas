import { expect, test } from '@playwright/test'

test('a página inicial exibe a marca OdontoSaaS', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'OdontoSaaS' })).toBeVisible()
})
