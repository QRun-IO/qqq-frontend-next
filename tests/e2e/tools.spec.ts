import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import catalog from './fixtures/tools-catalog.json'
import { METADATA, setupApiMocks } from './api-mocks'

for (const width of [1440, 390]) {
  test(`Tools is discoverable and usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await setupApiMocks(page)
    const app = {
      name: 'qqqTools',
      label: 'Tools',
      widgets: ['qqqToolsCatalog'],
      children: [],
      sections: [],
    }
    await page.route(/\/qqq\/v1\/metaData(?:\?.*)?$/, (route) =>
      route.fulfill({
        json: {
          ...METADATA,
          apps: { ...METADATA.apps, qqqTools: app },
          appTree: [
            ...METADATA.appTree,
            { name: app.name, label: app.label, type: 'APP', iconName: 'build' },
          ],
          widgets: {
            qqqToolsCatalog: {
              name: 'qqqToolsCatalog',
              label: 'Take QQQ with you',
              type: 'QQQ_TOOLS',
              hasPermission: true,
              gridColumns: 12,
              isCard: false,
            },
          },
        },
      })
    )
    await page.route('**/qqq/v1/widget/qqqToolsCatalog**', (route) =>
      route.fulfill({ json: catalog })
    )
    await page.goto('/app')
    await page.locator('[data-qqq-id="button-account"]').click()
    await page.getByRole('menuitem', { name: 'Tools', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/qqqTools$/)
    await expect(
      page.getByRole('heading', { name: 'CLI & Terminal UI', exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Set up Mobile Scanners', exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Set up Print Client', exact: true })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Set up Print Client', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Print Client', exact: true })).toBeVisible()
    await expect(page.locator('[data-qqq-id="tools-download-printing"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy install script' })).toBeVisible()
    await page.getByRole('button', { name: 'Set up Mobile Scanners', exact: true }).click()
    await page.getByLabel('Install platform').selectOption('windows')
    await expect(page.getByRole('button', { name: 'Copy install script' })).toBeVisible()
    await expect(page.locator('[data-qqq-id="tools-download-scanner"]')).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBeTruthy()
    expect(
      (await new AxeBuilder({ page }).include('[data-qqq-id="tools-catalog"]').analyze()).violations
    ).toEqual([])
    await page.screenshot({
      path: test.info().outputPath(`mobile-setup-${width}.png`),
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Set up CLI & Terminal UI', exact: true }).click()
    await expect(
      page.getByText('qqq login --server "https://example.test/customer"', { exact: true })
    ).toBeVisible()
    await page.getByLabel('Install platform').selectOption('windows')
    await expect(page.getByText('scoop install qqq', { exact: true })).toBeVisible()
    await page.getByLabel('Install platform').selectOption('macos')
    await expect(page.getByText('brew install qrun-io/tap/qqq', { exact: true })).toBeVisible()
    await page.getByLabel('Install platform').selectOption('linux')
    await expect(page.getByText(/curl -fsSL/)).toBeVisible()
    await page.getByLabel('Install platform').selectOption('windows')
    await expect(page.locator('[data-qqq-id="tools-manage-printing"]')).toHaveCount(0)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBeTruthy()
    const accessibility = await new AxeBuilder({ page })
      .include('[data-qqq-id="tools-catalog"]')
      .analyze()
    expect(accessibility.violations).toEqual([])
    await page.screenshot({ path: test.info().outputPath(`tools-${width}.png`), fullPage: true })
  })
}
