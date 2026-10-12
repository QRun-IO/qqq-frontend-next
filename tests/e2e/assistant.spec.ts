// E2E: QQQ Assistant panel (qbit-assistant) against mocked /qqq/v1/assistant routes:
// probe gating, Ctrl/⌘+J, streaming reply with tool step and record chip, navigation, cancel,
// docked panel vs sheet (desktop / tablet / phone), deep link, command palette hand-over,
// axe, and one scroll container per region (no double or horizontal page scrollbars).

import { test, expect, type Page, type Route } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'
import { checkA11y } from './a11y-helpers'

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180 },
  phone: { width: 390, height: 844 },
  smallPhone: { width: 360, height: 740 },
}

/** Where screenshots go when QQQ_ASSISTANT_SCREENSHOTS is set (a directory). */
const SCREENSHOT_DIR = process.env.QQQ_ASSISTANT_SCREENSHOTS

const CONVERSATION = { id: 4, title: 'Active people', status: 'ACTIVE', pinned: false, lastMessageAt: null, unreadCount: 0, createDate: '2026-10-12T00:00:00Z' }

/**
 * Formats stream events as SSE frames.
 *
 * @param events - `[type, data]` pairs.
 * @returns Event-stream text.
 */
function sse(...events: Array<[string, Record<string, unknown>]>): string {
  return events.map(([type, data]) => `id: ${data.seq}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`).join('')
}

const LONG_TEXT = Array.from({ length: 30 }, (_, index) => `Paragraph ${index + 1}: People records are listed with their status.`).join('\n\n')

/** The records table of the query step. */
const RECORDS_RENDER = {
  type: 'records', tableName: 'person', tableLabel: 'People', truncated: false, totalCount: 2, openHref: '/app/person?filter=e30=',
  columns: [{ name: 'firstName', label: 'First Name' }, { name: 'lastName', label: 'Last Name' }, { name: 'status', label: 'Status' }],
  rows: [
    { id: 1, href: '/app/person/1', values: { firstName: 'Alice', lastName: 'Johnson', status: 'Active' } },
    { id: 2, href: '/app/person/2', values: { firstName: 'Bob', lastName: 'Martinez', status: 'Active' } },
  ],
}

/** The reply to "Who is active?": a tool step with a records table and chips, text, then navigation. */
const REPLY = sse(
  ['message.start', { seq: 1, turnId: 9, conversationId: 4, userMessageId: 10, messageId: 11 }],
  ['tool.start', { seq: 2, messageId: 11, toolCallId: 't1', name: 'query_records', summary: 'Querying People' }],
  ['tool.result', {
    seq: 3, messageId: 11, toolCallId: 't1', name: 'query_records', outcome: 'OK', summary: 'Queried People · 2 rows',
    render: RECORDS_RENDER,
    recordRefs: [
      { tableName: 'person', tableLabel: 'People', id: 1, label: 'Alice Johnson', href: '/app/person/1' },
      { tableName: 'person', tableLabel: 'People', id: 2, label: 'Bob Martinez', href: '/app/person/2' },
    ],
  }],
  ['text.delta', { seq: 4, messageId: 11, text: 'Two people are **active**. ' }],
  ['text.delta', { seq: 5, messageId: 11, text: `Opening the first one.\n\n${LONG_TEXT}` }],
  ['ui.navigate', { seq: 6, messageId: 11, href: '/app/person/1' }],
  ['message.end', { seq: 7, messageId: 11, status: 'COMPLETE' }],
)

/** Stored messages after the reply (what GET /conversations/4 serves once the turn ended). */
const STORED = [
  { id: 10, role: 'USER', status: 'COMPLETE', turnId: 9, createDate: '2026-10-12T00:00:00Z', parts: [{ type: 'text', text: 'Who is active?' }] },
  {
    id: 11, role: 'ASSISTANT', status: 'COMPLETE', turnId: 9, createDate: '2026-10-12T00:00:00Z', parts: [
      { type: 'tool', toolCallId: 't1', name: 'query_records', summary: 'Queried People · 2 rows', outcome: 'OK', render: RECORDS_RENDER },
      { type: 'record_refs', refs: [
        { tableName: 'person', tableLabel: 'People', id: 1, label: 'Alice Johnson', href: '/app/person/1' },
        { tableName: 'person', tableLabel: 'People', id: 2, label: 'Bob Martinez', href: '/app/person/2' },
      ] },
      { type: 'text', text: `Two people are **active**. Opening the first one.\n\n${LONG_TEXT}` },
      { type: 'navigate', href: '/app/person/1' },
    ],
  },
]

const CANCELLED_END = sse(['message.end', { seq: 3, messageId: 11, status: 'CANCELLED' }])

