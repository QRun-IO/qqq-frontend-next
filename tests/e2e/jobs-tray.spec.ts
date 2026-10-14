// Mocked /qqq/v1 journey and reproducible Jobs screenshots; no live backend required.
import { test, expect, type Page } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'
import { checkA11y } from './a11y-helpers'

const screenshots = process.env.QQQ_JOBS_SCREENSHOTS

async function mockJobs(page: Page, alreadyTracked = false) {
  await setupApiMocks(page)
  let tracked = alreadyTracked
  let finished = false
  const tracks: unknown[] = []
  const startedAt = new Date(Date.now() - 75_000).toISOString()
  const snapshot = () => ({
    phases: [
      { name: 'prepare', label: 'Prepare', status: 'DONE' },
      { name: 'tables', label: 'Back up tables', status: finished ? 'DONE' : 'RUNNING' },
      { name: 'upload', label: 'Upload manifest', status: finished ? 'DONE' : 'PENDING' },
      { name: 'verify', label: 'Verify', status: finished ? 'DONE' : 'PENDING' },
    ],
    currentPhase: finished ? 'verify' : 'tables', percent: finished ? 100 : 42,
    done: finished ? 48 : 20, total: 48, unitLabel: 'tables', bytesDone: 18_874_368, bytesTotal: 45_088_768,
    etaSeconds: finished ? null : 105, message: finished ? 'Backup completed and verified.' : 'Backing up table 20 of 48',
  })
  const log = () => [
    { id: 1, level: 'INFO', message: 'Resolved backup scope: 48 tables.' },
    { id: 2, level: 'INFO', message: 'Wrote application settings: 1,204 rows, 2.1 MB.' },
    { id: 3, level: 'WARN', message: 'Skipped 3 missing media files.' },
    { id: 4, level: 'INFO', message: finished ? 'Backup completed and verified.' : 'Streaming table 20 of 48.' },
  ]
  const job = () => ({ jobId: 42, label: 'Back up workspace', processName: 'backupWorkspace', status: finished ? 'COMPLETED' : 'RUNNING', startedAt,
    finishedAt: finished ? new Date().toISOString() : null, logSeq: 4, ...snapshot() })
  await page.route('**/qqq/v1/version', (route) => route.fulfill({ json: { apiVersion: '1.4.0', features: ['durableJobs'], extensions: [] } }))
  await page.route(/\/qqq\/v1\/metaData(?:\?|$)/, (route) => route.fulfill({ json: { ...METADATA, tables: { ...METADATA.tables, jobs_job: { name: 'jobs_job', label: 'Jobs', fields: {} }, jobs_log: { name: 'jobs_log', label: 'Job Log', fields: {} } }, processes: {
    ...METADATA.processes,
    backupWorkspace: { ...METADATA.processes.importData, name: 'backupWorkspace', label: 'Back up workspace', frontendSteps: [], durableJobEligible: true },
  } } }))
  await page.route('**/qqq/v1/metaData/process/backupWorkspace', (route) => route.fulfill({ json: { ...METADATA.processes.importData, name: 'backupWorkspace', label: 'Back up workspace', frontendSteps: [], durableJobEligible: true } }))
  await page.route('**/qqq/v1/realtime/**', (route) => route.fulfill({ status: 503, json: { error: 'Polling fixture' } }))
  await page.route('**/qqq/v1/processes/backupWorkspace/init**', (route) => route.fulfill({ json: { type: 'JOB_STARTED', processUUID: 'process-42', jobUUID: 'async-42' } }))
  await page.route('**/qqq/v1/processes/backupWorkspace/*/status/**', (route) => route.fulfill({ json: { type: 'RUNNING', processUUID: 'process-42', message: 'Backing up', progress: snapshot(), logTail: log() } }))
  await page.route('**/qqq/v1/jobs**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/track')) {
      tracks.push(route.request().postDataJSON()); tracked = true
      return route.fulfill({ json: { jobId: 42 } })
    }
    if (url.pathname.endsWith('/progress')) return route.fulfill({ json: { job: job(), progress: snapshot(), log: log(), nextAfterLogId: 4, logDropped: 12, terminal: finished } })
    if (url.pathname.endsWith('/42')) return route.fulfill({ json: { ...job(), progress: snapshot(), actions: finished ? ['retry'] : ['cancel'] } })
    if (url.searchParams.get('scope') === 'all') return route.fulfill({ status: 403, json: { error: 'Requires jobs_admin' } })
    const state = url.searchParams.get('state')
    const jobs = tracked && (state === 'all' || (state === 'active' && !finished) || (state === 'recent' && finished)) ? [job()] : []
    return route.fulfill({ json: { jobs, activeCount: tracked && !finished ? 1 : 0, generatedAt: new Date().toISOString() } })
  })
  return { tracks, finish: () => { finished = true } }
}

