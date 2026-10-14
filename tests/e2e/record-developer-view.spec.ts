// E2E: Record Developer View — record-screen navigation parity, sticky section nav, API access
// (v1 and an application API from its OpenAPI spec), provider panels present and absent
// (ESB, quick search, SQL workbench, assistant), and readable layouts from 360 to 3200px.
//
// Set QQQ_E2E_SCREENSHOT_DIR to keep a full-page screenshot per viewport.

import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks } from './api-mocks'
import { checkA11y } from './a11y-helpers'

const PERSON_RECORD_1 = {
  tableName: 'person',
  recordLabel: 'Alice Johnson',
  values: { id: 1, firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com', status: 'Active' },
  displayValues: { id: '1', firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com', status: 'Active' },
}

const PANELS = [
  { id: 'recordSecurity', title: 'Record Security', order: 150, statusLabel: 'No locks', statusTone: 'INFO', blocks: [
    { type: 'TEXT', tone: 'INFO', text: 'This table has no record security locks: any user with read permission on the table can see all of its records.' },
  ] },
  { id: 'esb', title: 'ESB Events', order: 300, statusLabel: 'Publishing', statusTone: 'SUCCESS', description: 'This table publishes its record changes to the ESB as CloudEvents.', blocks: [
    { type: 'KEY_VALUES', label: 'CloudEvents attributes', items: [
      { label: 'type', value: 'qqq.table.person.inserted, qqq.table.person.updated', monospace: true },
      { label: 'source', value: 'qqq://demo/table/person', monospace: true },
      { label: 'subject', value: '1', monospace: true },
    ] },
    { type: 'TABLE', label: 'Subscribers (triggers)', columns: ['Trigger', 'Process', 'Mode', 'State', 'Max attempts', 'Dead letters'], rows: [
      ['syncPerson.personEvents', 'Sync Person', 'SINGLE', 'RUNNING', '3', '0'],
    ] },
    { type: 'CODE', label: 'Sample event for this record', language: 'json', code: JSON.stringify({ specversion: '1.0', type: 'qqq.table.person.updated', source: 'qqq://demo/table/person', subject: '1', data: { record: { id: 1, firstName: 'Alice' } } }, null, 2) },
    { type: 'LINKS', label: 'ESB tools', links: [{ label: 'ESB overview', href: '/app/esb' }] },
  ] },
  { id: 'quickSearch', title: 'Quick Search', order: 400, statusLabel: 'Indexed', statusTone: 'SUCCESS', blocks: [
    { type: 'KEY_VALUES', items: [{ label: 'Index', value: 'person' }, { label: 'Last indexed', value: '2026-10-12 10:42' }] },
    { type: 'TABLE', label: 'Indexed document vs database', columns: ['Field', 'Database', 'Index', 'Match'], rows: [['firstName', 'Alice', 'Alice', 'yes']] },
    { type: 'ACTIONS', label: 'Actions', actions: [{ label: 'Reindex this record', processName: 'quickSearchReindexRecords_person' }] },
  ] },
  { id: 'sqlWorkbench', title: 'SQL Workbench', order: 450, blocks: [
    { type: 'CODE', label: 'Read-only query', language: 'sql', code: 'SELECT * FROM person WHERE id = 1' },
    { type: 'LINKS', links: [{ label: 'Open in SQL Workbench', href: '/app/sqlWorkbench?sql=SELECT%20*%20FROM%20person%20WHERE%20id%20%3D%201' }] },
  ] },
  { id: 'assistant', title: 'Assistant', order: 600, statusLabel: 'Values', blocks: [
    { type: 'TABLE', label: 'Tools for this record', columns: ['Tool', 'Applies', 'Why'], rows: [['get_record', 'yes', 'You can read person records']] },
    { type: 'LINKS', links: [{ label: 'Ask the assistant about this record', href: '/app/person/1?assistant=open&assistantPrompt=Explain%20this%20record' }] },
  ] },
]

const SPEC = {
  openapi: '3.0.3',
  servers: [{ url: '/api/v1' }],
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
  paths: {
    '/person/': { post: { summary: 'Insert a Person', requestBody: {} } },
    '/person/query': { get: { summary: 'Search for Persons' } },
    '/person/{id}': { get: { summary: 'Get one Person' }, patch: { summary: 'Update one Person', requestBody: {} }, delete: { summary: 'Delete one Person' } },
  },
}

/**
 * Mock the developer routes, the API catalog and (when given) the developer panels.
 * @param page - The page.
 * @param panels - Panels to serve, or null for a backend without the panels endpoint.
 */
async function setupDeveloperMocks(page: Page, panels: unknown[] | null) {
  await setupApiMocks(page)
  await page.route(/\/qqq\/v1\/table\/person\/1\/developer(\?|$)/, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ record: PERSON_RECORD_1, associatedScripts: [] }) }))
  await page.route(/\/qqq\/v1\/table\/person\/1\/developer\/panels(\?|$)/, (route) =>
    panels === null
      ? route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) })
      : route.fulfill({ contentType: 'application/json', body: JSON.stringify({ panels }) }))
  await page.route(/\/apis\.json/, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ apis: [{ name: 'siteApi', path: '/api/', label: 'Site API' }] }) }))
  await page.route(/\/api\/versions\.json/, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ supportedVersions: ['v1'], currentVersion: 'v1' }) }))
  await page.route(/\/api\/v1\/person\/openapi\.json/, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(SPEC) }))
}