/** Recorded assistant traffic of one test. */
interface AssistantMock {
  turns: unknown[]
  cancels: number
  /** Resolves a held turn-events request (cancel scenario). */
  releaseEvents?: (body: string) => void
}

/**
 * Mocks the assistant routes (call after setupApiMocks: later routes win).
 *
 * @param page - The page.
 * @param options - `reply` streams on POST turns; `hold` leaves the resume request pending until released.
 * @param options.reply - The SSE body of a turn.
 * @param options.hold - Whether `/turns/9/events` waits for {@link AssistantMock.releaseEvents}.
 * @param options.stored - The messages stored once the turn ends (default {@link STORED}).
 * @returns The recorded traffic.
 */
async function mockAssistant(page: Page, options: { reply?: string; hold?: boolean; stored?: unknown[] } = {}): Promise<AssistantMock> {
  const mock: AssistantMock = { turns: [], cancels: 0 }
  let stored: unknown[] = []
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  // the instance announces the qbit, so the UI probes /assistant/config
  await page.route(/\/qqq\/v1\/metaData(\?|$)/, (route) => json(route, { ...METADATA, supplementalInstanceMetaData: { assistant: {} } }))
  await page.route('**/qqq/v1/assistant/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/qqq/v1/assistant', '')
    const method = request.method()
    if (path === '/config') return json(route, { enabled: true, shortcut: 'mod+j', model: 'claude-sonnet-5-5', features: { writes: false } })
    if (path === '/conversations' && method === 'GET') return json(route, { conversations: stored.length ? [CONVERSATION] : [] })
    if (path === '/conversations' && method === 'POST') return json(route, { ...CONVERSATION, title: null }, 201)
    if (path === '/conversations/4' && method === 'GET') return json(route, { conversation: CONVERSATION, messages: stored })
    if (path === '/conversations/4/turns') {
      mock.turns.push(request.postDataJSON())
      stored = options.stored ?? STORED
      return route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }, body: options.reply ?? REPLY })
    }
    if (path === '/turns/9/events' && options.hold) {
      if (mock.cancels) return route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: CANCELLED_END })
      const body = await new Promise<string>((resolve) => { mock.releaseEvents = resolve })
      return route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body })
    }
    if (path === '/turns/9/cancel') {
      mock.cancels++
      mock.releaseEvents?.(CANCELLED_END)
      return json(route, { status: 'CANCELLING' }, 202)
    }
    if (path.endsWith('/feedback')) return route.fulfill({ status: 204 })
    return json(route, { error: 'not mocked' }, 404)
  })
  return mock
}

/**
 * Waits for the dashboard shell.
 *
 * @param page - The page.
 */
async function waitForAppReady(page: Page) {
  await page.waitForSelector('[role="status"][aria-label="Loading"]', { state: 'hidden', timeout: 30000 }).catch(() => null)
  await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible({ timeout: 30000 })
  await page.waitForSelector('[aria-label="Loading content"]', { state: 'hidden', timeout: 15000 }).catch(() => null)
}

/**
 * Lists the scroll containers on the page: the document when it scrolls, and every element
 * whose content overflows a scrolling box (vertical or horizontal).
 *
 * @param page - The page.
 * @returns `data-qqq-id` (or tag) of each scroller, with its axis.
 */
async function scrollContainers(page: Page): Promise<{ document: { vertical: boolean; horizontal: boolean }; elements: string[] }> {
  return page.evaluate(() => {
    const root = document.scrollingElement as HTMLElement
    const elements: string[] = []
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const vertical = /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1
      const horizontal = /(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1
      if (vertical || horizontal) elements.push(`${element.dataset.qqqId ?? element.tagName.toLowerCase()}:${vertical ? 'y' : ''}${horizontal ? 'x' : ''}`)
    }
    return {
      document: { vertical: root.scrollHeight > window.innerHeight + 1, horizontal: root.scrollWidth > window.innerWidth + 1 },
      elements,
    }
  })
}

/**
 * Asks a question in the open panel.
 *
 * @param page - The page.
 * @param text - The question.
 */
async function ask(page: Page, text: string) {
  const composer = page.locator('[data-qqq-id="assistant-composer"]')
  await composer.fill(text)
  await composer.press('Enter')
}

