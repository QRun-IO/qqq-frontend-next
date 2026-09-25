/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Locator, Page, Request } from '@playwright/test'
import { expect, open, test, type Backend, type Diagnostics } from '../../support/fixtures'
import { VIEWER, multipartFields, recordRequests, sqlCount, sqlOne, toasts } from './helpers'

test.use(VIEWER)

/** Script Lab's associated-script field (RecordsFixtures). */
const FIELD = 'greetingScriptId'
/** Script 101 on Script Lab record Alpha: revisions 101 (seq 1) and 102 (seq 2, current). */
const SCRIPT_ID = 101
/** The code a newly created script starts with (Material's "Create Script"). */
const NEW_SCRIPT_CODE = '// Edit this new script to define its code.'
/** Full name of the default sample identity (alice), the author of the revisions it stores. */
const SESSION_AUTHOR = 'Alice (sample)'
/** A dashboard DATE_TIME in the spec's zone, e.g. 2026-03-02 06:30:00 AM EST. */
const DATE_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [AP]M E[SD]T$/

function byId(page: Page, id: string): Locator {
  return page.locator(`[data-qqq-id="${id}"]`)
}

/** The associated-script card of Script Lab's greeting script field. */
function card(page: Page): Locator {
  return byId(page, `associated-script-${FIELD}`)
}

/** The version buttons of the associated script, in display order. */
function versions(page: Page): Locator {
  return card(page).locator('[data-qqq-id^="script-version-"]')
}

/** The code block of Script.js for the selected version. */
function code(page: Page): Locator {
  return byId(page, `script-code-${FIELD}-Script.js`)
}

/** The Edit / Edit and Activate button. */
function editButton(page: Page): Locator {
  return byId(page, `button-edit-script-${FIELD}`)
}

/** Every request the page sends whose path matches, for asserting what was (not) fetched. */
function requestsMatching(page: Page, pattern: RegExp): Request[] {
  const requests: Request[] = []
  page.on('request', (request) => {
    if (pattern.test(new URL(request.url()).pathname)) requests.push(request)
  })
  return requests
}

/** The sample classpath has no qqq-middleware-api, so the API catalog route does not exist (404). */
function allowMissingApiCatalog(diagnostics: Diagnostics) {
  diagnostics.allow('/apis.json 404')
  diagnostics.allow('Failed to load resource: the server responded with a status of 404')
}

/** Opens a Script Lab record's developer view and waits for its associated-script card. */
async function openScriptLab(page: Page, id: number) {
  await open(page, `/app/scriptLab/${id}/dev`)
  await expect(card(page).getByRole('heading', { level: 3, name: 'Greeting Script' })).toBeVisible()
}

/** Contents of the single file of a script revision, read with SQL. */
async function revisionCode(backend: Backend, revisionId: number | string): Promise<string> {
  const file = await sqlOne(backend, `select file_name, contents from script_revision_file where script_revision_id = ${revisionId}`)
  expect(file.file_name).toBe('Script.js')
  return file.contents!
}

/** Stores a revision of script 101 through the backend process, as the editors do. */
async function storeRevision(backend: Backend, contents: string, commitMessage: string) {
  return backend.api.post('/processes/storeScriptRevision/init', {
    multipart: { scriptId: String(SCRIPT_ID), commitMessage, fileNames: 'Script.js', 'fileContents:Script.js': contents, _qStepTimeoutMillis: '60000' },
  })
}

/** Runs the testScript process for script 101 with the given code and name. */
async function runTest(backend: Backend, contents: string, name: string) {
  return backend.api.post('/processes/testScript/init', {
    multipart: { scriptId: String(SCRIPT_ID), fileNames: 'Script.js', 'fileContents:Script.js': contents, name, _qStepTimeoutMillis: '60000' },
  })
}

/** The Script Lab 101 revision rows, newest sequence first. */
async function revisions(backend: Backend) {
  return backend.sql(`select id, sequence_no, commit_message, author, create_date from script_revision where script_id = ${SCRIPT_ID} order by sequence_no desc`)
}