/**
 * Open the developer view of person 1 and wait for its sections.
 * @param page - The page.
 */
async function openDeveloperView(page: Page) {
  await page.goto('/app/person/1/dev')
  await expect(page.locator('[data-qqq-id="record-dev-person-1"]')).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('navigation', { name: 'Developer view sections' })).toBeVisible()
}

test.describe('Record Developer View', () => {
  test('has the record screen navigation: back, title, actions and audit', async ({ page }) => {
    await setupDeveloperMocks(page, [])
    await openDeveloperView(page)

    const back = page.locator('[data-qqq-id="record-dev-back"]')
    await expect(back).toHaveAttribute('href', '/app/person/1')
    await expect(page.locator('[data-qqq-id="record-view-title-person"]')).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'View mode' })).toHaveCount(0)
    await back.click()
    await expect(page).toHaveURL(/\/app\/person\/1\/?$/)
  })

  test('without provider panels (qbits absent or older backend) shows the core sections only', async ({ page }) => {
    await setupDeveloperMocks(page, null)
    await openDeveloperView(page)

    const nav = page.getByRole('navigation', { name: 'Developer view sections' })
    await expect(nav.getByRole('link')).toHaveText(['Fields', 'API', 'JSON', 'Table Metadata'])
    await expect(page.locator('[data-qqq-id^="dev-section-panel-"]')).toHaveCount(0)
    await checkA11y(page)
  })

  test('the section bar sticks to the top of the page and follows the section in view', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await setupDeveloperMocks(page, PANELS)
    await openDeveloperView(page)

    const nav = page.getByRole('navigation', { name: 'Developer view sections' })
    await nav.getByRole('link', { name: 'Quick Search' }).click()
    await expect(page.locator('[data-qqq-id="dev-section-panel-quickSearch"]')).toBeInViewport()
    await expect(nav.getByRole('link', { name: 'Quick Search' })).toHaveAttribute('aria-current', 'location')
    // no page content shows between the app header and the stuck bar
    const gap = await page.evaluate(() => {
      const main = document.querySelector('[data-qqq-id="main-content"]') as HTMLElement
      const bar = document.querySelector('[data-qqq-id="dev-section-nav"]') as HTMLElement
      return Math.abs(bar.getBoundingClientRect().top - main.getBoundingClientRect().top)
    })
    expect(gap).toBeLessThanOrEqual(1)
    // scrolling on to the API section moves the highlight there
    await page.locator('[data-qqq-id="dev-section-api"]').evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await expect(nav.getByRole('link', { name: 'API' })).toHaveAttribute('aria-current', 'location', { timeout: 3000 })
  })

  test('jumps to a section from the phone section picker', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupDeveloperMocks(page, PANELS)
    await openDeveloperView(page)

    await page.locator('[data-qqq-id="dev-nav-select"]').selectOption({ label: 'Assistant' })
    await expect(page.locator('[data-qqq-id="dev-section-panel-assistant"]')).toBeInViewport()
    await expect(page.locator('[data-qqq-id="dev-nav-select"]')).toHaveValue('panel-assistant')
  })

  test('renders each provider panel and its nav entry when present', async ({ page }) => {
    await setupDeveloperMocks(page, PANELS)
    await openDeveloperView(page)

    const nav = page.getByRole('navigation', { name: 'Developer view sections' })
    for (const title of ['Record Security', 'ESB Events', 'Quick Search', 'SQL Workbench', 'Assistant']) {
      await expect(nav.getByRole('link', { name: title })).toBeVisible()
    }
    await expect(page.locator('dd', { hasText: 'qqq://demo/table/person' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Reindex this record' })).toHaveAttribute('href', /\/app\/quickSearchReindexRecords_person\/?\?.*recordIds=1/)
    await expect(page.getByRole('link', { name: 'Open in SQL Workbench' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ask the assistant about this record' })).toBeVisible()

    await nav.getByRole('link', { name: 'Quick Search' }).click()
    await expect(page.locator('[data-qqq-id="dev-section-panel-quickSearch"]')).toBeInViewport()
    await checkA11y(page)
  })

  test('shows v1 and application API operations with copyable examples', async ({ page }) => {
    await setupDeveloperMocks(page, [])
    await openDeveloperView(page)

    const api = page.locator('[data-qqq-id="dev-api-access"]')
    await expect(api.getByText('Get this record')).toBeVisible()
    await expect(page.locator('[data-qqq-id="dev-api-snippet-get"]')).toContainText('/qqq/v1/table/person/1')

    await page.locator('[data-qqq-id="dev-snippet-language-java"]').click()
    await expect(page.locator('[data-qqq-id="dev-api-snippet-get"]')).toContainText('HttpClient.newHttpClient()')

    await page.locator('[data-qqq-id="dev-api-source-siteApi"]').click()
    await expect(api.getByText('Get one Person')).toBeVisible()
    await expect(api.getByText('Base URL')).toContainText('/api/v1')
    await expect(api.getByRole('link', { name: /API docs/ })).toHaveAttribute('href', /\/api\/v1\/$/)
    await expect(api).not.toContainText(/Bearer [A-Za-z0-9]{20,}/)
  })

  for (const viewport of [
    { name: '360', width: 360, height: 780 },
    { name: '390', width: 390, height: 844 },
    { name: '1024', width: 1024, height: 768 },
    { name: '1440', width: 1440, height: 900 },
    { name: '1920', width: 1920, height: 1080 },
    { name: '3200', width: 3200, height: 1800 },
  ]) {
    test(`is readable at ${viewport.name}px without sideways scrolling`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await setupDeveloperMocks(page, PANELS)
      await openDeveloperView(page)
      await expect(page.locator('[data-qqq-id="dev-section-panel-esb"]')).toBeVisible()

      const overflow = await page.evaluate(() => {
        const root = document.scrollingElement ?? document.documentElement
        const main = document.querySelector<HTMLElement>('[data-qqq-id="main-content"]')
        return {
          page: root.scrollWidth - root.clientWidth,
          main: main ? main.scrollWidth - main.clientWidth : 0,
        }
      })
      expect(overflow.page).toBeLessThanOrEqual(1)
      expect(overflow.main).toBeLessThanOrEqual(1)
      // the section nav never scrolls sideways: a picker on phones, wrapping links elsewhere
      const nav = page.locator('[data-qqq-id="dev-section-nav"]')
      expect(await nav.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
      await expect(page.locator('[data-qqq-id="dev-nav-select"]')).toBeVisible({ visible: viewport.width < 640 })

      const dir = process.env.QQQ_E2E_SCREENSHOT_DIR
      if (dir) {
        await page.screenshot({ path: path.join(dir, `record-developer-view-${viewport.name}.png`), fullPage: true })
        // the page scrolls inside the app's main container, so also capture the API and panel sections
        for (const section of ['api', 'panel-esb', 'panel-quickSearch', 'panel-sqlWorkbench', 'panel-assistant']) {
          await page.locator(`[data-qqq-id="dev-section-${section}"]`).scrollIntoViewIfNeeded()
          await page.locator(`[data-qqq-id="dev-section-${section}"]`).evaluate((element) => element.scrollIntoView({ block: 'start' }))
          await page.screenshot({ path: path.join(dir, `record-developer-view-${viewport.name}-${section}.png`) })
        }
      }
    })
  }

  for (const viewport of [
    { name: '390', width: 390, height: 844 },
    { name: '1440', width: 1440, height: 900 },
  ]) {
    test(`is readable in dark mode at ${viewport.name}px`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('qqq-dark-mode', 'true'))
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await setupDeveloperMocks(page, PANELS)
      await openDeveloperView(page)
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await expect(page.locator('[data-qqq-id="dev-section-panel-assistant"]')).toBeVisible()

      const overflow = await page.evaluate(() => {
        const root = document.scrollingElement ?? document.documentElement
        const main = document.querySelector<HTMLElement>('[data-qqq-id="main-content"]')
        return {
          page: root.scrollWidth - root.clientWidth,
          main: main ? main.scrollWidth - main.clientWidth : 0,
        }
      })
      expect(overflow.page).toBeLessThanOrEqual(1)
      expect(overflow.main).toBeLessThanOrEqual(1)

      const dir = process.env.QQQ_E2E_SCREENSHOT_DIR
      if (dir) {
        for (const section of ['fields', 'api', 'panel-esb', 'panel-quickSearch', 'panel-sqlWorkbench', 'panel-assistant']) {
          await page.locator(`[data-qqq-id="dev-section-${section}"]`).evaluate((element) => element.scrollIntoView({ block: 'start' }))
          await page.screenshot({ path: path.join(dir, `record-developer-view-dark-${viewport.name}-${section}.png`) })
        }
      }
    })
  }
})
