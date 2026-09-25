/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Phone and tablet query behavior (QRun-IO/qqq#708): the card list, the filter sheet, column
// configuration by touch, bulk actions from a phone selection, and the toolbar menus.
import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { expectNoHorizontalScroll, expectTouchReady, expectTouchTargets } from '../../support/touch'
import { addCondition, columnCells, expectColumn, isPhone, sqlColumn } from './query-helpers'

const PHONE = { viewport: { width: 412, height: 839 }, hasTouch: true }

/** The card list of a table (phone layout). */
function cards(page: Page, tableLabel: string) {
  return page.getByRole('list', { name: `${tableLabel} records` }).getByRole('listitem')
}

/** Asserts a region lies inside the viewport horizontally. */
async function expectOnScreen(page: Page, region: ReturnType<Page['locator']>) {
  const box = (await region.boundingBox())!
  const width = page.viewportSize()!.width
  expect(box.x, 'left edge on screen').toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, 'right edge on screen').toBeLessThanOrEqual(width + 1)
}

test.describe('on a phone', () => {
  test.use(PHONE)

  test('[QRY-008] the card list shows readable records with touch-sized selection and paging @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const ids = await sqlColumn(backend, 'select id from carrier order by id desc')
    await open(page, '/app/carrier')
    await expect(cards(page, 'Carrier')).toHaveCount(ids.length)
    await expectColumn(page, 'id', ids)
    await expect(columnCells(page, 'name')).toHaveText(await sqlColumn(backend, 'select name from carrier order by id desc'))
    await expectTouchReady(page, page.locator('[data-qqq-id^="record-query-"]'))
    // Values wrap inside the card instead of being cut off
    const clipped = await page.locator('[data-qqq-id^="card-field-"] dd').evaluateAll((values) => values.filter((v) => v.scrollWidth > v.clientWidth + 1).length)
    expect(clipped).toBe(0)

    // Tapping the checkbox's label area selects the card without opening the record
    const first = page.locator(`[data-qqq-id="card-select-${ids[0]}"]`)
    const label = first.locator('xpath=ancestor::label[1]')
    const box = (await label.boundingBox())!
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44)
    await page.touchscreen.tap(box.x + 4, box.y + box.height / 2)
    await expect(first).toBeChecked()
    await expect(page).toHaveURL(/\/app\/carrier\/?$/)
    const banner = page.locator('[data-qqq-id="bulk-selection-text"]')
    await expect(banner).toHaveText('1 record is selected.')

    // The full query result checks every card
    await page.getByRole('button', { name: 'Selection', exact: true }).click()
    await page.getByRole('menuitem', { name: `Full query result (${ids.length} records)` }).click()
    await expect(banner).toHaveText(`All ${ids.length} records matching this query are selected.`)
    for (const id of ids) await expect(page.locator(`[data-qqq-id="card-select-${id}"]`)).toBeChecked()
    await page.getByRole('button', { name: 'Clear selection' }).click()
    await expect(banner).toHaveCount(0)

    // Paging through the cards
    await page.getByLabel('Rows per page').selectOption('10')
    await expectColumn(page, 'id', ids.slice(0, 10))
    await page.getByRole('button', { name: 'Next page' }).click()
    await expectColumn(page, 'id', ids.slice(10))
    await expect(page.locator('[data-qqq-id="pagination"]')).toContainText('Showing 11–11 of 11')
    await expectTouchReady(page, page.locator('[data-qqq-id^="record-query-"]'))

    // Tapping a card opens its record
    await cards(page, 'Carrier').first().click()
    await expect(page).toHaveURL(new RegExp(`/app/carrier/${ids[10]}/?$`))
  })

  test('[QRY-009] the filter sheet fits the phone, scrolls inside, takes focus and returns it on Escape @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/qryItem')
    // Query Item cards are titled by the record label, the item name
    const titles = page.locator('[data-qqq-id^="card-title-"]')
    await expect(titles).toHaveText(await sqlColumn(backend, 'select name from qry_item order by id desc'))
    const trigger = page.locator('[data-qqq-id="button-filter"]')
    await trigger.click()
    const sheet = page.getByRole('dialog', { name: 'Advanced Filters' })
    await expect(sheet).toBeVisible()
    await expect.poll(() => sheet.evaluate((node) => node.contains(document.activeElement))).toBe(true)
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')

    // Several conditions: the sheet stays inside the viewport and its body scrolls
    const quantity = await addCondition(page, 'Quantity', 'greater than')
    await quantity.getByLabel('Filter value for Quantity').fill('5')
    for (const field of ['Name', 'Code', 'Notes']) await addCondition(page, field, 'is not empty')
    const box = (await sheet.boundingBox())!
    const viewport = page.viewportSize()!
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
    const body = sheet.locator('[data-qqq-id="mobile-filter-body"]')
    await expect.poll(() => body.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
    await body.evaluate((node) => { node.scrollTop = node.scrollHeight })
    await expect(sheet.locator('[data-qqq-id="filter-add-criterion-0"]')).toBeInViewport()
    await expectTouchReady(page, sheet)

    // The cards behind it already show the filtered records
    await expect(titles).toHaveText(await sqlColumn(backend, "select name from qry_item where quantity > 5 and name is not null and name <> '' and code is not null and code <> '' and notes is not null and notes <> '' order by id desc"))

    // Escape closes the sheet and returns focus to the Filter button, which counts the conditions
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect(trigger).toContainText('4')
    // The close button works too
    await trigger.click()
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Close filter panel' }).click()
    await expect(sheet).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('[QRY-036] bulk actions launch from a phone selection with the selected card ids @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const ids = await sqlColumn(backend, 'select id from qry_item order by id desc')
    await open(page, '/app/qryItem')
    await expect(page.locator('[data-qqq-id^="card-select-"]')).toHaveCount(ids.length)
    await page.locator(`[data-qqq-id="card-select-${ids[0]}"]`).check()
    await page.locator(`[data-qqq-id="card-select-${ids[2]}"]`).check()
    const bar = page.locator('[data-qqq-id="bulk-action-bar"]')
    await expect(bar.locator('[data-qqq-id="bulk-selection-text"]')).toHaveText('2 records are selected.')
    await expectTouchReady(page, bar)
    await page.getByRole('button', { name: 'Actions' }).click()
    const menu = page.getByRole('menu', { name: 'Actions' })
    await expectOnScreen(page, menu)
    await expectTouchTargets(menu)
    await expectNoHorizontalScroll(page)
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/processes/qryItem.bulkEdit/init'),
      menu.getByRole('menuitem', { name: 'Bulk Edit', exact: true }).click(),
    ])
    expect(response.status()).toBe(200)
    await expect(page).toHaveURL(/\/app\/qryItem\.bulkEdit\/?\?recordsParam=recordIds&recordIds=/)
    expect(new URL(page.url()).searchParams.get('recordIds')?.split(',').sort()).toEqual([ids[0], ids[2]].sort())
    const sent = JSON.parse(String(((await response.json()) as { values?: Record<string, unknown> }).values?.queryFilterJson)).criteria[0]
    expect(sent.values.map(String).sort()).toEqual([ids[0], ids[2]].sort())
  })

  test('[QRY-055] saved views and export menus fit the phone and are touch-sized @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/person')
    await expectColumn(page, 'firstName', await sqlColumn(backend, 'select first_name from person order by id desc'))
    await page.locator('[data-qqq-id="button-saved-views"]').click()
    const views = page.getByRole('menu', { name: 'Saved views' })
    await expect(views.getByRole('group', { name: 'Your Saved Views' }).getByRole('menuitem')).toHaveText(['Alice People View'])
    await expectOnScreen(page, views)
    await expectTouchTargets(views)
    await expectNoHorizontalScroll(page)
    await page.keyboard.press('Escape')
    await expect(views).toHaveCount(0)

    await page.getByRole('button', { name: 'Export records' }).click()
    const exportMenu = page.getByRole('menuitem', { name: /^Export CSV/ }).locator('xpath=..')
    await expect(page.getByRole('menuitem', { name: /^Export CSV/ })).toBeEnabled()
    await expectOnScreen(page, exportMenu)
    await expectTouchTargets(exportMenu)
    await expectNoHorizontalScroll(page)
    const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /^Export CSV/ }).click()])
    expect(file.suggestedFilename()).toMatch(/^Person Export .*\.csv$/)
  })
})

