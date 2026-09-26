/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Failing, empty and malformed widget payloads stay contained to their own widget.
import { expect, open, test } from '../../support/fixtures'
import { expectLoaded, widget, widgetBody } from './widget-support'

test.beforeEach(async ({ page, diagnostics }) => {
  // the deliberately failing renderer is the only expected failure on this dashboard
  diagnostics.allow('/widget/accError 500')
  diagnostics.allow('Failed to load resource: the server responded with a status of 500')
  await open(page, '/app/widgetStates')
  await expect(page.getByRole('heading', { level: 1, name: 'Widget States' })).toBeVisible()
  await expectLoaded(page, 'accHealthy')
})

test('[WID-051] a failing renderer shows its backend message with retry while neighbors render @mobile', async ({ page, backend }) => {
  const api = await backend.api.get('/widget/accError')
  expect(api.status()).toBe(500)
  expect((await api.json()).error).toBe('QException (Owned widget renderer failure)')
  const error = page.locator('[data-qqq-id="widget-error-accError"]')
  await expect(error).toContainText('An error occurred loading widget content.')
  await expect(page.locator('[data-qqq-id="widget-error-detail-accError"]')).toHaveText('QException (Owned widget renderer failure)')
  await expect(widgetBody(page, 'accHealthy')).toHaveText('Healthy neighbor content')
  // no retries behind the user's back and no global error toast
  await expect(page.getByText(/Server error/)).toHaveCount(0)
  const retried = page.waitForResponse((response) => response.url().includes('/widget/accError') && response.status() === 500)
  await page.locator('[data-qqq-id="button-widget-retry-inline-accError"]').click()
  await retried
  await expect(error).toBeVisible()
})

test('[WID-052] empty payloads show descriptive empty states @mobile', async ({ page }) => {
  const empty = (name: string) => page.locator(`[data-qqq-id="widget-empty-${name}"]`)
  await expectLoaded(page, 'accEmptyTable')
  await expect(empty('accEmptyTable')).toHaveText('No owned rows')
  await expect(empty('accEmptyTableDefault')).toHaveText('No rows found')
  await expect(empty('accEmptyMultiStatistics')).toHaveText('No statistics available')
  for (const chart of ['accEmptyBarChart', 'accEmptyLineChart', 'accEmptyPieChart']) {
    await expectLoaded(page, chart)
    await expect(empty(chart)).toHaveText('No chart data available')
  }
  await expect(empty('accEmptyStepper')).toHaveText('No steps to show')
  await expect(page.locator('[data-qqq-id="statistics-count-accEmptyStatistics"]')).toHaveText('0')
  await expect(page.locator('[data-qqq-id="statistics-percentage-accEmptyStatistics"]')).toHaveAttribute('data-direction', 'flat')
  await expect(empty('accEmptyMultiTable')).toHaveText('No tables to show')
  await expect(empty('accEmptyFieldValueList')).toHaveText('No values to show')
  await expect(empty('accEmptyUsaMap')).toHaveText('No locations to show')
  await expect(page.locator('[data-qqq-id="html-widget-accEmptyHtml"]')).toHaveText('')
  await expectLoaded(page, 'accEmptyComposite')
  await expect(widget(page, 'accEmptyComposite').locator('[data-block-type="COMPOSITE"]')).toHaveCount(1)
  await expect(widget(page, 'accEmptyComposite').locator('[data-block-type]:not([data-block-type="COMPOSITE"])')).toHaveCount(0)
  // an alert without HTML renders nothing
  await expect(page.locator('[data-qqq-id="widget-grid-item-accEmptyAlert"]')).toBeAttached()
  await expect(widget(page, 'accEmptyAlert')).toHaveCount(0)
})

test('[WID-053] malformed payloads are contained with a format notice @mobile', async ({ page }) => {
  const notices: Array<[string, string]> = [
    ['accMalformedChart', 'The chart widget data is not in the expected format'],
    ['accMalformedTable', 'The table widget data is not in the expected format (columns/rows).'],
    ['accMalformedComposite', 'The composite widget data is not in the expected format'],
    ['accMalformedStepper', 'The stepper widget data is not in the expected format (steps).'],
    ['accMalformedMultiStatistics', 'The multi-statistics widget data is not in the expected format (statisticsGroupData).'],
  ]
  for (const [name, text] of notices) {
    await expectLoaded(page, name)
    await expect(page.locator(`[data-qqq-id="widget-payload-notice-${name}"]`)).toContainText(text)
  }
  await expect(widgetBody(page, 'accHealthy')).toHaveText('Healthy neighbor content')
  await expect(page.locator('[data-qqq-id^="widget-error-"]').filter({ hasText: 'Widget failed to render' })).toHaveCount(0)
})
