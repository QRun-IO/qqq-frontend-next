/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { test, expect, open, type Backend } from '../../support/fixtures'
import type { EsbOverviewResponse, EsbTableResponse, EsbProcessResponse } from '../../../../src/types/esb'

const TRIGGER = 'syncPerson.personEvents'
const triggerRow = `[data-qqq-id="esb-trigger-${TRIGGER}"]`

async function overview(backend: Backend): Promise<EsbOverviewResponse> {
  const response = await backend.api.get('/qqq/v1/esb/overview')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type'], 'ESB must return JSON, not an API docs or SPA fallback').toContain('application/json')
  return response.json()
}

async function personStatus(backend: Backend): Promise<EsbTableResponse> {
  const response = await backend.api.get('/qqq/v1/esb/table/person')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type'], 'ESB must return JSON, not an API docs or SPA fallback').toContain('application/json')
  return response.json()
}

async function insertPerson(backend: Backend, firstName: string) {
  const response = await backend.api.post('/qqq/v1/table/person', {
    multipart: { firstName, lastName: 'ESB Acceptance', email: `${firstName.toLowerCase()}@example.invalid` },
  })
  expect(response.status()).toBe(200)
  return response.json()
}

async function receipts(backend: Backend) {
  return backend.sql('SELECT subject, event_type, first_name FROM acceptance_esb_receipt ORDER BY id')
}

test('[ESB-001] admin sees the real topic and trigger; inserting a person runs its subscriber @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/esb')
  await expect(page.locator('[data-qqq-id="esb-destination-personEvents"]')).toContainText('Topic')
  const row = page.locator(triggerRow)
  await expect(row).toContainText('Sync Person')
  await expect(row).toContainText('Running')
  const before = (await overview(backend)).destinations.find((destination) => destination.name === 'personEvents')!
  expect(before.triggers[0].counters.consumed).toBe(0)
  expect(await receipts(backend)).toEqual([])

  await open(page, '/app/person/create')
  await page.locator('#field-firstName').fill('River')
  await page.locator('#field-lastName').fill('ESB Acceptance')
  await page.locator('#field-email').fill('river@example.invalid')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'River ESB Acceptance' })).toBeVisible()
  await expect.poll(async () => (await personStatus(backend)).subscribers[0].counters.succeeded).toBe(1)
  const status = await personStatus(backend)
  expect(status.subscribers[0].counters).toMatchObject({ consumed: 1, succeeded: 1, failed: 0, inFlight: 0 })
  const people = await backend.sql("SELECT id FROM person WHERE first_name = 'River'")
  expect(await receipts(backend)).toEqual([{ subject: people[0].id, event_type: 'qqq.table.person.inserted', first_name: 'River' }])
  await open(page, '/app/esb')
  await expect(row.locator('div').filter({ has: page.locator('dt').filter({ hasText: /^Consumed$/ }) }).locator('dd')).toHaveText('1')
})

test('[ESB-002] table and process Developer views expose publications and subscribers without running a process @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const processInits: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/qqq\/v1\/processes\/.*\/init$/.test(new URL(request.url()).pathname)) processInits.push(request.url())
  })
  await open(page, '/app/person/dev')
  const section = page.locator('[data-qqq-id="esb-section-person"]')
  await expect(section.getByRole('table', { name: 'Publications', exact: true })).toContainText('INSERT, UPDATE, DELETE')
  await expect(section.getByRole('table', { name: 'Subscribers', exact: true })).toContainText('Sync Person')
  const link = section.getByRole('link', { name: 'Sync Person', exact: true })
  await expect(link).toHaveAttribute('href', /^\/app\/syncPerson\/dev\/?$/)
  await link.click()
  await expect(page).toHaveURL(/\/app\/syncPerson\/dev\/?$/)
  await expect(page.locator('[data-qqq-id="esb-section-syncPerson"]')).toContainText('personEvents')
  const response = await backend.api.get('/qqq/v1/esb/process/syncPerson')
  expect(response.status()).toBe(200)
  const process: EsbProcessResponse = await response.json()
  expect(process.triggers.map((trigger) => trigger.name)).toEqual([TRIGGER])
  expect(processInits).toEqual([])
  expect(await receipts(backend)).toEqual([])
})

