/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect, test } from '../../support/fixtures'
import { advance, choosePossibleValue, expectScreen, openProcess, viewValue } from './process-helpers'

const PROCESS = 'prcComponents'

/**
 * Fill the mixed screen and continue to the review screen.
 * @param page - The page.
 * @param name - Lab name.
 * @param count - Sample count.
 */
async function fillMixed(page: Page, name: string, count: string) {
  const mixed = await expectScreen(page, 'mixed', 'Mixed Components')
  await mixed.getByLabel('Lab Name').fill(name)
  await mixed.getByLabel('Sample Count').fill(count)
  await choosePossibleValue(page, 'Lab Color', 'Green')
  await advance(page, 'Next')
}

test.describe('Component Lab', () => {
  test('[PRC-007] every declared component renders on one screen in declared order', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, PROCESS)
    const mixed = await expectScreen(page, 'mixed', 'Mixed Components')
    await expect(mixed.locator('[data-component-type]')).toHaveCount(6)
    const types = await mixed.locator('[data-component-type]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-component-type')))
    expect(types).toEqual(['HELP_TEXT', 'HELP_TEXT', 'VIEW_FORM', 'EDIT_FORM', 'HTML', 'EDIT_FORM'])
    // each component shows its own content, not just the first renderer
    await expect(mixed.locator('[data-qqq-id="process-component-0"]')).toContainText('Enter the lab values below.')
    await expect(mixed.locator('[data-qqq-id="process-component-2"]')).toContainText('Introduction:')
    await expect(mixed.locator('[data-qqq-id="process-component-3"]').getByLabel('Lab Name')).toBeVisible()
    await expect(mixed.locator('[data-qqq-id="process-component-4"]')).toContainText('Lab briefing')
    await expect(mixed.locator('[data-qqq-id="process-component-5"]').getByRole('combobox', { name: 'Lab Color' })).toBeVisible()
    // one shared action bar
    await expect(page.locator('[data-qqq-id="process-actions"]')).toHaveCount(1)
    await expect(page.locator('[data-qqq-id="button-next"]')).toHaveCount(1)
  })

  test('[PRC-008] help text keeps line breaks and preview text toggles the full text', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, PROCESS)
    const mixed = await expectScreen(page, 'mixed', 'Mixed Components')
    const plain = mixed.locator('[data-qqq-id="process-help-text-0"] span')
    await expect(plain).toHaveText(['Enter the lab values below.', 'Every value is saved with the run.'])
    const toggle = mixed.getByRole('button', { name: 'Show lab safety notes' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(mixed.getByText('Wear goggles.')).toBeHidden()
    await toggle.click()
    await expect(mixed.getByText('Wear goggles.')).toBeVisible()
    await expect(mixed.getByText('Label every sample.')).toBeVisible()
    await mixed.getByRole('button', { name: 'Hide lab safety notes' }).click()
    await expect(mixed.getByText('Wear goggles.')).toBeHidden()
  })

  test('[PRC-015] step help content for process screens is shown', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, PROCESS)
    const mixed = await expectScreen(page, 'mixed', 'Mixed Components')
    await expect(mixed.locator('[data-qqq-id="process-step-help"]')).toHaveText('Complete every section before continuing.')
  })

  test('[PRC-012] view form shows labels with values produced by the backend', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, PROCESS)
    const mixed = await expectScreen(page, 'mixed', 'Mixed Components')
    await expect(mixed.locator('[data-qqq-id="process-view-field-labIntro"]')).toHaveText('Introduction:Welcome to the lab')
    await expect(viewValue(mixed, 'labStatus')).toHaveText('Ready')
  })

  test('[PRC-013] HTML component renders the step html value sanitized', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, PROCESS)
    const mixed = await expectScreen(page, 'mixed', 'Mixed Components')
    const html = mixed.locator('[data-qqq-id="process-html-4"]')
    await expect(html.locator('#prc-html strong')).toHaveText('Lab briefing')
    await expect(html.locator('#prc-html em')).toHaveText('acceptance')
    await expect(html.locator('script')).toHaveCount(0)
    expect(await html.locator('img').evaluateAll((images) => images.map((image) => image.getAttribute('onerror')))).toEqual([null])
    expect(await page.evaluate(() => (window as unknown as { prcXss?: number }).prcXss)).toBeUndefined()
  })

  test('[PRC-009] edit forms render their field subsets and submitted values persist', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, PROCESS)
    const mixed = await expectScreen(page, 'mixed', 'Mixed Components')
    const section = mixed.getByRole('region', { name: 'Lab Inputs' })
    await expect(section.getByRole('heading', { name: 'Lab Inputs' })).toBeVisible()
    await expect(section.getByLabel('Lab Name')).toBeVisible()
    await expect(section.getByLabel('Sample Count')).toBeVisible()
    await expect(section.getByRole('combobox', { name: 'Lab Color' })).toHaveCount(0)
    await expect(mixed.locator('[data-qqq-id="process-component-5"]').getByLabel('Lab Name')).toHaveCount(0)
    await fillMixed(page, 'Nova', '12')
    const review = await expectScreen(page, 'review', 'Review Lab')
    await expect(viewValue(review, 'resultMessage')).toHaveText('Saved lab Nova with 12 samples')
    expect(await backend.sql('select name, lab_count, color from prc_lab_run')).toEqual([{ name: 'Nova', lab_count: '12', color: 'green' }])
  })

  test('[PRC-011] process possible-value fields load options and show labels', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, PROCESS)
    await expectScreen(page, 'mixed', 'Mixed Components')
    await page.getByRole('combobox', { name: 'Lab Color' }).click()
    await expect(page.getByRole('listbox', { name: 'Lab Color options' }).getByRole('option')).toHaveText(['Red', 'Green', 'Blue'])
    await page.getByRole('option', { name: 'Blue', exact: true }).click()
    await page.getByLabel('Lab Name').fill('Iris')
    await advance(page, 'Next')
    const review = await expectScreen(page, 'review', 'Review Lab')
    await expect(viewValue(review, 'labColor')).toHaveText('Blue')
    expect(await backend.sql('select color from prc_lab_run')).toEqual([{ color: 'blue' }])
    const options = await backend.api.get(`/processes/${PROCESS}/possibleValues/labColor?searchTerm=gr`)
    expect((await options.json()).options.map((option: { label: string }) => option.label)).toEqual(['Green'])
  })

  test('[PRC-010] required inputs are enforced by the screen and by the backend', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const steps: string[] = []
    page.on('request', (request) => { if (request.url().includes(`/processes/${PROCESS}/`) && request.url().includes('/step/')) steps.push(request.url()) })
    await openProcess(page, PROCESS)
    const mixed = await expectScreen(page, 'mixed', 'Mixed Components')
    await advance(page, 'Next')
    await expect(mixed.getByText('Lab Name is required')).toBeVisible()
    await expect(mixed.getByLabel('Lab Name')).toHaveAttribute('aria-invalid', 'true')
    expect(steps).toEqual([])
    await expect(page.locator('[data-qqq-id="process-step-heading"]')).toHaveText('Mixed Components')

    const init = await (await backend.api.post(`/processes/${PROCESS}/init`, { multipart: {} })).json()
    const skipped = await backend.api.post(`/processes/${PROCESS}/${init.processUUID}/step/mixed`, { multipart: { labCount: '3' } })
    expect(await skipped.json()).toMatchObject({ error: 'Missing values for one or more fields', userFacingError: 'Missing values for one or more fields' })
    expect(await backend.sql('select count(*) as n from prc_lab_run')).toEqual([{ n: '0' }])
  })

  test('[PRC-021] a user-facing step error is shown directly', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, PROCESS)
    await fillMixed(page, 'Negative', '-1')
    const error = page.locator(`[data-qqq-id="process-error-${PROCESS}"]`)
    await expect(error.getByRole('heading', { name: 'Error' })).toBeVisible()
    await expect(error).toContainText('An error occurred while running the process: Component Lab')
    await expect(error.locator('[data-qqq-id="process-error-message"]')).toHaveText('Sample count must not be negative.')
    await expect(error.getByRole('button', { name: 'Show detailed error message' })).toHaveCount(0)
    expect(await backend.sql('select count(*) as n from prc_lab_run')).toEqual([{ n: '0' }])
  })

  test('[PRC-014] download form delivers the generated file and the route refuses other files', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, PROCESS)
    await fillMixed(page, 'Nova', '12')
    const review = await expectScreen(page, 'review', 'Review Lab')
    const link = review.getByRole('link', { name: 'lab-Nova.txt' })
    await expect(link).toBeVisible()
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
    expect(download.suggestedFilename()).toBe('lab-Nova.txt')
    expect(readFileSync(await download.path(), 'utf8')).toBe('name=Nova\ncount=12\ncolor=green\n')

    const refused = await backend.api.get('/download/hosts.txt?filePath=%2Fetc%2Fhosts')
    expect(refused.status()).toBe(403)
  })

  test('[PRC-016] back returns to the back step with the entered values', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, PROCESS)
    await fillMixed(page, 'Nova', '12')
    await expectScreen(page, 'review', 'Review Lab')
    await page.getByRole('button', { name: 'Back' }).click()
    const mixed = await expectScreen(page, 'mixed', 'Mixed Components')
    await expect(mixed.getByLabel('Lab Name')).toHaveValue('Nova')
    await expect(mixed.getByLabel('Sample Count')).toHaveValue('12')
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0)
    await mixed.getByLabel('Lab Name').fill('Nova Two')
    await advance(page, 'Next')
    const review = await expectScreen(page, 'review', 'Review Lab')
    await expect(viewValue(review, 'labName')).toHaveText('Nova Two')
    expect(await backend.sql('select name from prc_lab_run order by id')).toEqual([{ name: 'Nova' }, { name: 'Nova Two' }])
  })

  test('[PRC-023] the last screen offers only Return, which leaves to the app', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, PROCESS)
    await fillMixed(page, 'Nova', '12')
    await expectScreen(page, 'review', 'Review Lab')
    await advance(page, 'Submit')
    const done = await expectScreen(page, 'done', 'Done')
    await expect(viewValue(done, 'finalMessage')).toHaveText('Lab Nova is complete')
    await expect(page.locator('[data-qqq-id="button-next"]')).toHaveCount(0)
    await expect(page.locator('[data-qqq-id="button-cancel"]')).toHaveCount(0)
    await page.getByRole('button', { name: 'Return' }).click()
    await expect(page).toHaveURL(/\/app\/prcLab\/?$/)
  })

  test('[PRC-024] the linear stepper names every step and marks progress', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, PROCESS)
    await expectScreen(page, 'mixed', 'Mixed Components')
    const wizard = page.locator('[data-qqq-id="step-wizard"]')
    await expect(wizard).toContainText('Mixed Components')
    await expect(wizard).toContainText('Review Lab')
    await expect(wizard).toContainText('Done')
    await expect(page.getByText('Step 1 of 3')).toBeVisible()
    await fillMixed(page, 'Nova', '12')
    await expectScreen(page, 'review', 'Review Lab')
    await expect(page.getByText('Step 2 of 3')).toBeVisible()
    await expect(wizard.locator('[aria-current="step"]')).toHaveCount(1)
    await expect(wizard.locator('[data-qqq-id="step-wizard-step-review"] [aria-current="step"]')).toHaveCount(1)
  })
})
