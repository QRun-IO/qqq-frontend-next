/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Material Dashboard URL shapes (QRun-IO/qqq#714): table-scoped process links, and process runs
// that return to the record or query they were launched from.
import type { Page, Request } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { expectRecords, recordCollection, v1MetaData, waitForShell } from './nav-helpers'

/** Waits for the next process init of a process and returns the request. */
function nextInit(page: Page, processName: string): Promise<Request> {
  return page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname === `/processes/${processName}/init`)
}

/** One multipart field of a captured request. */
function field(request: Request, name: string): string | undefined {
  return new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`).exec(request.postData() ?? '')?.[1]
}

/** The heading of the current process screen. */
function stepHeading(page: Page, stepName: string) {
  return page.locator(`[data-qqq-id="process-step-${stepName}"] [data-qqq-id="process-step-heading"]`)
}

/** Summary lines of a process result, as `STATUS text`. */
async function summaryLines(page: Page): Promise<string[]> {
  const lines = page.locator('[data-qqq-id^="process-summary-line-"]')
  const texts: string[] = []
  for (let i = 0; i < await lines.count(); i++) {
    texts.push(`${await lines.nth(i).getAttribute('data-status')} ${(await lines.nth(i).innerText()).replace(/^(OK|Info|Warning|Error):\s*/, '').trim()}`)
  }
  return texts
}

/** A `filter` URL parameter as JSON, whether plain (Material links) or base64 (the Next query screen). */
function filterParam(url: string): unknown {
  const value = new URL(url).searchParams.get('filter')
  if (value === null) return null
  try {
    return JSON.parse(value)
  } catch {
    return JSON.parse(Buffer.from(value, 'base64').toString('utf8'))
  }
}

/** Runs clonePeople from its review screen to the result, skipping validation. */
async function cloneThroughResult(page: Page) {
  await expect(stepHeading(page, 'review')).toHaveText('Review')
  await page.locator('[data-qqq-id="process-step-review"]').getByRole('radio', { name: /Skip Validation/ }).check()
  await page.locator('[data-qqq-id="button-next"]').click()
  await expect(stepHeading(page, 'result')).toHaveText('Result')
  await expect.poll(() => summaryLines(page)).toEqual(['OK 1 were cloned'])
}

/** Cancels a running process through its confirmation dialog. */
async function cancelRun(page: Page) {
  await page.locator('[data-qqq-id="button-cancel"]').click()
  await page.getByRole('dialog', { name: 'Cancel Process?' }).getByRole('button', { name: 'Cancel Process' }).click()
}

test.describe('Material table-scoped URLs', () => {
  test('[NAV-030] /app/{table}/{process} opens the table process or an instance process, replacing the history entry', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const meta = await v1MetaData(backend)
    expect(meta.processes['person.bulkEdit']?.label).toBe('Person Bulk Edit')
    expect(meta.processes.prcQuickTask?.label).toBe('Quick Task')

    await open(page, '/app/person')
    await expectRecords(page, 'Person', ['Avery', 'Blair', 'Casey', 'Drew', 'Morgan'])
    const init = nextInit(page, 'person.bulkEdit')
    await open(page, '/app/person/person.bulkEdit?recordsParam=recordIds&recordIds=1,2')
    await expect(page).toHaveURL(/\/app\/person\.bulkEdit\/?\?recordsParam=recordIds&recordIds=1%2C2&returnTo=%2Fapp%2Fperson$/)
    expect(field(await init, 'recordIds')).toBe('1,2')
    await expect(stepHeading(page, 'edit')).toHaveText('Edit Values')
    // Back skips the Material URL (it was replaced) and returns to the table
    await page.goBack({ waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/app\/person\/?$/)
    await expect(recordCollection(page, 'Person')).toBeVisible()

    // an instance-wide process by exact name, returning to the table
    await open(page, '/app/person/prcQuickTask')
    await expect(page).toHaveURL(/\/app\/prcQuickTask\/?\?returnTo=%2Fapp%2Fperson$/)
    await expect(page.locator('[data-qqq-id="process-run-prcQuickTask"]')).toBeVisible()
  })

  test('[NAV-030] /app/{table}/{id}/{process} runs the process for that record and Return comes back to the record', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const init = nextInit(page, 'clonePeople')
    await open(page, '/app/person/1/clonePeople')
    await expect(page).toHaveURL(/\/app\/clonePeople\/?\?recordsParam=recordIds&recordIds=1&returnTo=%2Fapp%2Fperson%2F1$/)
    expect([field(await init, 'recordsParam'), field(await init, 'recordIds')]).toEqual(['recordIds', '1'])
    await cloneThroughResult(page)
    expect(await backend.sql("select first_name from person where first_name like 'Clone of%'")).toEqual([{ first_name: 'Clone of: Avery' }])
    await page.locator('[data-qqq-id="button-return"]').click()
    await expect(page).toHaveURL(/\/app\/person\/1\/?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Avery Sample' })).toBeVisible()

    // a table process named by its suffix (Material matches the table's processes that way)
    const bulk = nextInit(page, 'person.bulkEdit')
    await open(page, '/app/person/2/bulkEdit')
    await expect(page).toHaveURL(/\/app\/person\.bulkEdit\/?\?recordsParam=recordIds&recordIds=2&returnTo=%2Fapp%2Fperson%2F2$/)
    expect(field(await bulk, 'recordIds')).toBe('2')
    await expect(stepHeading(page, 'edit')).toHaveText('Edit Values')
    await cancelRun(page)
    await expect(page).toHaveURL(/\/app\/person\/2\/?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Blair Sample' })).toBeVisible()
  })

  test('[NAV-030] an unknown segment after a record id shows the not-found state and starts nothing', async ({ page, backend, diagnostics }) => {
    void diagnostics
    expect((await v1MetaData(backend)).processes.noSuchProcess).toBeUndefined()
    const inits: string[] = []
    page.on('request', (request) => { if (/\/processes\/[^/]+\/init$/.test(new URL(request.url()).pathname)) inits.push(request.url()) })
    await open(page, '/app/person/1/noSuchProcess')
    await waitForShell(page)
    const state = page.locator('[data-qqq-id="not-found-state"]')
    await expect(state.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expect(state).toContainText('There is no app, table, process or report named noSuchProcess that you can open.')
    await expect(page).toHaveURL(/\/app\/person\/1\/noSuchProcess\/?$/)
    expect(inits).toEqual([])
  })
})

test.describe('process runs return to where they were launched', () => {
  test('[NAV-031] a process launched from a record view returns to the record', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/person/2')
    await expect(page.getByRole('heading', { level: 1, name: 'Blair Sample' })).toBeVisible()
    await page.getByRole('button', { name: 'Record actions menu' }).click()
    const init = nextInit(page, 'clonePeople')
    await page.getByRole('menuitem', { name: 'Clone People' }).click()
    await expect(page).toHaveURL(/\/app\/clonePeople\/?\?recordsParam=recordIds&recordIds=2&returnTo=%2Fapp%2Fperson%2F2$/)
    expect(field(await init, 'recordIds')).toBe('2')
    await cloneThroughResult(page)
    expect(await backend.sql("select first_name from person where first_name like 'Clone of%'")).toEqual([{ first_name: 'Clone of: Blair' }])
    await page.locator('[data-qqq-id="button-return"]').click()
    await expect(page).toHaveURL(/\/app\/person\/2\/?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Blair Sample' })).toBeVisible()
  })

  test('[NAV-031] a process launched from a filtered query returns to the same filter and rows', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const filter = { criteria: [{ fieldName: 'isEmployed', operator: 'EQUALS', values: [true] }] }
    const employed = (await backend.sql('select first_name from person where is_employed = true order by id')).map((row) => row.first_name!)
    expect(employed).toEqual(['Avery', 'Blair', 'Casey', 'Drew'])
    await open(page, `/app/person?filter=${encodeURIComponent(JSON.stringify(filter))}`)
    await expectRecords(page, 'Person', employed)
    const launchedFrom = new URL(page.url())
    await page.locator('[data-qqq-id="grid-select-row-0"]').check()
    const init = nextInit(page, 'person.bulkEdit')
    await page.getByRole('button', { name: 'Actions' }).click()
    await page.getByRole('menuitem', { name: 'Bulk Edit', exact: true }).click()
    const request = await init
    const selected = field(request, 'recordIds')
    expect(selected).toMatch(/^\d+$/)
    const returnTo = new URL(page.url()).searchParams.get('returnTo')
    expect(returnTo).toBe(`${launchedFrom.pathname}${launchedFrom.search}`)

    const edit = page.locator('[data-qqq-id="process-step-edit"]')
    await expect(stepHeading(page, 'edit')).toHaveText('Edit Values')
    await edit.getByRole('switch', { name: 'Edit Days Worked' }).check()
    await edit.getByLabel('Days Worked', { exact: true }).fill('777')
    await page.locator('[data-qqq-id="button-next"]').click()
    await expect(stepHeading(page, 'review')).toHaveText('Review')
    await page.locator('[data-qqq-id="process-step-review"]').getByRole('radio', { name: /Skip Validation/ }).check()
    await page.locator('[data-qqq-id="button-next"]').click()
    await expect(stepHeading(page, 'result')).toHaveText('Result')
    expect(await backend.sql(`select days_worked from person where id = ${selected}`)).toEqual([{ days_worked: '777' }])

    await page.locator('[data-qqq-id="button-return"]').click()
    await expect(page).toHaveURL(/\/app\/person\/?\?/)
    expect(filterParam(page.url())).toEqual(filterParam(launchedFrom.href))
    expect(filterParam(page.url())).toMatchObject(filter)
    await expectRecords(page, 'Person', employed)
    await expect(recordCollection(page, 'Person').getByText('Morgan', { exact: true })).toHaveCount(0)
  })
})