test.describe('table READ enforcement', () => {
  test.use({ persona: 'noPersonRead' })
  test('[ESB-003] no person READ hides the section and the server refuses its data @mobile', async ({ page, backend, diagnostics }) => {
    diagnostics.allow(/^request: GET \/qqq\/v1\/esb\/table\/person 403$/)
    diagnostics.allow(/^console: Failed to load resource: the server responded with a status of 403 \(Forbidden\)$/)
    const denied = page.waitForResponse((response) => new URL(response.url()).pathname === '/qqq/v1/esb/table/person')
    await open(page, '/app/person/dev')
    expect((await denied).status()).toBe(403)
    await expect(page.locator('[data-qqq-id="esb-section-person"]')).toHaveCount(0)
    expect((await backend.api.get('/qqq/v1/esb/table/person')).status()).toBe(403)
    // This persona still has ESB app and process access; only person.read is removed.
    expect((await overview(backend)).destinations.map((destination) => destination.name)).toContain('personEvents')
    expect((await backend.api.get('/qqq/v1/esb/process/syncPerson')).status()).toBe(200)
  })
})

test.describe('app enforcement', () => {
  test.use({ persona: 'noEsbView' })
  test('[ESB-004] no ESB app access hides navigation and denies overview while table READ still works @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/person/dev')
    await expect(page.locator('[data-qqq-id="esb-section-person"]')).toBeVisible()
    await expect(page.getByRole('link', { name: 'ESB', exact: true })).toHaveCount(0)
    expect((await backend.api.get('/qqq/v1/esb/overview')).status()).toBe(403)
    expect((await personStatus(backend)).subscribers[0].name).toBe(TRIGGER)
  })
})

test.describe('subscriber enforcement', () => {
  test.use({ persona: 'noSyncPerson' })
  test('[ESB-005] a denied process is omitted from subscribers and its endpoints refuse access @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/person/dev')
    const section = page.locator('[data-qqq-id="esb-section-person"]')
    await expect(section).toContainText('personEvents')
    await expect(section).toContainText('No processes you can access are triggered by these destinations.')
    await expect(section.getByRole('link', { name: 'Sync Person', exact: true })).toHaveCount(0)
    expect((await personStatus(backend)).subscribers).toEqual([])
    expect((await backend.api.get('/qqq/v1/esb/process/syncPerson')).status()).toBe(403)
    expect((await backend.api.get(`/qqq/v1/esb/deadLetters/${TRIGGER}`)).status()).toBe(403)
  })
})

test('[ESB-006] pause holds a real message in the topic subscription; resume and restart complete @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/esb')
  const row = page.locator(triggerRow)
  await row.getByRole('button', { name: 'Pause Sync Person', exact: true }).click()
  await expect.poll(async () => (await personStatus(backend)).subscribers[0].state).toBe('PAUSED')
  await expect(page.getByText('esbPauseTrigger completed.', { exact: true })).toBeVisible()
  // PAUSED is a requested state: the runner closes its consumer after the
  // outstanding receive finishes. Observe the real broker boundary, not time.
  await expect.poll(() => backend.esbSubscriptionState()).toEqual({ consumerCount: 0, deliveringCount: 0, messageCount: 0 })
  await insertPerson(backend, 'Paused')
  await expect.poll(() => backend.esbSubscriptionState()).toEqual({ consumerCount: 0, deliveringCount: 0, messageCount: 1 })
  await row.getByRole('button', { name: /Browse subscription/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('table', { name: 'Messages', exact: true })).toContainText('qqq.table.person.inserted')
  await dialog.getByText('Body', { exact: true }).click()
  await expect(dialog.locator('pre')).toContainText('Paused')
  expect((await personStatus(backend)).subscribers[0].counters.consumed).toBe(0)
  expect(await receipts(backend)).toEqual([])
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await row.getByRole('button', { name: 'Resume Sync Person', exact: true }).click()
  await expect(page.getByText('esbResumeTrigger completed.', { exact: true })).toBeVisible()
  await expect.poll(async () => (await personStatus(backend)).subscribers[0].counters.succeeded).toBe(1)
  expect((await receipts(backend)).map((receipt) => receipt.first_name)).toEqual(['Paused'])
  await row.getByRole('button', { name: 'Restart Sync Person', exact: true }).click()
  await expect(page.getByText('esbRestartTrigger completed.', { exact: true })).toBeVisible()
  await expect.poll(async () => (await personStatus(backend)).subscribers[0].state).toBe('RUNNING')
  await insertPerson(backend, 'Restarted')
  await expect.poll(async () => (await receipts(backend)).map((receipt) => receipt.first_name)).toEqual(['Paused', 'Restarted'])
})