test.describe('Assistant panel: gating', () => {
  test('makes no assistant request when the metadata does not announce the qbit', async ({ page }) => {
    await setupApiMocks(page)
    const requests: string[] = []
    page.on('request', (request) => { if (request.url().includes('/assistant/')) requests.push(request.url()) })
    await page.goto('/app/person')
    await waitForAppReady(page)
    await expect(page.locator('[data-qqq-id="button-keyboard-shortcuts"]')).toBeVisible()
    await expect(page.locator('[data-qqq-id="button-assistant"]')).toHaveCount(0)
    await page.locator('body').click()
    await page.keyboard.press('Control+j')
    await expect(page.locator('[data-qqq-id="assistant-panel"]')).toHaveCount(0)
    expect(requests).toEqual([])
  })

  test('is absent and Ctrl+J is inert when the probe 404s', async ({ page }) => {
    await setupApiMocks(page)
    await page.route(/\/qqq\/v1\/metaData(\?|$)/, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...METADATA, supplementalInstanceMetaData: { assistant: {} } }) }))
    await page.route('**/qqq/v1/assistant/**', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Not found"}' }))
    await page.goto('/app/person')
    await waitForAppReady(page)
    await expect(page.locator('[data-qqq-id="button-keyboard-shortcuts"]')).toBeVisible()
    await expect(page.locator('[data-qqq-id="button-assistant"]')).toHaveCount(0)
    await page.locator('body').click()
    await page.keyboard.press('Control+j')
    await expect(page.locator('[data-qqq-id="assistant-panel"]')).toHaveCount(0)
  })
})

