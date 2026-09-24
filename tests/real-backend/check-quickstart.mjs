/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const baseUrl = process.argv[2] ?? 'http://localhost:3000'
const output = process.env.QQQ_QUICKSTART_EVIDENCE ?? 'test-results/quickstart'
mkdirSync(output, { recursive: true })
const evidence = { baseUrl, startedAt: new Date().toISOString(), complete: false, checks: [] }
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
try {
  await page.goto(`${baseUrl}/app/person`)
  await page.getByText('Avery', { exact: true }).waitFor()
  evidence.checks.push('Seeded real Person rows are visible in Next')
  await page.getByRole('button', { name: 'Create new Person record', exact: true }).click()
  const create = page.locator('[data-qqq-id="entity-create-person"]')
  await create.getByRole('textbox', { name: /First Name/ }).fill('Quickstart')
  await create.getByRole('textbox', { name: /Last Name/ }).fill('Verification')
  await create.getByRole('textbox', { name: /Email/ }).fill('quickstart@example.invalid')
  const responsePromise = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/data/person')
  await create.getByRole('button', { name: 'Save', exact: true }).click()
  const response = await responsePromise
  assert.equal(response.status(), 200)
  const id = (await response.json()).records[0].values.id
  evidence.createdId = id
  await page.waitForURL(`${baseUrl}/app/person/${id}`)
  await page.getByRole('heading', { name: 'Quickstart Verification', exact: true }).waitFor()
  evidence.checks.push('Created a real record from the Next form')
  await page.getByRole('button', { name: 'Edit Person record', exact: true }).click()
  const edit = page.locator(`[data-qqq-id="entity-edit-person-${id}"]`)
  await edit.getByRole('textbox', { name: /First Name/ }).fill('Quickstart Updated')
  await edit.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForURL(`${baseUrl}/app/person/${id}`)
  await page.reload()
  await page.getByRole('heading', { name: 'Quickstart Updated Verification', exact: true }).waitFor()
  const saved = await page.request.get(`${baseUrl}/data/person/${id}?includeAssociations=false`)
  assert.equal(saved.status(), 200)
  assert.equal((await saved.json()).values.firstName, 'Quickstart Updated')
  evidence.checks.push('Edit survives browser refresh and independent HTTP readback')
  await page.screenshot({ path: path.join(output, 'created-edited.png'), fullPage: true })
  await page.getByRole('button', { name: 'Record actions menu', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Greet Interactive', exact: true }).click()
  await page.getByRole('textbox', { name: /Greeting Prefix/ }).waitFor()
  await page.screenshot({ path: path.join(output, 'process-setup.png'), fullPage: true })
  await page.getByRole('textbox', { name: /Greeting Prefix/ }).fill('Hello')
  await page.getByRole('textbox', { name: /Greeting Suffix/ }).fill('QQQ')
  const greetingResponse = page.waitForResponse((r) => r.request().method() === 'POST'
    && /\/processes\/greetInteractive\/[^/]+\/step\/setup$/.test(new URL(r.url()).pathname))
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  const greeting = await greetingResponse
  assert.equal(greeting.status(), 200)
  const result = await greeting.json()
  assert.equal(result.values.noOfPeopleGreeted, 1)
  evidence.processUUID = result.processUUID
  await page.getByRole('cell', { name: 'Hello Quickstart Updated QQQ', exact: true }).waitFor()
  await page.screenshot({ path: path.join(output, 'process-results.png'), fullPage: true })
  await page.getByRole('button', { name: 'Confirm & Submit', exact: true }).click()
  await page.getByRole('heading', { name: 'Greet Interactive Complete', exact: true }).waitFor()
  evidence.checks.push('Selected-record greeting process reaches its real result and completion')
  await page.screenshot({ path: path.join(output, 'process-complete.png'), fullPage: true })
  const deleted = await page.request.delete(`${baseUrl}/data/person/${id}`)
  assert.equal(deleted.status(), 200)
  evidence.checks.push('Removed the synthetic verification record')
  assert.deepEqual(errors, [])
  evidence.complete = true
  console.log(JSON.stringify(evidence))
} catch (error) {
  evidence.error = error.message
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
  throw error
} finally {
  evidence.finishedAt = new Date().toISOString()
  writeFileSync(path.join(output, 'browser-result.json'), JSON.stringify(evidence, null, 2) + '\n')
  await browser.close()
}
