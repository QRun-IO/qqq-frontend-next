// E2E: failures stay where they happen. A crashing assistant result and a malformed stored
// reply leave the panel and the page usable; a crashing dashboard widget leaves the rest of the
// dashboard (and the app shell) working.
//
// The crash is injected without any test hook in the app: an init script makes
// Number.prototype.toLocaleString throw for one sentinel value, which the count render and the
// table widget both format while rendering.

import { test, expect, type Page, type Route } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'

const SENTINEL = 424242

/**
 * Makes rendering the sentinel number throw (a render-time crash in a real component).
 *
 * @param page - The page.
 */
async function injectRenderCrash(page: Page) {
  await page.addInitScript((sentinel) => {
    const original = Number.prototype.toLocaleString
    Number.prototype.toLocaleString = function patched(this: number, ...args: Parameters<typeof original>) {
      if (Number(this) === sentinel) throw new TypeError("Cannot read properties of undefined (reading 'length')")
      return original.apply(this, args)
    }
  }, SENTINEL)
}

/**
 * Formats stream events as SSE frames.
 *
 * @param events - `[type, data]` pairs.
 * @returns Event-stream text.
 */
function sse(...events: Array<[string, Record<string, unknown>]>): string {
  return events.map(([type, data]) => `id: ${data.seq}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`).join('')
}

const CONVERSATION = { id: 4, title: 'Counts', status: 'ACTIVE', pinned: false, lastMessageAt: null, unreadCount: 0, createDate: '2026-10-12T00:00:00Z' }

/** A count render that crashes, a records render without rows/columns (older servers), an unknown render. */
const TOOLS = [
  { toolCallId: 't1', name: 'count_records', outcome: 'OK', summary: 'Counted People', render: { type: 'count', tableName: 'person', tableLabel: 'People', count: SENTINEL, openHref: '/app/person' } },
  { toolCallId: 't2', name: 'query_records', outcome: 'OK', summary: 'Queried People', render: { type: 'records', tableName: 'person', tableLabel: 'People', openHref: '/app/person' } },
  { toolCallId: 't3', name: 'future_tool', outcome: 'OK', summary: 'Mapped', render: { type: 'map', pins: 3 } },
]
const ANSWER = 'Here is what I found.'

/** The streamed reply: the tools, then text. */
const REPLY = sse(
  ['message.start', { seq: 1, turnId: 9, conversationId: 4, userMessageId: 10, messageId: 11 }],
  ...TOOLS.map((tool, index): [string, Record<string, unknown>] => ['tool.result', { seq: index + 2, messageId: 11, ...tool }]),
  ['text.delta', { seq: 5, messageId: 11, text: ANSWER }],
  ['message.end', { seq: 6, messageId: 11, status: 'COMPLETE' }],
)

/** The same reply as stored (what GET /conversations/4 serves once the turn ended). */
const STORED = [
  { id: 10, role: 'USER', status: 'COMPLETE', turnId: 9, createDate: '2026-10-12T00:00:00Z', parts: [{ type: 'text', text: 'How many people?' }] },
  { id: 11, role: 'ASSISTANT', status: 'COMPLETE', turnId: 9, createDate: '2026-10-12T00:00:00Z', parts: [...TOOLS.map((tool) => ({ type: 'tool', ...tool })), { type: 'text', text: ANSWER }] },
]

/**
 * Mocks the assistant routes with one conversation whose turn streams {@link REPLY}.
 *
 * @param page - The page.
 * @param reply - The SSE body of a turn.
 * @returns The client error reports the page sent.
 */
async function mockAssistant(page: Page, reply = REPLY): Promise<unknown[]> {
  const reports: unknown[] = []
  let stored: unknown[] = []
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  await page.route('**/qqq/v1/version', (route) => json(route, { apiVersion: '1.4.0', features: [], extensions: [{ name: 'assistant', version: '1.5.0' }] }))
  await page.route(/\/qqq\/v1\/metaData(\?|$)/, (route) => json(route, { ...METADATA, supplementalInstanceMetaData: { assistant: {} } }))
  await page.route('**/qqq/v1/assistant/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/qqq/v1/assistant', '')
    const method = request.method()
    if (path === '/config') return json(route, { enabled: true, shortcut: 'mod+j', model: 'm', features: {} })
    if (path === '/turns/active') return json(route, { turns: [] })
    if (path === '/conversations' && method === 'GET') return json(route, { conversations: [] })
    if (path === '/conversations' && method === 'POST') return json(route, CONVERSATION, 201)
    if (path === '/conversations/4' && method === 'GET') return json(route, { conversation: CONVERSATION, messages: stored })
    if (path === '/conversations/4/turns') {
      stored = STORED
      return route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: reply })
    }
    if (path === '/client-errors') {
      reports.push(request.postDataJSON())
      return json(route, { accepted: true }, 202)
    }
    return json(route, { error: 'not mocked' }, 404)
  })
  return reports
}