test('[QRY-024] column configuration is reachable and usable by touch on phones and tablets @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  const trigger = page.getByRole('button', { name: 'Configure columns' })
  await trigger.click()
  const config = page.getByRole('dialog', { name: 'Configure columns' })
  await expect(config).toBeVisible()
  await expectOnScreen(page, config)
  await expectTouchTargets(config)
  await expectNoHorizontalScroll(page)
  // Hiding a column by tap removes it from the cards (phone) or the grid (tablet)
  const shown = isPhone(page) ? columnCells(page, 'code') : page.getByRole('grid', { name: 'Query Item records' }).getByRole('button', { name: 'Sort by Code', exact: true })
  await expect(shown.first()).toBeVisible()
  await config.getByRole('button', { name: 'Hide column Code' }).click()
  await expect(shown).toHaveCount(0)
  await expect(config.getByRole('button', { name: 'Show column Code' })).toBeVisible()
  // Escape closes the panel and returns focus to its button; the choice persists
  await page.keyboard.press('Escape')
  await expect(config).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await page.reload()
  await expect(page.locator('[data-qqq-id^="record-query-"][data-view-mode]')).toBeVisible()
  await expect(shown).toHaveCount(0)
  await trigger.click()
  await config.getByRole('button', { name: 'Show column Code' }).click()
  await expect(shown.first()).toBeVisible()
})
