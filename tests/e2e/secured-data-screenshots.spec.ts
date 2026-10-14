import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { setupSecuredDataMocks } from './api-mocks'

const directory = process.env.SCREENSHOTS_DIR ? path.resolve(process.env.SCREENSHOTS_DIR) : undefined
const widths = [390, 768, 1024, 1440, 1920, 3200]

/** Capture each requested state, checking the page and dialog for overflow first. */
async function capture(page: Page, name: string, theme: string, width: number) {
  await page.evaluate(() => document.fonts.ready)
  if (width === 1024) {
    await expect(page.locator('[data-qqq-id="sidebar-desktop"]')).toBeVisible()
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
  const dialog = page.getByRole('dialog')
  if (await dialog.isVisible()) {
    const bounds = await dialog.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true
    )
  }
  const overflowing = await page
    .locator(
      '[data-qqq-id^="widget-"], [data-qqq-id="reveal-dialog"], [data-qqq-id="break-glass-banner"]'
    )
    .evaluateAll((elements) =>
      elements
        .filter(
          (element) => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1
        )
        .map((element) => element.getAttribute('data-qqq-id'))
    )
  expect(overflowing).toEqual([])
  await page.screenshot({
    path: path.join(directory!, `${name}-${theme}-${width}.png`),
    fullPage: true,
    animations: 'disabled',
  })
}

test.describe('secured data screenshot matrix', () => {
  test.skip(!directory, 'Set SCREENSHOTS_DIR to capture the owner review matrix.')
  for (const theme of ['light', 'dark'])
    for (const width of widths) {
      test(`${theme} ${width}`, async ({ page }) => {
        test.setTimeout(120_000)
        await mkdir(directory!, { recursive: true })
        await page.setViewportSize({ width, height: 1000 })
        await page.addInitScript((dark) => {
          localStorage.setItem('qqq-dark-mode', String(dark))
          localStorage.setItem('qqq-person-view-mode', 'grid')
        }, theme === 'dark')
        await setupSecuredDataMocks(page)
        await page.goto('/app/person')
        await expect(page.locator('[data-qqq-id="masked-value"]').first()).toBeVisible()
        await capture(page, 'grid', theme, width)
        await page.locator('[data-qqq-id="button-filter"]').click()
        await page.getByRole('button', { name: 'Advanced', exact: true }).click()
        await expect(page.locator('[data-qqq-id="filter-builder"]')).toBeVisible({ timeout: 10000 })
        await page.locator('[data-qqq-id="filter-add-criterion-0"]').click()
        await page.getByLabel('Filter field', { exact: true }).selectOption('email')
        await page.getByLabel('Filter value for Email', { exact: true }).fill('jane@example.test')
        await expect(page.getByText('Exact match only. Searches are audited.')).toBeVisible()
        await capture(page, 'filter', theme, width)
        await page.goto('/app/person/1')
        await expect(page.locator('[data-qqq-id="reveal-email"]')).toBeVisible()
        await capture(page, 'record', theme, width)
        await page.locator('[data-qqq-id="reveal-email"]').click()
        await page.getByLabel('Reason', { exact: true }).selectOption('Customer support')
        await page
          .getByLabel('Additional reason (required)')
          .fill('Confirm contact details for an open support case.')
        await capture(page, 'reveal-dialog', theme, width)
        await page.getByRole('button', { name: 'Reveal value', exact: true }).click()
        await expect(page.locator('[data-qqq-id="revealed-value"]')).toBeVisible()
        await capture(page, 'revealed', theme, width)
        await page.route('**/qqq/v1/qbit/secured-data/status', (route) =>
          route.fulfill({
            json: {
              breakGlass: {
                id: 7,
                reason: 'Emergency care coordination',
                expiresAt: new Date(Date.now() + 600_000).toISOString(),
                ceiling: 'PHI',
              },
            },
          })
        )
        await page.reload()
        await expect(page.locator('[data-qqq-id="break-glass-banner"]')).toBeVisible()
        await expect(page.locator('[data-qqq-id="masked-value"]').first()).toBeVisible()
        await capture(page, 'break-glass', theme, width)
      })
    }
})