async function noHorizontalScroll(page: Page) {
  // the page itself never scrolls sideways, and nothing in the content or the tray does
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('main *, [role="dialog"] *')].filter((element) => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1 && !['hidden', 'clip'].includes(getComputedStyle(element).overflowX)).map((element) => element.getAttribute('data-qqq-id') ?? element.tagName))).toEqual([])
}

test('inline run -> live phases/log -> background -> tray -> completed -> reopen', async ({ page }) => {
  const mock = await mockJobs(page)
  await page.goto('/app/backupWorkspace')
  await expect(page.getByRole('list', { name: 'Job phases' }).getByText(/Back up tables/)).toBeVisible()
  await expect(page.getByText('[INFO] Wrote application settings: 1,204 rows, 2.1 MB.')).toBeVisible()
  await page.getByRole('button', { name: 'Run in background' }).click()
  await expect(page).toHaveURL(/\/app\/?$/)
  expect(mock.tracks).toEqual([{ processName: 'backupWorkspace', processUUID: 'process-42', jobUUID: 'async-42' }])
  const trigger = page.getByRole('button', { name: 'Jobs, 1 active' })
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Jobs' }).getByText('running', { exact: true })).toBeVisible()
  mock.finish()
  await expect(page.getByRole('button', { name: 'Jobs, 0 active' })).toBeVisible({ timeout: 15_000 })
  const dialog = page.getByRole('dialog', { name: 'Jobs' })
  await expect(dialog.getByText('completed', { exact: true })).toBeVisible({ timeout: 15_000 })
  await dialog.getByRole('link', { name: /Back up workspace/ }).click()
  await expect(page).toHaveURL(/\/app\/jobs\/42\/?$/)
  await expect(page.getByText('Backup completed and verified.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open job record' })).toHaveAttribute('href', '/app/jobs_job/42')
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible()
})

for (const width of [390, 1440]) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`live view, tray and jobs page at ${width} ${scheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.emulateMedia({ colorScheme: scheme })
      await page.addInitScript((mode) => localStorage.setItem('qqq-dark-mode', String(mode === 'dark')), scheme)
      await mockJobs(page, true)
      await page.goto('/app/jobs/42')
      await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
      await expect(page.getByText('12 earlier lines not kept')).toBeVisible()
      await noHorizontalScroll(page)
      if (screenshots) await page.screenshot({ path: `${screenshots}/live-${width}-${scheme}.png`, animations: 'disabled' })
      if (width === 1440 && scheme === 'light') await checkA11y(page)
      await page.getByRole('button', { name: 'Jobs, 1 active' }).click()
      const dialog = page.getByRole('dialog', { name: 'Jobs' })
      await expect(dialog).toBeVisible()
      const box = await dialog.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      await noHorizontalScroll(page)
      if (screenshots) await page.screenshot({ path: `${screenshots}/tray-${width}-${scheme}.png`, animations: 'disabled' })
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: 'Jobs, 1 active' })).toBeFocused()
      await page.goto('/app/jobs')
      await expect(page.getByRole('link', { name: /Back up workspace/ })).toBeVisible()
      await expect(page.getByRole('tab', { name: 'all' })).toHaveCount(0)
      await noHorizontalScroll(page)
      if (screenshots) await page.screenshot({ path: `${screenshots}/page-${width}-${scheme}.png`, animations: 'disabled' })
      if (width === 1440 && scheme === 'light') await checkA11y(page)
    })
  }
}

test('reduced motion keeps fills, running phases and the header ring static', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mockJobs(page, true)
  await page.goto('/app/jobs/42')
  await expect(page.getByRole('progressbar')).toBeVisible()
  const motion = await page.locator('.qqq-job-fill,.qqq-job-pulse,.qqq-job-ring').evaluateAll((nodes) => nodes.map((node) => ({ animation: getComputedStyle(node).animationName, transition: getComputedStyle(node).transitionDuration })))
  expect(motion.length).toBeGreaterThanOrEqual(3)
  for (const item of motion) { expect(item.animation).toBe('none'); expect(parseFloat(item.transition)).toBeLessThanOrEqual(0.0001) }
})