test.describe('table developer view', () => {
  test('[REC-053] keeps the metadata sections and shows API Docs & Playground with no application APIs', async ({ page, backend, diagnostics }) => {
    allowMissingApiCatalog(diagnostics)
    const table = await (await backend.api.get('/qqq/v1/metaData/table/person')).json()
    expect((await backend.api.get('/apis.json?tableName=person')).status()).toBe(404)
    const specRequests = requestsMatching(page, /(versions|openapi)\.json$/)

    await open(page, '/app/person/dev')
    await expect(page.getByRole('heading', { level: 2, name: `Table Developer View: ${table.label}` })).toBeVisible()
    const stat = (label: string) => page.locator('p', { hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::p')
    await expect(stat('Fields')).toHaveText(String(Object.keys(table.fields).length))
    await expect(stat('Sections')).toHaveText(String(table.sections.length))
    await expect(stat('Primary Key')).toHaveText(table.primaryKeyField)
    expect([table.insertPermission, table.editPermission, table.deletePermission]).toEqual([true, true, true])
    await expect(stat('Capabilities')).toHaveText('Insert, Edit, Delete')

    const docs = byId(page, 'table-dev-api-docs')
    await expect(docs.getByRole('heading', { level: 3, name: 'API Docs & Playground' })).toBeVisible()
    await expect(byId(page, 'table-dev-no-apis')).toHaveText('This table is not available in any APIs.')
    await expect(byId(page, 'select-api')).toHaveCount(0)
    await expect(byId(page, 'select-api-version')).toHaveCount(0)
    await expect(docs.getByLabel('API', { exact: true })).toHaveCount(0)
    await expect(docs.getByLabel('Version', { exact: true })).toHaveCount(0)
    await expect(byId(page, 'table-dev-api-reference')).toHaveCount(0)
    await expect(page.locator('rapi-doc')).toHaveCount(0)

    // The raw metadata section still renders the table's metadata.
    const toggle = page.getByRole('button', { name: 'Full Table Metadata' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    const json = JSON.parse(await byId(page, 'json-output').innerText())
    expect(json.name).toBe('person')
    expect(json.label).toBe(table.label)
    expect(Object.keys(json.fields).sort()).toEqual(Object.keys(table.fields).sort())

    expect(diagnostics.failedRequests).toContain('GET /apis.json 404')
    expect(specRequests.map((request) => request.url())).toEqual([])
  })

  test.describe('as a viewer', () => {
    test.use({ persona: 'viewer' })

    test('[REC-053] a viewer sees the same empty state and cannot fetch any table spec', async ({ page, backend, diagnostics }) => {
      allowMissingApiCatalog(diagnostics)
      const table = await (await backend.api.get('/qqq/v1/metaData/table/person')).json()
      expect([table.insertPermission, table.editPermission, table.deletePermission]).toEqual([false, false, false])
      // No API lists the table for this session either, so there is no spec URL to fetch.
      const catalog = await backend.api.get('/apis.json?tableName=person')
      expect(catalog.status()).toBe(404)
      expect(await catalog.json()).not.toHaveProperty('apis')
      const specRequests = requestsMatching(page, /(versions|openapi)\.json$/)

      await open(page, '/app/person/dev')
      await expect(page.getByRole('heading', { level: 2, name: `Table Developer View: ${table.label}` })).toBeVisible()
      await expect(page.locator('p', { hasText: /^Capabilities$/ }).locator('xpath=following-sibling::p')).toHaveText('Read-only')
      const docs = byId(page, 'table-dev-api-docs')
      await expect(docs.getByRole('heading', { level: 3, name: 'API Docs & Playground' })).toBeVisible()
      await expect(byId(page, 'table-dev-no-apis')).toHaveText('This table is not available in any APIs.')
      await expect(byId(page, 'select-api')).toHaveCount(0)
      await expect(byId(page, 'select-api-version')).toHaveCount(0)
      await expect(byId(page, 'table-dev-api-reference')).toHaveCount(0)
      await expect(page.locator('rapi-doc')).toHaveCount(0)

      expect(diagnostics.failedRequests).toContain('GET /apis.json 404')
      expect(specRequests.map((request) => request.url())).toEqual([])
    })
  })
})

test.describe('record developer view: associated scripts', () => {
  test('[REC-054] versions list marks CURRENT and shows each version\'s code from script_revision_file', async ({ page, backend, diagnostics }) => {
    void diagnostics
    expect((await sqlOne(backend, `select current_script_revision_id from script where id = ${SCRIPT_ID}`)).current_script_revision_id).toBe('102')
    expect(await revisions(backend)).toEqual([
      { id: '102', sequence_no: '2', commit_message: 'Friendlier greeting', author: 'Owned author', create_date: '2026-03-02 11:30:00' },
      { id: '101', sequence_no: '1', commit_message: 'Initial version', author: 'Owned author', create_date: '2026-03-01 10:00:00' },
    ])
    const currentCode = await revisionCode(backend, 102)
    const firstCode = await revisionCode(backend, 101)
    expect(currentCode).not.toBe(firstCode)

    await openScriptLab(page, 1)
    await expect(card(page).getByRole('tab')).toHaveText(['Code', 'Logs', 'Test', 'Docs'])
    await expect(card(page).getByRole('tab', { name: 'Code' })).toHaveAttribute('aria-selected', 'true')
    await expect(versions(page)).toHaveCount(2)
    await expect(versions(page).nth(0)).toHaveAttribute('data-qqq-id', 'script-version-102')
    await expect(versions(page).nth(1)).toHaveAttribute('data-qqq-id', 'script-version-101')

    // CURRENT marks the script's current revision, which is selected by default.
    const current = byId(page, 'script-version-102')
    await expect(current).toHaveText('Version 2CURRENTFriendlier greeting2026-03-02 06:30:00 AM EST by Owned author')
    await expect(current).toHaveAttribute('aria-pressed', 'true')
    const older = byId(page, 'script-version-101')
    await expect(older).toHaveText('Version 1Initial version2026-03-01 05:00:00 AM EST by Owned author')
    await expect(older).toHaveAttribute('aria-pressed', 'false')
    await expect(code(page)).toHaveText(currentCode)
    await expect(card(page).locator('figcaption')).toHaveText('Script.js')
    await expect(editButton(page)).toHaveText('Edit')

    // Selecting the older version shows its code and offers to edit and activate it.
    await older.click()
    await expect(older).toHaveAttribute('aria-pressed', 'true')
    await expect(current).toHaveAttribute('aria-pressed', 'false')
    await expect(code(page)).toHaveText(firstCode)
    await expect(editButton(page)).toHaveText('Edit and Activate')
  })

  test('[REC-054] saving a new version stores a script_revision with its file and makes it current', async ({ page, backend, diagnostics }) => {
    void diagnostics
    expect(await sqlCount(backend, `select count(*) as n from script_revision where script_id = ${SCRIPT_ID}`)).toBe(2)
    const stores = recordRequests(page, '/processes/storeScriptRevision/init')
    const newCode = "return 'Hi there, ' + input.name + '!';"

    await openScriptLab(page, 1)
    await expect(code(page)).toHaveText(await revisionCode(backend, 102))
    await editButton(page).click()
    const dialog = byId(page, `dialog-script-editor-${FIELD}`)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Editing Code for Script: Alpha Greeting' })).toBeVisible()
    const editor = dialog.getByLabel('Script.js', { exact: true })
    await expect(editor).toHaveValue(await revisionCode(backend, 102))
    await editor.fill(newCode)
    await dialog.getByLabel('Commit message').fill('Acceptance greeting')
    await byId(page, `button-save-script-${FIELD}`).click()

    await expect(toasts(page).filter({ hasText: 'Saved New Script Version' })).toBeVisible()
    await expect(dialog).toHaveCount(0)
    expect(stores).toHaveLength(1)
    expect(multipartFields(stores[0])).toMatchObject({ scriptId: String(SCRIPT_ID), commitMessage: 'Acceptance greeting', fileNames: 'Script.js', 'fileContents:Script.js': newCode })

    // SQL: a third revision with the message, the session's author and the new file, now current.
    const rows = await revisions(backend)
    expect(rows).toHaveLength(3)
    const stored = rows[0]
    expect(stored).toMatchObject({ sequence_no: '3', commit_message: 'Acceptance greeting', author: SESSION_AUTHOR })
    expect(stored.create_date).not.toBeNull()
    expect(Number(stored.id)).toBeGreaterThanOrEqual(1000)
    expect(await revisionCode(backend, stored.id!)).toBe(newCode)
    expect((await sqlOne(backend, `select current_script_revision_id from script where id = ${SCRIPT_ID}`)).current_script_revision_id).toBe(stored.id)
    expect(await revisionCode(backend, 102)).toBe("return 'Hello, ' + input.name + '!';")

    // The UI selects the new current version.
    const assertNewCurrent = async () => {
      const newest = byId(page, `script-version-${stored.id}`)
      await expect(versions(page)).toHaveCount(3)
      await expect(versions(page).first()).toHaveAttribute('data-qqq-id', `script-version-${stored.id}`)
      await expect(newest).toContainText('Version 3')
      await expect(newest).toContainText('CURRENT')
      await expect(newest).toContainText('Acceptance greeting')
      await expect(newest.locator('span.block').last()).toHaveText(/ by Alice \(sample\)$/)
      expect((await newest.locator('span.block').last().innerText()).replace(/ by .*$/, '')).toMatch(DATE_TIME)
      await expect(newest).toHaveAttribute('aria-pressed', 'true')
      await expect(byId(page, 'script-version-102')).not.toContainText('CURRENT')
      await expect(code(page)).toHaveText(newCode)
      await expect(editButton(page)).toHaveText('Edit')
    }
    await assertNewCurrent()

    // It persists: a fresh load reads the same current version back.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(card(page).getByRole('heading', { level: 3, name: 'Greeting Script' })).toBeVisible()
    await assertNewCurrent()
  })

  test('[REC-054] Edit and Activate on an older version stores its code as the new current version', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const firstCode = await revisionCode(backend, 101)
    await openScriptLab(page, 1)
    await byId(page, 'script-version-101').click()
    await expect(code(page)).toHaveText(firstCode)
    await editButton(page).click()
    const dialog = byId(page, `dialog-script-editor-${FIELD}`)
    await expect(dialog.getByLabel('Script.js', { exact: true })).toHaveValue(firstCode)
    // No commit message typed: the stored revision gets Material's default message.
    await expect(dialog.getByLabel('Commit message')).toHaveValue('')
    await byId(page, `button-save-script-${FIELD}`).click()
    await expect(toasts(page).filter({ hasText: 'Saved New Script Version' })).toBeVisible()

    const stored = (await revisions(backend))[0]
    expect(stored).toMatchObject({ sequence_no: '3', commit_message: 'No commit message given', author: SESSION_AUTHOR })
    expect(await revisionCode(backend, stored.id!)).toBe(firstCode)
    expect((await sqlOne(backend, `select current_script_revision_id from script where id = ${SCRIPT_ID}`)).current_script_revision_id).toBe(stored.id)
    const newest = byId(page, `script-version-${stored.id}`)
    await expect(newest).toContainText('Version 3')
    await expect(newest).toContainText('CURRENT')
    await expect(newest).toContainText('No commit message given')
    await expect(newest).toHaveAttribute('aria-pressed', 'true')
    await expect(code(page)).toHaveText(firstCode)
  })

  test('[REC-054] test run output and log lines equal the backend testScript response', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const currentCode = await revisionCode(backend, 102)
    const tests = recordRequests(page, '/processes/testScript/init')

    await openScriptLab(page, 1)
    await expect(code(page)).toHaveText(currentCode)
    await card(page).getByRole('tab', { name: 'Test' }).click()
    await expect(card(page).getByRole('heading', { level: 4, name: 'Test Input' })).toBeVisible()
    const name = card(page).getByLabel('Greeting Name')
    await expect(name).toHaveAttribute('id', `script-test-${FIELD}-name`)
    await expect(name).toHaveValue('World')
    await name.fill('Ada')
    await byId(page, `button-test-script-${FIELD}`).click()
    const output = byId(page, `script-test-output-${FIELD}-greeting`)
    await expect(output).toContainText('Hello')
    expect(tests).toHaveLength(1)
    const sent = multipartFields(tests[0])
    expect(sent).toMatchObject({ scriptId: String(SCRIPT_ID), fileNames: 'Script.js', 'fileContents:Script.js': currentCode, name: 'Ada' })

    // The backend, called with the identical inputs, returns what the page shows.
    const response = await runTest(backend, currentCode, 'Ada')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.error).toBeUndefined()
    const greeting = body.values.outputObject.greeting
    expect(greeting).toBe(`Hello, Ada! (${currentCode.length} characters)`)
    await expect(output).toHaveText(`Greeting: ${greeting}`)
    await expect(byId(page, `script-test-error-${FIELD}`)).toHaveCount(0)

    const lines = byId(page, `script-test-log-lines-${FIELD}`)
    await expect(lines.locator('thead th')).toHaveText(['Timestamp', 'Log Line'])
    const expectedLines = body.values.scriptLogLines.map((line: { values: { text: string } }) => line.values.text)
    expect(expectedLines).toEqual(['Tested with Ada'])
    await expect(lines.locator('tbody tr td:nth-child(2)')).toHaveText(expectedLines)
    expect(await lines.locator('tbody tr td:nth-child(1)').first().innerText()).toMatch(DATE_TIME)
  })

  test('[REC-054] a failing test run shows the error the backend returns', async ({ page, backend, diagnostics }) => {
    void diagnostics
    // The fixture's tester fails code that throws; make such code the current version.
    const failingCode = "throw new Error('no greeting');"
    expect((await storeRevision(backend, failingCode, 'Failing greeting')).status()).toBe(200)
    const current = (await sqlOne(backend, `select current_script_revision_id from script where id = ${SCRIPT_ID}`)).current_script_revision_id
    expect(await revisionCode(backend, current!)).toBe(failingCode)

    await openScriptLab(page, 1)
    await expect(code(page)).toHaveText(failingCode)
    await card(page).getByRole('tab', { name: 'Test' }).click()
    await expect(card(page).getByLabel('Greeting Name')).toHaveValue('World')
    await byId(page, `button-test-script-${FIELD}`).click()
    const error = byId(page, `script-test-error-${FIELD}`)
    await expect(error).toBeVisible()

    const response = await runTest(backend, failingCode, 'World')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.error).toBe('Error message: Greeting script failed')
    await expect(error).toHaveText(body.error)
    await expect(error).toHaveAttribute('role', 'alert')
    await expect(byId(page, `script-test-output-${FIELD}-greeting`)).not.toContainText('Hello')
  })

  test('[REC-054] logs list the script_log rows of the selected version with their lines', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const logs = await backend.sql('select id, start_timestamp, run_time_millis, had_error, input, output, error from script_log where script_revision_id = 102 order by id desc')
    expect(logs).toEqual([
      { id: '102', start_timestamp: '2026-03-04 09:15:00', run_time_millis: '1500', had_error: 'TRUE', input: '{"name":""}', output: null, error: 'Name is required' },
      { id: '101', start_timestamp: '2026-03-03 08:00:00', run_time_millis: '42', had_error: 'FALSE', input: '{"name":"Ada"}', output: 'Hello, Ada!', error: null },
    ])
    const shownStart: Record<string, string> = { '2026-03-04 09:15:00': '2026-03-04 04:15:00 AM EST', '2026-03-03 08:00:00': '2026-03-03 03:00:00 AM EST' }
    expect(await sqlCount(backend, 'select count(*) as n from script_log where script_revision_id = 101')).toBe(0)

    await openScriptLab(page, 1)
    await card(page).getByRole('tab', { name: 'Logs' }).click()
    await expect(card(page).getByRole('heading', { level: 4, name: 'Script Logs (Version 2)' })).toBeVisible()
    const table = byId(page, `script-logs-${FIELD}`)
    await expect(table.locator('thead th')).toHaveText(['Timestamp', 'Run Time (ms)', 'Had Error?', 'Input', 'Output', 'Logs'])
    const rows = table.locator('tbody tr')
    await expect(rows).toHaveCount(logs.length)
    for (const [index, log] of logs.entries()) {
      const lines = await backend.sql(`select text from script_log_line where script_log_id = ${log.id} order by \`timestamp\``)
      expect(lines.length).toBeGreaterThan(0)
      const row = rows.nth(index)
      await expect(row).toHaveAttribute('data-qqq-id', `script-log-${log.id}`)
      await expect(row.locator('td')).toHaveText([
        shownStart[log.start_timestamp!],
        log.run_time_millis!,
        log.had_error === 'TRUE' ? 'Yes' : 'No',
        log.input!,
        `${log.output ?? ''}${log.error ?? ''}`,
        lines.map((line) => line.text).join('\n'),
      ])
    }

    // Version 1 has no logs.
    await byId(page, 'script-version-101').click()
    await expect(card(page).getByRole('heading', { level: 4, name: 'Script Logs (Version 1)' })).toBeVisible()
    await expect(card(page).getByText('No logs available for this version.')).toBeVisible()
    await expect(table).toHaveCount(0)
  })

  test('[REC-054] docs show the script type help text and sample code', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const type = await sqlOne(backend, 'select name, help_text, sample_code from script_type where id = 101')
    expect(type.name).toBe('Greeting Script Type')

    await openScriptLab(page, 1)
    await card(page).getByRole('tab', { name: 'Docs' }).click()
    await expect(card(page).getByRole('heading', { level: 4, name: 'Documentation' })).toBeVisible()
    await expect(card(page).getByRole('heading', { level: 4, name: 'Example Code' })).toBeVisible()
    await expect(byId(page, `script-docs-help-${FIELD}`)).toHaveText(type.help_text!)
    await expect(byId(page, `script-docs-example-${FIELD}`)).toHaveText(type.sample_code!)
  })

  test('[REC-054] Create Script creates the record\'s associated script with its first version', async ({ page, backend, diagnostics }) => {
    void diagnostics
    expect((await sqlOne(backend, 'select greeting_script_id from script_lab where id = 2')).greeting_script_id).toBeNull()
    const scriptsBefore = await sqlCount(backend, 'select count(*) as n from script')

    await openScriptLab(page, 2)
    await expect(card(page).getByText('No script has been created in this field for this record at this time.')).toBeVisible()
    await expect(card(page).getByRole('tab')).toHaveCount(0)
    const create = byId(page, `button-create-script-${FIELD}`)
    await expect(create).toHaveText('Create Script')
    await create.click()

    await expect(versions(page)).toHaveCount(1)
    await expect(code(page)).toHaveText(NEW_SCRIPT_CODE)

    // SQL: the record now references a new script whose current revision is "Initial version".
    const scriptId = (await sqlOne(backend, 'select greeting_script_id from script_lab where id = 2')).greeting_script_id
    expect(scriptId).not.toBeNull()
    expect(await sqlCount(backend, 'select count(*) as n from script')).toBe(scriptsBefore + 1)
    const script = await sqlOne(backend, `select script_type_id, current_script_revision_id from script where id = ${scriptId}`)
    expect(script.script_type_id).toBe('101')
    const revision = await sqlOne(backend, `select id, sequence_no, commit_message, author from script_revision where script_id = ${scriptId}`)
    expect(revision).toMatchObject({ id: script.current_script_revision_id, sequence_no: '1', commit_message: 'Initial version', author: SESSION_AUTHOR })
    // The create route names the single file "script"; the single-file view shows it as Script.js.
    expect(await backend.sql(`select file_name, contents from script_revision_file where script_revision_id = ${revision.id}`))
      .toEqual([{ file_name: 'script', contents: NEW_SCRIPT_CODE }])
    await expect(card(page).locator('figcaption')).toHaveText('Script.js')

    const version = byId(page, `script-version-${revision.id}`)
    await expect(version).toContainText('Version 1')
    await expect(version).toContainText('CURRENT')
    await expect(version).toContainText('Initial version')
    await expect(version).toContainText(`by ${SESSION_AUTHOR}`)
    await expect(card(page).getByText('No script has been created in this field for this record at this time.')).toHaveCount(0)
  })

  test('[REC-054] a table without associated scripts shows none', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const response = await backend.api.get('/data/recordLab/1/developer')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.record.values.id).toBe(1)
    expect(body.associatedScripts ?? []).toEqual([])

    const developer = page.waitForResponse((reply) => new URL(reply.url()).pathname === '/data/recordLab/1/developer')
    await open(page, '/app/recordLab/1/dev')
    expect((await developer).status()).toBe(200)
    await expect(page.getByRole('heading', { level: 3, name: 'Record Raw Values as JSON' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Table Metadata' })).toBeVisible()
    await expect(page.locator('[data-qqq-id^="associated-script-"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create Script' })).toHaveCount(0)
    await expect(page.getByRole('tablist')).toHaveCount(0)
    await expect(page.getByText('No script has been created in this field for this record at this time.')).toHaveCount(0)
  })

  test.describe('as a viewer', () => {
    test.use({ persona: 'viewer' })

    test('[REC-054] a viewer is offered no Edit or Test and the backend refuses storing and testing revisions', async ({ page, backend, diagnostics }) => {
      void diagnostics
      const metaData = await (await backend.api.get('/metaData')).json()
      expect(metaData.processes).not.toHaveProperty('storeScriptRevision')
      expect(metaData.processes).not.toHaveProperty('testScript')

      await openScriptLab(page, 1)
      await expect(versions(page)).toHaveCount(2)
      await expect(code(page)).toHaveText(await revisionCode(backend, 102))
      await expect(card(page).getByRole('tab')).toHaveText(['Code', 'Logs', 'Docs'])
      await expect(editButton(page)).toHaveCount(0)
      await expect(byId(page, `script-tab-${FIELD}-test`)).toHaveCount(0)
      await byId(page, 'script-version-101').click()
      await expect(code(page)).toHaveText(await revisionCode(backend, 101))
      await expect(editButton(page)).toHaveCount(0)
      await expect(card(page).getByRole('button', { name: /^(Edit|Edit and Activate|Create New Version)$/ })).toHaveCount(0)

      // The backend refuses both processes for this session and stores nothing.
      const store = await storeRevision(backend, "return 'viewer'", 'Viewer attempt')
      expect(store.status()).toBe(403)
      const tested = await runTest(backend, "return 'viewer'", 'Ada')
      expect(tested.status()).toBe(403)
      expect(await tested.json()).not.toHaveProperty('values')
      expect(await revisions(backend)).toHaveLength(2)
      expect((await sqlOne(backend, `select current_script_revision_id from script where id = ${SCRIPT_ID}`)).current_script_revision_id).toBe('102')
      expect(await sqlCount(backend, "select count(*) as n from script_revision_file where contents = 'return ''viewer'''")).toBe(0)
    })

    test('[REC-054] a viewer is offered no Create Script and the backend refuses creating one', async ({ page, backend, diagnostics }) => {
      void diagnostics
      const table = await (await backend.api.get('/qqq/v1/metaData/table/scriptLab')).json()
      expect(table.editPermission).toBe(false)
      const scriptsBefore = await sqlCount(backend, 'select count(*) as n from script')

      await openScriptLab(page, 2)
      await expect(card(page).getByText('No script has been created in this field for this record at this time.')).toBeVisible()
      await expect(byId(page, `button-create-script-${FIELD}`)).toHaveCount(0)
      await expect(card(page).getByRole('button', { name: 'Create Script' })).toHaveCount(0)

      const refused = await backend.api.post(`/data/scriptLab/2/developer/associatedScript/${FIELD}`, {
        multipart: { contents: NEW_SCRIPT_CODE, commitMessage: 'Initial version' },
      })
      expect(refused.status()).toBe(403)
      expect(await refused.json()).toEqual({ error: 'Permission denied.' })
      expect((await sqlOne(backend, 'select greeting_script_id from script_lab where id = 2')).greeting_script_id).toBeNull()
      expect(await sqlCount(backend, 'select count(*) as n from script')).toBe(scriptsBefore)
    })
  })
})
