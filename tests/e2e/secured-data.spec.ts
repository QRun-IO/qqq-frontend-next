import { test, expect, type Page } from '@playwright/test'
import { setupSecuredDataMocks } from './api-mocks'

export async function openReveal(page: Page) {
  await page.locator('[data-qqq-id="reveal-email"]').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Reason', { exact: true }).selectOption('Customer support')
  await page
    .getByLabel('Additional reason (required)')
    .fill('Confirm contact details for an open support case.')
}

test('record reveal is audited, counts down and re-masks on expiry', async ({ page }) => {
  await setupSecuredDataMocks(page, { revealSeconds: 2 })
  await page.goto('/app/person/1')
  await expect(page.getByText('***1234', { exact: true })).toBeVisible()
  await openReveal(page)
  await page.getByRole('button', { name: 'Reveal value', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.locator('[data-qqq-id="revealed-value"]')).toContainText('jane@example.test')
  await expect(page.getByRole('timer')).toHaveText(/00:0[12]/)
  await expect(page.locator('[data-qqq-id="revealed-value"]')).toBeHidden({ timeout: 5000 })
  await expect(page.getByText('j***@x.com', { exact: true })).toBeVisible()
})

test('grid and filter builder restrict operators and sorting; cell menu opens reveal', async ({
  page,
}) => {
  await setupSecuredDataMocks(page)
  await page.goto('/app/person')
  await expect(page.locator('[data-qqq-id="masked-value"]').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sort by Email', exact: true })).toHaveCount(0)
  await page.locator('[data-qqq-id="cell-menu-email"]').click()
  await page.getByRole('menuitem', { name: 'Reveal', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.locator('[data-qqq-id="button-query-mode-advanced"]').click()
  await page.locator('[data-qqq-id="filter-add-criterion-0"]').click()
  await page.getByLabel('Filter field', { exact: true }).selectOption('email')
  await expect(page.getByText('Exact match only. Searches are audited.')).toBeVisible()
  await expect(page.locator('[data-qqq-id="filter-operator-0-0"] option')).toHaveText([
    'equals',
    'is any of',
  ])
  await expect(
    page.getByLabel('Filter field', { exact: true }).locator('option[value="ssn"]')
  ).toHaveCount(0)
  await expect(page.getByLabel('Sort field').locator('option[value="email"]')).toHaveCount(0)
})

test('break-glass banner is persistent and End links to the session record', async ({ page }) => {
  await setupSecuredDataMocks(page, { breakGlass: true })
  await page.goto('/app/person/1')
  const banner = page.locator('[data-qqq-id="break-glass-banner"]')
  await expect(banner).toContainText('Break-glass access active — Emergency care coordination')
  await expect(banner.getByRole('timer')).toHaveText(/\d{2}:\d{2}/)
  await expect(banner.getByRole('link', { name: 'End' })).toHaveAttribute(
    'href',
    '/app/secured_data_break_glass/7'
  )
})

test('missing extension makes no extension calls and offers no reveal or banner', async ({
  page,
}) => {
  await setupSecuredDataMocks(page, { installed: false })
  const calls: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/qbit/secured-data/')) calls.push(request.url())
  })
  await page.goto('/app/person/1')
  await expect(page.getByText('Restricted', { exact: true })).toBeVisible()
  await expect(page.locator('[data-qqq-id="reveal-email"]')).toHaveCount(0)
  await expect(page.locator('[data-qqq-id="break-glass-banner"]')).toHaveCount(0)
  expect(calls).toEqual([])
})

test('a server refusal remains inline in the reveal dialog', async ({ page }) => {
  await setupSecuredDataMocks(page, { refused: true })
  await page.goto('/app/person/1')
  await openReveal(page)
  await page.getByRole('button', { name: 'Reveal value', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText(
    'Daily reveal allowance reached.'
  )
})
