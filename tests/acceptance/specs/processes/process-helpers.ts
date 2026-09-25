/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Locator, Page } from '@playwright/test'
import { expect, open } from '../../support/fixtures'

/** Record-selection parameters for a process URL. */
export type Selection = { recordIds: (string | number)[] } | { filter: Record<string, unknown> } | undefined

/**
 * Open a process page with an optional record selection.
 * @param page - The page.
 * @param processName - Process to run.
 * @param selection - Selected ids or a filter.
 * @param extra - Extra query parameters.
 */
export async function openProcess(page: Page, processName: string, selection?: Selection, extra: Record<string, string> = {}) {
  const params = new URLSearchParams(extra)
  if (selection && 'recordIds' in selection) {
    params.set('recordsParam', 'recordIds')
    params.set('recordIds', selection.recordIds.join(','))
  } else if (selection && 'filter' in selection) {
    params.set('recordsParam', 'filterJSON')
    params.set('filterJSON', JSON.stringify(selection.filter))
  }
  const query = params.toString()
  await open(page, `/app/${encodeURIComponent(processName)}${query ? `?${query}` : ''}`)
  await expect(run(page, processName)).toBeVisible()
}

/**
 * The process run container.
 * @param page - The page.
 * @param processName - Process name.
 * @returns Locator.
 */
export function run(page: Page, processName: string): Locator {
  return page.locator(`[data-qqq-id="process-run-${processName}"]`)
}

/**
 * The current screen form (by step name).
 * @param page - The page.
 * @param stepName - Step name.
 * @returns Locator.
 */
export function screen(page: Page, stepName: string): Locator {
  return page.locator(`[data-qqq-id="process-step-${stepName}"]`)
}

/**
 * Wait for a screen and check its heading.
 * @param page - The page.
 * @param stepName - Step name.
 * @param label - Expected heading.
 * @returns The screen locator.
 */
export async function expectScreen(page: Page, stepName: string, label: string): Promise<Locator> {
  const form = screen(page, stepName)
  await expect(form).toBeVisible({ timeout: 30_000 })
  await expect(form.locator('[data-qqq-id="process-step-heading"]')).toHaveText(label)
  return form
}

/**
 * Click the screen's primary button (Next or Submit, per expected label).
 * @param page - The page.
 * @param label - `Next` or `Submit`.
 */
export async function advance(page: Page, label: 'Next' | 'Submit' = 'Next') {
  const button = page.locator('[data-qqq-id="button-next"]')
  await expect(button).toHaveText(label)
  await button.click()
}

/**
 * The `Label: value` text of a view field.
 * @param scope - Screen locator.
 * @param fieldName - Field name.
 * @returns Locator of the value.
 */
export function viewValue(scope: Locator, fieldName: string): Locator {
  return scope.locator(`[data-qqq-id="process-view-value-${fieldName}"]`)
}

/**
 * Rows of the process record list as arrays of cell text.
 * @param scope - Screen locator.
 * @returns Row texts.
 */
export async function recordRows(scope: Locator): Promise<string[][]> {
  const rows = scope.locator('[data-qqq-id^="process-record-row-"]')
  const count = await rows.count()
  const result: string[][] = []
  for (let i = 0; i < count; i++) result.push(await rows.nth(i).locator('td').allInnerTexts())
  return result
}

/**
 * Choose an option in a possible-value select by its visible label.
 * @param page - The page.
 * @param label - Field label.
 * @param option - Option label.
 */
export async function choosePossibleValue(page: Page, label: string, option: string) {
  const combobox = page.getByRole('combobox', { name: label })
  await combobox.click()
  await page.getByRole('option', { name: option, exact: true }).click()
}