test.describe('operate permission', () => {
  test.use({ persona: 'noEsbOperate' })
  test('[ESB-007] operate controls are absent and every operate process denies direct invocation @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/esb')
    const row = page.locator(triggerRow)
    await expect(row).toContainText('Sync Person')
    await expect(row.getByRole('button', { name: /^(Pause|Resume|Restart|Replay)/ })).toHaveCount(0)
    expect((await overview(backend)).permissions).toEqual({ canOperate: false, canDelete: true })
    for (const process of ['esbPauseTrigger', 'esbResumeTrigger', 'esbRestartTrigger', 'esbReplayDeadLetters', 'esbPauseQueue', 'esbResumeQueue', 'esbMoveMessages']) {
      const response = await backend.api.post(`/qqq/v1/processes/${process}/init`, { multipart: { values: JSON.stringify({ triggerName: TRIGGER, providerName: 'sampleArtemis', brokerQueueName: 'personEvents', all: true }) } })
      expect(response.status(), process).toBe(403)
    }
    expect((await personStatus(backend)).subscribers[0].state).toBe('RUNNING')
    expect(await receipts(backend)).toEqual([])
  })
})

test.describe('delete permission', () => {
  test.use({ persona: 'noEsbDelete' })
  test('[ESB-008] delete permission is independent of operate and enforced by both destructive processes @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/esb')
    const row = page.locator(triggerRow)
    await expect(row.getByRole('button', { name: 'Pause Sync Person', exact: true })).toBeVisible()
    expect((await overview(backend)).permissions).toEqual({ canOperate: true, canDelete: false })
    await row.getByRole('button', { name: 'Browse dead letters for Sync Person', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('No messages.', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /^(Purge|Delete)/ })).toHaveCount(0)
    for (const process of ['esbPurgeQueue', 'esbDeleteMessages']) {
      const response = await backend.api.post(`/qqq/v1/processes/${process}/init`, { multipart: { values: JSON.stringify({ providerName: 'sampleArtemis', brokerQueueName: `personEvents.${TRIGGER}.dlq`, olderThan: '2099-01-01T00:00:00Z' }) } })
      expect(response.status(), process).toBe(403)
    }
  })
})

test('[ESB-009] unavailable broker capabilities hide queue mutations, while JMS browsing remains usable @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/esb')
  const status = await overview(backend)
  expect(status.providers.find((provider) => provider.name === 'sampleArtemis')).toMatchObject({ connected: true, managementEnabled: false })
  expect(status.destinations.find((destination) => destination.name === 'personEvents')?.capabilities).toEqual({ browse: true, pauseQueue: false, purge: false, deleteSelected: false, deleteOlderThan: false, move: false })
  await page.locator(triggerRow).getByRole('button', { name: /Browse subscription/ }).click()
  await expect(page.getByRole('dialog').getByText('No messages.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^(Pause queue|Resume queue|Purge|Delete older|Delete selected|Move selected)/ })).toHaveCount(0)
})

test('[ESB-010] real dead letters require replay-all confirmation; cancel preserves them and confirm runs the subscriber @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await backend.failEsbSync(true)
  await insertPerson(backend, 'Replay')
  await expect.poll(async () => (await personStatus(backend)).subscribers[0].counters.deadLettered).toBe(1)
  const deadLetters = async () => {
    const response = await backend.api.get(`/qqq/v1/esb/deadLetters/${TRIGGER}`)
    expect(response.status()).toBe(200)
    return response.json()
  }
  expect((await deadLetters()).messages).toHaveLength(1)
  expect(await receipts(backend)).toEqual([])
  await backend.failEsbSync(false)
  await open(page, '/app/esb')
  const row = page.locator(triggerRow)
  const replays: string[] = []
  page.on('request', (request) => { if (new URL(request.url()).pathname === '/qqq/v1/processes/esbReplayDeadLetters/init') replays.push(request.postData() ?? '') })
  await row.getByRole('button', { name: 'Replay dead letters for Sync Person', exact: true }).click()
  const confirmation = page.getByRole('alertdialog')
  await expect(confirmation).toContainText(/dead letters/i)
  // No management API: the dialog must acknowledge an unknown count, never invent zero.
  await expect(confirmation).toContainText(/unknown|unavailable|cannot.*count/i)
  expect(replays).toEqual([])
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect((await deadLetters()).messages).toHaveLength(1)
  expect(await receipts(backend)).toEqual([])
  await row.getByRole('button', { name: 'Replay dead letters for Sync Person', exact: true }).click()
  await confirmation.locator('[data-qqq-id="button-esb-confirm"]').click()
  await expect(page.getByText('esbReplayDeadLetters completed.', { exact: true })).toBeVisible()
  expect(replays).toHaveLength(1)
  await expect.poll(async () => (await deadLetters()).messages.length).toBe(0)
  expect((await receipts(backend)).map((receipt) => receipt.first_name)).toEqual(['Replay'])
})
