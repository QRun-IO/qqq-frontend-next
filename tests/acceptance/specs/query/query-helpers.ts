/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Shared helpers for the Query & Relationships acceptance specs.
import { expect, type Locator, type Page, type Request } from '@playwright/test'
import type { Backend } from '../../support/fixtures'

/** The query grid for a table label. */
export function grid(page: Page, tableLabel: string): Locator {
  return page.getByRole('grid', { name: `${tableLabel} records` })
}

/** Body cells of one grid column, in row order. */
export function columnCells(page: Page, column: string): Locator {
  return page.locator(`tbody td[data-qqq-id="grid-cell-${column}"]`)
}

/** Asserts the exact, ordered values of a grid column (waits for the grid to settle). */
export async function expectColumn(page: Page, column: string, values: string[]) {
  if (values.length === 0) {
    await expect(page.locator('[data-qqq-id="grid-empty"], [data-qqq-id="empty-state"]').or(page.getByText('No records found', { exact: true })).first()).toBeVisible()
    await expect(columnCells(page, column)).toHaveCount(0)
    return
  }
  await expect(columnCells(page, column)).toHaveText(values)
}

/** Single-column SELECT, as strings in row order. */
export async function sqlColumn(backend: Backend, query: string): Promise<string[]> {
  const rows = await backend.sql(query)
  return rows.map((row) => String(Object.values(row)[0] ?? ''))
}

/** Opens the advanced filter panel. */
export async function openFilter(page: Page) {
  const toggle = page.locator('[data-qqq-id="button-filter"]')
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await expect(page.locator('[data-qqq-id="filter-builder"]')).toBeVisible()
}

/** One condition row of the root filter group. */
export function conditionRow(page: Page, index: number, depth = 0): Locator {
  return page.locator(`[data-qqq-id="filter-row-${depth}-${index}"]`)
}

/** Adds a condition and chooses its field and operator (by their visible labels). */
export async function addCondition(page: Page, field: string, operator: string, depth = 0): Promise<Locator> {
  const group = page.locator(`[data-qqq-id="filter-group-${depth}"]`).last()
  const before = await group.locator(`:scope > [data-qqq-id^="filter-row-${depth}-"]`).count()
  await group.locator(`[data-qqq-id="filter-add-criterion-${depth}"]`).click()
  const row = group.locator(`:scope > [data-qqq-id="filter-row-${depth}-${before}"]`)
  await row.getByLabel('Filter field').selectOption({ label: field })
  await row.getByLabel('Filter operator').selectOption({ label: operator })
  return row
}

/** Changes the operator of an existing condition row. */
export async function setOperator(row: Locator, operator: string) {
  await row.getByLabel('Filter operator').selectOption({ label: operator })
}

/** Picks options in a possible-value combobox within a condition row. */
export async function pickPossibleValues(page: Page, row: Locator, labels: string[]) {
  await row.getByRole('combobox', { name: /^Filter values? for/ }).click()
  for (const label of labels) {
    await page.getByRole('option', { name: label, exact: true }).click()
  }
  await closeValuePopup(page)
}

/** Closes an open possible-value dropdown by clicking the filter panel heading. */
export async function closeValuePopup(page: Page) {
  await page.getByText('Advanced Filters', { exact: true }).first().click()
}

/** Removes every value chip from a multi-value input. */
export async function clearTags(row: Locator) {
  const chips = row.locator('[data-qqq-id="filter-value-chip"] button')
  while (await chips.count() > 0) await chips.first().click()
}

/** Types values into a multi-value tag input. */
export async function typeTags(row: Locator, values: string[]) {
  const input = row.getByLabel(/^Filter values for/)
  for (const value of values) {
    await input.fill(value)
    await input.press('Enter')
  }
}

/** Removes every condition from the root group. */
export async function clearFilter(page: Page) {
  await page.locator('[data-qqq-id="button-clear-filter"]').click()
}

/** Opens a table with a Material-style JSON `?filter=` link. */
export function filterUrl(table: string, filter: unknown): string {
  return `/app/${table}?filter=${encodeURIComponent(JSON.stringify(filter))}`
}

/** Collects the JSON bodies of v1 query requests for a table. */
export function captureQueries(page: Page, table: string, action: 'query' | 'count' = 'query') {
  const bodies: Record<string, unknown>[] = []
  page.on('request', (request: Request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === `/qqq/v1/table/${table}/${action}`) {
      bodies.push(request.postDataJSON() as Record<string, unknown>)
    }
  })
  return bodies
}

/** Waits for the next v1 query request for a table and returns its body. */
export async function nextQuery(page: Page, table: string, action: 'query' | 'count' = 'query'): Promise<Record<string, unknown>> {
  const request = await page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === `/qqq/v1/table/${table}/${action}`)
  return request.postDataJSON() as Record<string, unknown>
}
