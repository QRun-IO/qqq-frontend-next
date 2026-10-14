import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'
import { ediGuide, ediMap, ediPreview, ediTarget } from '../fixtures/edi'

const PANEL = '[data-qqq-id="edi-mapper"]'

async function mockEdi(page: Page, installed = true, status = 'DRAFT') {
  await setupApiMocks(page)
  const table = {
    ...METADATA.tables.person,
    name: 'edi_map',
    label: 'EDI maps',
    sections: [],
    fields: { id: METADATA.tables.person.fields.id, status: METADATA.tables.person.fields.status },
  }
  const metadata = {
    ...METADATA,
    tables: {
      ...METADATA.tables,
      edi_map: table,
      edi_map_rule: { ...table, name: 'edi_map_rule' },
    },
  }
  await page.route('**/qqq/v1/metaData?**', (route) => route.fulfill({ json: metadata }))
  await page.route('**/qqq/v1/metaData', (route) => route.fulfill({ json: metadata }))
  await page.route('**/qqq/v1/metaData/table/edi_map', (route) => route.fulfill({ json: table }))
  await page.route('**/qqq/v1/version', (route) =>
    route.fulfill({
      json: {
        apiVersion: '1.1.0',
        features: [],
        extensions: installed ? [{ name: 'edi', version: '1.0.0', pathPrefix: '/qbit/edi' }] : [],
      },
    })
  )
  await page.route('**/qqq/v1/table/edi_map/7*', (route) =>
    route.fulfill({ json: { record: { ...ediMap, values: { ...ediMap.values, status } } } })
  )
  await page.route('**/qqq/v1/qbit/edi/guides/2/tree', (route) => route.fulfill({ json: ediGuide }))
  await page.route('**/qqq/v1/qbit/edi/maps/7/target', (route) =>
    route.fulfill({ json: ediTarget })
  )
  await page.route('**/qqq/v1/qbit/edi/maps/7/validate', (route) =>
    route.fulfill({
      json: {
        rules: route
          .request()
          .postDataJSON()
          .rules.map((_: unknown, index: number) => ({ index, errors: ['Check this rule'] })),
      },
    })
  )
  await page.route('**/qqq/v1/table/edi_map_sample/query', (route) =>
    route.fulfill({
      json: {
        records: [
          { tableName: 'edi_map_sample', values: { id: 11, name: 'Synthetic purchase order' } },
        ],
      },
    })
  )
  await page.route('**/qqq/v1/qbit/edi/sandbox/preview', (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      mapId: 7,
      sampleId: 11,
      ruleOverrides: [expect.objectContaining({ ediPath: 'BEG03', qqqPath: 'poNumber' })],
    })
    return route.fulfill({ json: ediPreview })
  })
}

async function createRule(page: Page, width: number) {
  await page.locator('summary', { hasText: 'BEG — Beginning' }).press('Enter')
  await page.getByRole('button', { name: /BEG03 — Purchase order number/ }).press('Enter')
  if (width < 1024) await page.getByRole('tab', { name: 'Fields', exact: true }).press('Enter')
  await page.getByRole('button', { name: /Order number \(required\)/ }).press('Enter')
  await page.getByRole('button', { name: 'Add rule' }).press('Enter')
  await expect(page.getByLabel('EDI path', { exact: true })).toHaveValue('BEG03')
}

for (const width of [390, 768, 1024, 1280, 1440]) {
  for (const theme of ['light', 'dark']) {
    test(`mapper keyboard flow, wrapping and screenshot at ${width}px ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await mockEdi(page)
      await page.goto('/app/edi_map/7/mapper')
      await page.evaluate(
        (value) => document.documentElement.classList.toggle('dark', value === 'dark'),
        theme
      )
      await expect(
        page.getByRole('heading', { name: 'EDI Mapper — Purchase orders' })
      ).toBeVisible()
      await createRule(page, width)
      await page.getByRole('button', { name: 'Validate rules' }).click()
      await expect(page.getByText('Check this rule')).toBeVisible()
      if (width < 1024) await page.getByRole('tab', { name: 'Preview', exact: true }).press('Enter')
      else await page.getByRole('button', { name: 'Choose sample and preview' }).click()
      await page.getByLabel('Sample', { exact: true }).selectOption('11')
      await page.getByRole('button', { name: 'Run preview' }).click()
      await expect(page.getByText('SNIP level 2')).toBeVisible()
      expect(
        await page.locator(PANEL).evaluate((panel) =>
          [panel, ...panel.querySelectorAll('*')]
            .filter(
              (element) => element.clientWidth > 0 && getComputedStyle(element).display !== 'inline'
            )
            .filter((element) => element.scrollWidth > element.clientWidth + 1)
            .map((element) => element.tagName)
        )
      ).toEqual([])
      expect(
        (
          await new AxeBuilder({ page })
            .include(PANEL)
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
        ).violations
      ).toEqual([])
      await page.screenshot({
        path: testInfo.outputPath(`edi-${width}-${theme}.png`),
        fullPage: true,
      })
    })
  }
}

test('opens from a map record and keeps ACTIVE maps read-only for saving', async ({ page }) => {
  await mockEdi(page, true, 'ACTIVE')
  await page.goto('/app/edi_map/7')
  await page.getByRole('link', { name: 'Open Mapper' }).click()
  await expect(page).toHaveURL(/\/app\/edi_map\/7\/mapper/)
  await createRule(page, 1280)
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await expect(page.getByText(/Create Draft Revision:/)).toBeVisible()
})

test('absent extension hides the action and direct navigation makes no EDI calls', async ({
  page,
}) => {
  await mockEdi(page, false)
  const calls: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/qbit/edi/')) calls.push(request.url())
  })
  await page.goto('/app/edi_map/7')
  await expect(page.getByRole('link', { name: 'Open Mapper' })).toHaveCount(0)
  await page.goto('/app/edi_map/7/mapper')
  await expect(page.getByText('EDI Mapper is not available on this server.')).toBeVisible()
  expect(calls).toEqual([])
})
