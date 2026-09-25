/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Long-process budget: prfLongRun walks all 10,000 prfWide rows in 40 pages, pausing 250 ms
// per page, so its job runs about 10 s and the UI polls its status (PerformanceFixtures.java).
import { expect, test } from '../../support/fixtures'
import { advance, expectScreen, openProcess, screen, viewValue } from '../processes/process-helpers'
import { PERFORMANCE_BUDGET } from './budgets'

/** use-process.ts polls a running job every POLL_INITIAL_MILLIS (1.5 s) after the last answer. */
const POLL_MILLIS = 1_500

test('[PRF-005] a 10-second job over 10,000 rows reports progress, polls at a bounded rate and shows its result promptly', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const polls: Array<{ sent: number; done?: number }> = []
  const isPoll = (url: string) => /\/processes\/prfLongRun\/[^/]+\/status\//.test(new URL(url).pathname)
  page.on('request', (request) => {
    if (isPoll(request.url())) polls.push({ sent: Date.now() })
  })
  page.on('requestfinished', (request) => {
    if (isPoll(request.url())) {
      const open = polls.find((poll) => poll.done === undefined)
      if (open) open.done = Date.now()
    }
  })

  await openProcess(page, 'prfLongRun')
  const configure = await expectScreen(page, 'configure', 'Configure')
  await expect(configure.getByLabel('Pause Millis')).toHaveValue('250')
  await advance(page, 'Submit')

  const message = page.locator('[data-qqq-id="process-working"] [data-qqq-id="process-working-message"]')
  await expect(message).toHaveText(/^Walked \d+ of 10000 rows$/, { timeout: 20_000 })
  const walked = async () => Number((await message.textContent())?.match(/^Walked (\d+)/)?.[1] ?? NaN)
  const first = await walked()
  await expect.poll(walked, { timeout: 20_000 }).toBeGreaterThan(first)

  await screen(page, 'finished').waitFor({ state: 'visible', timeout: 40_000 })
  const shown = Date.now()
  const finished = await expectScreen(page, 'finished', 'Finished')
  const [log] = await backend.sql('select row_count, count_total, started_millis, finished_millis from prf_run_log')
  const total = Array.from({ length: 10_000 }, (_, i) => ((i + 1) * 4) % 1000).reduce((sum, value) => sum + value, 0)
  expect(log).toMatchObject({ row_count: '10000', count_total: String(total) })
  await expect(viewValue(finished, 'rowCount')).toHaveText('10000')
  await expect(viewValue(finished, 'countTotal')).toHaveText(String(total))

  // bounded polling: one request at a time, never sooner than the poll interval after the last answer
  expect(polls.length, 'status polls').toBeGreaterThan(2)
  expect(polls.every((poll) => poll.done !== undefined), 'every poll answered').toBe(true)
  for (let i = 1; i < polls.length; i++) {
    expect(polls[i].sent, `poll ${i + 1} waits for poll ${i}`).toBeGreaterThanOrEqual(polls[i - 1].done!)
    expect(polls[i].sent - polls[i - 1].done!, `gap before poll ${i + 1}`).toBeGreaterThanOrEqual(POLL_MILLIS - 100)
  }
  const jobMillis = Number(log.finished_millis) - Number(log.started_millis)
  expect(polls.length, 'no more polls than the job length allows').toBeLessThanOrEqual(Math.ceil(jobMillis / POLL_MILLIS) + 2)

  const lag = shown - Number(log.finished_millis)
  test.info().annotations.push({ type: 'timing', description: `result lag: ${lag} ms, job ${jobMillis} ms, ${polls.length} polls (${test.info().project.name})` })
  expect(lag, 'result after the job finished').toBeLessThan(PERFORMANCE_BUDGET.processResultMs)
})