test.describe('Assistant panel: desktop (docked)', () => {
  test.use({ viewport: VIEWPORTS.desktop })

  test('Ctrl+J opens it docked; a question streams a tool step, record chips and text, navigation keeps it open', async ({ page }) => {
    await setupApiMocks(page)
    const mock = await mockAssistant(page)
    await page.goto('/app/person')
    await waitForAppReady(page)

    // works while typing in a text field
    await page.locator('input[data-qqq-id="quick-search"]').click()
    await page.keyboard.press('Control+j')
    const panel = page.locator('aside[data-qqq-id="assistant-panel"]')
    await expect(panel).toBeVisible()
    await expect(page.locator('[data-qqq-id="assistant-composer"]')).toBeFocused()
    await expect(panel.locator('[data-qqq-id="assistant-context-chip"]')).toContainText('On: People')

    await ask(page, 'Who is active?')
    await expect(panel.locator('[data-qqq-id="assistant-markdown"]').first()).toContainText('Two people are active.')
    expect(mock.turns).toEqual([{ text: 'Who is active?', pageContext: { route: '/app/person', tableName: 'person' } }])
    await expect(panel.locator('[data-qqq-id="assistant-tool-step"] button').first()).toContainText('Queried People · 2 rows')
    const chip = panel.locator('[data-qqq-id="assistant-record-chip"]').first()
    await expect(chip).toHaveAttribute('href', '/app/person/1')

    // ui.navigate routed in place; the panel stayed open
    await expect(page).toHaveURL(/\/app\/person\/1$/)
    await expect(panel).toBeVisible()

    // the inline table is shown once the panel is wide enough; widen with the keyboard
    const handle = panel.locator('[data-qqq-id="assistant-resize"]')
    await handle.focus()
    await page.keyboard.press('End')
    await expect(handle).toHaveAttribute('aria-valuenow', '640')
    await expect(panel).toHaveJSProperty('offsetWidth', 640)
    await panel.locator('[data-qqq-id="assistant-messages"]').evaluate((element) => { element.scrollTop = 0 })
    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/assistant-desktop.png` })

    // chips open the record
    await page.goto('/app/person')
    await waitForAppReady(page)
    await expect(panel).toBeVisible()
  })

  test('one scroll container per region, no page or horizontal scrollbar, and axe passes', async ({ page }) => {
    await setupApiMocks(page)
    await mockAssistant(page)
    await page.goto('/app/person')
    await waitForAppReady(page)
    await page.locator('body').click()
    await page.keyboard.press('Control+j')
    await ask(page, 'Who is active?')
    await expect(page.locator('[data-qqq-id="assistant-feedback"]')).toBeVisible()

    const result = await scrollContainers(page)
    expect(result.document).toEqual({ vertical: false, horizontal: false })
    // the message list scrolls on its own; nothing else in the panel does (the page's data grid
    // keeps its own sideways scroller for its columns, as at any narrower window)
    expect(result.elements).toContain('assistant-messages:y')
    expect(result.elements.filter((entry) => !['assistant-messages:y', 'main-content:y'].includes(entry) && !/^grid-[^:]+:x$/.test(entry))).toEqual([])

    await checkA11y(page)
  })

  test('Stop cancels the running turn through the cancel endpoint', async ({ page }) => {
    await setupApiMocks(page)
    // the turn starts, the connection drops, the resumed stream waits until the cancel
    const mock = await mockAssistant(page, {
      hold: true,
      reply: sse(
        ['message.start', { seq: 1, turnId: 9, conversationId: 4, userMessageId: 10, messageId: 11 }],
        ['text.delta', { seq: 2, messageId: 11, text: 'Counting people' }],
      ),
      stored: [
        { ...STORED[0], parts: [{ type: 'text', text: 'Count people' }] },
        { ...STORED[1], status: 'CANCELLED', parts: [{ type: 'text', text: 'Counting people' }] },
      ],
    })
    await page.goto('/app/person')
    await waitForAppReady(page)
    await page.locator('body').click()
    await page.keyboard.press('Meta+j')
    await ask(page, 'Count people')
    await expect(page.locator('[data-qqq-id="assistant-markdown"]')).toContainText('Counting people')
    await page.locator('[data-qqq-id="assistant-stop"]').click()
    await expect(page.locator('[data-qqq-id="assistant-message"][data-role="assistant"]')).toContainText('Stopped.')
    expect(mock.cancels).toBe(1)
    await expect(page.locator('[data-qqq-id="assistant-send"]')).toBeVisible()
  })

  test('the command palette hands typed text to the assistant', async ({ page }) => {
    await setupApiMocks(page)
    const mock = await mockAssistant(page)
    await page.goto('/app/person')
    await waitForAppReady(page)
    await page.locator('body').click()
    await page.keyboard.press('Control+k')
    await page.locator('[data-qqq-id="command-menu-search"]').fill('who is active')
    await page.locator('[data-qqq-id="command-ask-assistant"]').click()
    await expect(page.locator('aside[data-qqq-id="assistant-panel"]')).toBeVisible()
    await expect.poll(() => mock.turns.length).toBe(1)
    expect(mock.turns[0]).toMatchObject({ text: 'who is active' })
  })

  test('the deep link opens a new conversation with the prompt pre-filled and removes its parameters', async ({ page }) => {
    await setupApiMocks(page)
    const mock = await mockAssistant(page)
    await page.goto('/app/person/1?assistant=open&assistantPrompt=Tell%20me%20about%20this%20record.')
    await waitForAppReady(page)
    const composer = page.locator('[data-qqq-id="assistant-composer"]')
    await expect(composer).toHaveValue('Tell me about this record.')
    await expect(page).toHaveURL(/\/app\/person\/1$/)
    await expect(page.locator('[data-qqq-id="assistant-context-chip"]')).toContainText('People')
    expect(mock.turns).toEqual([])
    await composer.press('Enter')
    await expect.poll(() => mock.turns.length).toBe(1)
    expect(mock.turns[0]).toEqual({ text: 'Tell me about this record.', pageContext: { route: '/app/person/1', tableName: 'person', recordId: '1' } })
  })
})

for (const [name, viewport] of Object.entries({ tablet: VIEWPORTS.tablet, phone: VIEWPORTS.phone, smallPhone: VIEWPORTS.smallPhone })) {
  test.describe(`Assistant panel: ${name} (sheet)`, () => {
    test.use({ viewport, hasTouch: name !== 'tablet' })

    test(`opens as a sheet from the header button, stays readable without horizontal scroll, and Escape restores focus @mobile`, async ({ page }) => {
      await setupApiMocks(page)
      await mockAssistant(page)
      await page.goto('/app/person')
      await waitForAppReady(page)
      const button = page.locator('[data-qqq-id="button-assistant"]')
      await button.click()
      const sheet = page.locator('[role="dialog"][data-qqq-id="assistant-panel"]')
      await expect(sheet).toBeVisible()
      const box = await sheet.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
      if (name !== 'tablet') expect(Math.round(box!.width)).toBe(viewport.width)

      await ask(page, 'Who is active?')
      await expect(sheet.locator('[data-qqq-id="assistant-markdown"]').first()).toContainText('Two people are active.')
      await expect(sheet.locator('[data-qqq-id="assistant-records"]')).toBeVisible()
      // the composer stays at the bottom of the sheet, on screen
      const composerBox = await sheet.locator('[data-qqq-id="assistant-composer-form"]').boundingBox()
      expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(viewport.height + 1)

      const result = await scrollContainers(page)
      expect(result.document.horizontal).toBe(false)
      const inSheet = await sheet.evaluate((element) => {
        const found: string[] = []
        for (const node of Array.from(element.querySelectorAll<HTMLElement>('*'))) {
          const style = getComputedStyle(node)
          if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) found.push(node.dataset.qqqId ?? node.tagName)
          if (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1) found.push(`${node.dataset.qqqId ?? node.tagName}:x`)
        }
        return found
      })
      expect(inSheet).toEqual(['assistant-messages'])

      if (SCREENSHOT_DIR) {
        await sheet.locator('[data-qqq-id="assistant-messages"]').evaluate((element) => { element.scrollTop = 0 })
        await page.screenshot({ path: `${SCREENSHOT_DIR}/assistant-${name}.png` })
      }
      await checkA11y(page)

      await page.keyboard.press('Escape')
      await expect(sheet).toHaveCount(0)
      await expect(button).toBeFocused()
    })
  })
}