/**
 * Waits for the dashboard shell.
 *
 * @param page - The page.
 */
async function waitForAppReady(page: Page) {
  await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible({ timeout: 30000 })
  await page.waitForSelector('[aria-label="Loading content"]', { state: 'hidden', timeout: 15000 }).catch(() => null)
}

test.describe('Fail soft: assistant', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a crashing result stays inside its part; the reply, panel and page keep working', async ({ page }) => {
    await injectRenderCrash(page)
    await setupApiMocks(page)
    const reports = await mockAssistant(page)
    await page.goto('/app/person')
    await waitForAppReady(page)
    await page.locator('body').click()
    await page.keyboard.press('Control+j')
    const panel = page.locator('aside[data-qqq-id="assistant-panel"]')
    await expect(panel).toBeVisible()

    const composer = page.locator('[data-qqq-id="assistant-composer"]')
    await composer.fill('How many people?')
    await composer.press('Enter')

    // the rest of the reply renders around the failed result
    await expect(panel.locator('[data-qqq-id="assistant-markdown"]').first()).toContainText(ANSWER)
    await expect(panel.locator('[data-qqq-id="assistant-render-error"]')).toContainText("This result could not be shown.")
    await expect(panel.getByText('People: no rows match')).toBeVisible()
    await expect(panel.getByText('Unsupported result (map)')).toBeVisible()
    await expect(page.locator('[data-qqq-id="page-error"]')).toHaveCount(0)

    // details toggle, and the report reached the backend with ids only
    await panel.locator('[data-qqq-id="assistant-render-error-details-toggle"]').click()
    await expect(panel.locator('[data-qqq-id="assistant-render-error-details"]')).toContainText('Result type: count')
    await expect.poll(() => reports.length).toBeGreaterThan(0)
    expect(reports[0]).toMatchObject({ scope: 'assistant-render', renderType: 'count' })

    // the page and the composer still work
    await expect(composer).toBeEnabled()
    await page.locator('[data-qqq-id="assistant-close"]').click()
    await expect(panel).toHaveCount(0)
    await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible()
  })
})

const WIDGETS = {
  goodHtml: { name: 'goodHtml', label: 'Notes', type: 'html', gridColumns: 6 },
  badTable: { name: 'badTable', label: 'Totals', type: 'table', gridColumns: 6 },
}
const PAYLOADS: Record<string, unknown> = {
  goodHtml: { type: 'html', html: '<p>Still here.</p>' },
  badTable: { type: 'table', columns: [{ header: 'Total', accessor: 'total' }], rows: [{ total: SENTINEL }] },
}

test.describe('Fail soft: dashboard', () => {
  test('a crashing widget shows Retry in its place; other widgets and the shell keep working', async ({ page }) => {
    await injectRenderCrash(page)
    await setupApiMocks(page)
    const metaData = {
      ...METADATA,
      apps: { ...METADATA.apps, failLab: { name: 'failLab', label: 'Fail Lab', iconName: 'dashboard', widgets: Object.keys(WIDGETS), children: [], sections: [] } },
      appTree: [...METADATA.appTree, { name: 'failLab', label: 'Fail Lab', type: 'APP', iconName: 'dashboard', children: [] }],
      widgets: Object.fromEntries(Object.entries(WIDGETS).map(([name, widget]) => [name, { isCard: true, hasPermission: true, ...widget }])),
    }
    await page.route('**/qqq/v1/metaData**', (route) => {
      if (new URL(route.request().url()).pathname.endsWith('/metaData/authentication')) return route.fallback()
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(metaData) })
    })
    await page.route('**/qqq/v1/widget/**', (route) => {
      const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() ?? '')
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(PAYLOADS[name] ?? {}) })
    })
    await page.goto('/app/failLab')
    await waitForAppReady(page)

    await expect(page.locator('[data-qqq-id="widget-error-badTable"]')).toContainText('Widget failed to render')
    await expect(page.locator('[data-qqq-id="button-widget-retry-badTable"]')).toBeVisible()
    await expect(page.getByText('Still here.')).toBeVisible()
    await expect(page.locator('[data-qqq-id="page-error"]')).toHaveCount(0)
    // the shell (header) still works
    await expect(page.locator('[data-qqq-id="button-help"]')).toBeEnabled()
  })
})
