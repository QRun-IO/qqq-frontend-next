/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// The related-record picker (QQQ docs/RELATED-RECORD-PICKER.md) against the sample's Sales
// tables: an order's customer (SINGLE, quick-create), SKUs added as order lines with a review
// step (MULTI_CHILD), and tags linked and unlinked (LINK). Persisted rows are checked in SQL.

import type { Page } from '@playwright/test'
import { expect, test } from '../../support/fixtures'
import { VIEWER, control, expandOnPhone, openForm, openRecord, recordIdFromUrl, sqlCount, sqlOne } from './helpers'

test.use(VIEWER)

const dialog = (page: Page) => page.locator('[data-qqq-id="related-picker-dialog"]')
const options = (page: Page) => dialog(page).locator('[data-qqq-id="related-picker-option"]')

test('[REC-066] SINGLE related picker filters from the form, quick-creates and selects a customer @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openForm(page, '/app/sales_order/create', 'Create Sales Order')
  await control(page, 'orderNo').fill('SO-PICK-1')
  await control(page, 'region').fill('East')
  await page.locator('[data-qqq-id="related-picker-browse"]').click()
  await expect(dialog(page)).toBeVisible()

  // the picker's default filter takes the order's region; its filter hides the inactive customer
  await expect(options(page)).toHaveCount(2)
  await expect(options(page).first()).toContainText('Bolt Brothers')
  await expect(dialog(page)).not.toContainText('Foxtrot Retail')
  await expect(dialog(page).getByRole('button', { name: /Filters \(1\)/ })).toBeVisible()

  // quick-create: the customer's quick-create section, saved through the insert route
  await dialog(page).locator('[data-qqq-id="related-picker-new"]').click()
  await expect(dialog(page).locator('#related-picker-create-field-name')).toBeVisible()
  await expect(dialog(page).locator('[data-qqq-id="related-picker-full-create"]')).toHaveAttribute('href', '/app/customer/create')
  await dialog(page).locator('#related-picker-create-field-name').fill('Golf Goods')
  await dialog(page).locator('#related-picker-create-field-email').fill('golf@example.com')
  await dialog(page).locator('[data-qqq-id="related-picker-create-save"]').click()
  await expect(dialog(page)).toBeHidden()

  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'SO-PICK-1' })).toBeVisible()
  const id = recordIdFromUrl(page, 'sales_order')
  expect(await sqlOne(backend, `select c.name, c.email from sales_order o join customer c on c.id = o.customer_id where o.id = ${id}`))
    .toEqual({ name: 'Golf Goods', email: 'golf@example.com' })
})

test('[REC-067] MULTI_CHILD related picker adds SKUs as order lines after a review @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const before = await sqlCount(backend, 'select count(*) as n from sales_order_line where sales_order_id = 3')
  await openRecord(page, 'sales_order', 3, 'SO-1003')
  await expandOnPhone(page, 'Lines')
  await page.locator('[data-qqq-id="child-record-picker-salesOrderLines-addSkus"]').click()
  await expect(dialog(page)).toBeVisible()

  await dialog(page).locator('[data-qqq-id="related-picker-search"]').fill('gear')
  await expect(options(page)).toHaveCount(2)
  await options(page).nth(0).click()
  await options(page).nth(1).focus()
  await page.keyboard.press('Space')
  await expect(dialog(page).locator('[data-qqq-id="related-picker-selection"]')).toHaveText('2 selected')
  await dialog(page).locator('[data-qqq-id="related-picker-confirm"]').click()

  // one review row per SKU, prefilled from the SKU's price; quantity is the user's
  const rows = dialog(page).locator('[data-qqq-id="related-picker-review-row"]')
  await expect(rows).toHaveCount(2)
  await expect(dialog(page).locator('#related-picker-row-0-field-unitPrice')).toHaveValue(/11\.75/)
  await dialog(page).locator('#related-picker-row-0-field-quantity').fill('3')
  await dialog(page).locator('[data-qqq-id="related-picker-add"]').click()
  await expect(dialog(page)).toBeHidden()

  expect(await sqlCount(backend, 'select count(*) as n from sales_order_line where sales_order_id = 3')).toBe(before + 2)
  expect(await sqlOne(backend, "select l.quantity, l.unit_price from sales_order_line l join sku s on s.id = l.sku_id where l.sales_order_id = 3 and s.code = 'GEA-030'"))
    .toEqual({ quantity: '3', unit_price: '11.75' })
  await expect(page.locator('[data-qqq-id="widget-childRecordList-salesOrderLines"]')).toContainText('GEA-060')
})

test('[REC-068] LINK related picker links and unlinks tags, inactive SKUs are never offered @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openRecord(page, 'sales_order', 1, 'SO-1001')
  await expandOnPhone(page, 'Tags')
  await page.locator('[data-qqq-id="child-record-picker-salesOrderTags-tags"]').click()
  await expect(dialog(page)).toBeVisible()
  const rush = options(page).filter({ hasText: 'Rush' })
  const gift = options(page).filter({ hasText: 'Gift' })
  await expect(rush).toHaveAttribute('aria-selected', 'true')
  await expect(gift).toHaveAttribute('aria-selected', 'false')
  await rush.click()
  await gift.click()
  await expect(dialog(page).locator('[data-qqq-id="related-picker-selection"]')).toHaveText('1 to link, 1 to unlink')
  await dialog(page).locator('[data-qqq-id="related-picker-confirm"]').click()
  await expect(dialog(page)).toBeHidden()
  expect(await backend.sql('select t.name from sales_order_tag j join tag t on t.id = j.tag_id where j.sales_order_id = 1 order by t.name'))
    .toEqual([{ name: 'Gift' }])

  // the add route refuses a SKU the picker's filter excludes (inactive), and writes nothing
  const before = await sqlCount(backend, 'select count(*) as n from sales_order_line')
  const response = await backend.api.post('/qqq/v1/table/sales_order/relatedRecordPicker/addSkus/add', { data: { primaryKey: 1, targetIds: [16] } })
  expect(response.status()).toBe(400)
  expect(await sqlCount(backend, 'select count(*) as n from sales_order_line')).toBe(before)
})
