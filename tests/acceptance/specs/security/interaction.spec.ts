/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Interaction quality on the stock sample: keyboard-only operation, dialogs and focus,
// accessibility, validation messages, phone layout, and loading / failure / delay /
// stale-data behavior (real backend calls held or failed with page.route).
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page, Route } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { expectTouchReady } from '../../support/touch'
import { listCell, navigation, openUserMenu, tabKey } from './support/ui'

const personGrid = (page: Page) => page.getByRole('grid', { name: 'Person records' })

/**
 * Presses Tab until `target` has focus, proving it is reachable in tab order.
 *
 * @param page - The page.
 * @param target - The element to reach.
 * @param max - Upper bound on key presses.
 */
async function tabTo(page: Page, target: Locator, max = 80) {
  await expect(target).toBeVisible()
  for (let presses = 0; presses < max; presses++) {
    if (await target.evaluate((element) => element === document.activeElement).catch(() => false)) return
    await page.keyboard.press(tabKey(page))
  }
  throw new Error(`Could not reach ${target} with Tab in ${max} presses`)
}

/** The visible match of a locator (desktop and phone variants of a control both exist in the DOM). */
const visible = (locator: Locator) => locator.locator('visible=true').first()

const isFocusedWithin = (container: Locator) => container.evaluate((element) => element.contains(document.activeElement))

test.describe('keyboard operation', () => {
  test('[INT-001] navigate, open a record, edit and save using only the keyboard', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/miscellaneous')
    await expect(page.getByRole('heading', { name: 'Miscellaneous', level: 1 })).toBeVisible()
    const nav = await navigation(page)
    await tabTo(page, nav.getByRole('button', { name: 'Expand People App' }))
    await page.keyboard.press('Enter')
    await tabTo(page, nav.getByRole('button', { name: 'Expand Greetings App' }))
    await page.keyboard.press('Enter')
    await tabTo(page, nav.getByRole('link', { name: 'Person', exact: true }))
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/person\/?$/)
    await expect(listCell(page, 'Person', 'Blair')).toBeVisible()

    // Arrow keys move between grid cells: start on the row above Blair in the current sort order
    const firstNames = await page.getByRole('grid', { name: 'Person records' }).locator('tbody td[data-qqq-id="grid-cell-firstName"]').allTextContents()
    const above = firstNames[firstNames.indexOf('Blair') - 1]
    expect(above, `a row above Blair in ${firstNames.join(', ')}`).toBeTruthy()
    await tabTo(page, listCell(page, 'Person', above!), 120)
    await page.keyboard.press('ArrowDown')
    await expect(listCell(page, 'Person', 'Blair')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/person\/2\/?$/)

    await tabTo(page, visible(page.getByRole('button', { name: 'Edit Person record' })))
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/person\/2\/edit\/?$/)
    const firstName = page.getByRole('textbox', { name: 'First Name' })
    await tabTo(page, firstName)
    await expect(firstName).toHaveValue('Blair')
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Blake', { delay: 30 })
    await expect(firstName).toHaveValue('Blake')
    await tabTo(page, page.locator('[data-qqq-id="button-save"]'))
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/person\/2\/?$/)
    await expect(page.getByRole('heading', { name: /Blake/ }).first()).toBeVisible()
    expect(await backend.sql('select first_name from person where id = 2')).toEqual([{ first_name: 'Blake' }])
  })

  test('[INT-002] run a process through its steps using only the keyboard @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    void backend
    await open(page, '/app/greetInteractive?recordsParam=recordIds&recordIds=1,2')
    const prefix = page.getByRole('textbox', { name: 'Greeting Prefix' })
    await expect(prefix).toBeVisible()
    await tabTo(page, prefix)
    await page.keyboard.type('Hello')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('textbox', { name: 'Greeting Suffix' })).toBeFocused()
    await page.keyboard.type('friend')
    await tabTo(page, page.getByRole('button', { name: /^(Next|Submit|Continue)/ }))
    await page.keyboard.press('Enter')
    await expect(page.getByText('Hello Avery friend')).toBeVisible()
    await expect(page.getByText('Hello Blair friend')).toBeVisible()
  })
})

test.describe('dialogs and focus', () => {
  test('[INT-003] the delete dialog traps focus, Escape restores focus, and keyboard confirmation deletes @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/person/5')
    await expect(page.getByRole('heading', { name: /Morgan/ }).first()).toBeVisible()
    // with processes available the record actions live in a menu: open it and pick Delete by keyboard
    // (a menu on desktop, an action sheet on phones)
    const trigger = visible(page.getByRole('button', { name: /^Record actions( menu)?$/ }))
    const chooseDelete = async () => {
      await page.keyboard.press('Enter')
      const menuItem = page.getByRole('menuitem', { name: /Delete/ })
      const sheetItem = page.locator('[data-qqq-id="mobile-action-delete"]')
      await expect(menuItem.or(sheetItem).first()).toBeVisible()
      const inMenu = await menuItem.isVisible()
      const deleteItem = inMenu ? menuItem : sheetItem
      for (let presses = 0; presses < 12 && !(await deleteItem.evaluate((element) => element === document.activeElement)); presses++) {
        await page.keyboard.press(inMenu ? 'ArrowDown' : tabKey(page))
      }
      await expect(deleteItem).toBeFocused()
      await page.keyboard.press('Enter')
    }
    await tabTo(page, trigger)
    await chooseDelete()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expectTouchReady(page, dialog)
    await expect(dialog).toBeVisible()
    expect(await isFocusedWithin(dialog)).toBe(true)
    for (let presses = 0; presses < 8; presses++) {
      await page.keyboard.press(tabKey(page))
      expect(await isFocusedWithin(dialog)).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(await backend.sql('select id from person where id = 5')).toEqual([{ id: '5' }])

    await chooseDelete()
    await expect(dialog).toBeVisible()
    await tabTo(page, dialog.getByRole('button', { name: /^Delete$/ }), 10)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/person\/?$/)
    expect(await backend.sql('select id from person where id = 5')).toEqual([])
  })

  test('[INT-004] command menu and shortcut dialogs open by keyboard, keep focus inside and restore it on Escape @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    void backend
    await open(page, '/app/person')
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    const refresh = page.getByRole('button', { name: 'Refresh data' })
    await refresh.focus()
    await page.keyboard.press('ControlOrMeta+k')
    const palette = page.getByRole('dialog')
    await expect(palette).toBeVisible()
    await expectTouchReady(page, palette)
    await expect(palette).toBeVisible()
    expect(await isFocusedWithin(palette)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(palette).toHaveCount(0)
    await expect(refresh).toBeFocused()

    await page.keyboard.press('?')
    const shortcuts = page.getByRole('dialog')
    await expect(shortcuts).toBeVisible()
    await expectTouchReady(page, shortcuts)
    await expect(shortcuts).toBeVisible()
    expect(await isFocusedWithin(shortcuts)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(shortcuts).toHaveCount(0)
    await expect(refresh).toBeFocused()

    await page.keyboard.press('ControlOrMeta+k')
    await page.keyboard.type('Pet Species')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/petSpecies\/?$/)
  })
})

test.describe('accessibility', () => {
  const scan = async (page: Page) => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    return results.violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).slice(0, 5).join(' | ')}`)
  }

  test('[INT-005] login, app home, list, record, edit form and process step have no serious WCAG 2.1 AA violations @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    void backend
    const pages: Array<[string, (page: Page) => Promise<unknown>]> = [
      ['/app/miscellaneous', (p) => expect(p.getByRole('heading', { name: 'Miscellaneous', level: 1 })).toBeVisible()],
      ['/app/person', (p) => expect(listCell(p, 'Person', 'Avery')).toBeVisible()],
      ['/app/person/1', (p) => expect(p.getByRole('heading', { name: /Avery/ }).first()).toBeVisible()],
      ['/app/person/1/edit', (p) => expect(p.getByRole('textbox', { name: 'First Name' })).toHaveValue('Avery')],
      ['/app/greetInteractive?recordsParam=recordIds&recordIds=1', (p) => expect(p.getByRole('textbox', { name: 'Greeting Prefix' })).toBeVisible()],
    ]
    const found: Record<string, string[]> = {}
    for (const [path, ready] of pages) {
      await open(page, path)
      await ready(page)
      const violations = await scan(page)
      if (violations.length) found[path] = violations
    }
    const menu = await openUserMenu(page)
    await menu.getByRole('menuitem', { name: 'Log Out' }).click()
    await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible()
    const loginViolations = await scan(page)
    if (loginViolations.length) found['/login'] = loginViolations
    expect(found).toEqual({})
  })

  test('[INT-006] form fields carry their metadata labels, required state and announced errors @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    void backend
    await open(page, '/app/person/create')
    for (const label of ['First Name', 'Last Name', 'Email']) {
      const field = page.getByRole('textbox', { name: label, exact: true })
      await expect(field).toBeVisible()
      await expect(field).toHaveAttribute('aria-required', 'true')
    }
    await expect(page.getByRole('textbox', { name: 'Birth Date' }).or(page.getByLabel('Birth Date'))).toHaveCount(1)
    await page.getByRole('button', { name: /^Save|^Create/ }).click()
    for (const label of ['First Name', 'Last Name', 'Email']) {
      const field = page.getByRole('textbox', { name: label, exact: true })
      await expect(field).toHaveAttribute('aria-invalid', 'true')
      const describedBy = await field.getAttribute('aria-describedby')
      expect(describedBy, `${label} names its error`).toBeTruthy()
      await expect(page.locator(`[id="${describedBy?.split(' ')[0]}"]`)).toContainText(/required/i)
    }
  })
})

test.describe('validation', () => {
  test('[INT-007] a missing required value is named and focused, and nothing is saved @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const before = await backend.sql('select count(*) as n from person')
    await open(page, '/app/person/create')
    await page.getByRole('textbox', { name: 'Last Name', exact: true }).fill('Only')
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('only@example.invalid')
    await page.getByRole('button', { name: /^Save|^Create/ }).click()
    const firstName = page.getByRole('textbox', { name: 'First Name', exact: true })
    await expect(firstName).toBeFocused()
    await expect(page.getByText(/First Name is required/i)).toBeVisible()
    await expect(page).toHaveURL(/\/app\/person\/create\/?$/)
    expect(await backend.sql('select count(*) as n from person')).toEqual(before)
  })

  test('[INT-007] a backend validation rejection is shown and nothing is saved @mobile', async ({ page, backend, diagnostics }) => {
    diagnostics.allow('/qqq/v1/table/fieldLab 400')
    diagnostics.allow('/qqq/v1/table/fieldLab 500')
    diagnostics.allow(/status of (400|500)/)
    await open(page, '/app/fieldLab/create')
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Range check')
    // the backend enforces the 0..100 range of Bounded Value (ValueRangeBehavior)
    await page.getByLabel('Bounded Value', { exact: true }).fill('150')
    await page.locator('[data-qqq-id="button-save"]').click()
    await expect(page.getByText(/Failed to create Field Lab: .*Bounded Value/)).toBeVisible()
    await expect(page).toHaveURL(/\/app\/fieldLab\/create\/?$/)
    expect(await backend.sql('select count(*) as n from field_lab')).toEqual([{ n: '0' }])
  })
})

test.describe('phone layout', () => {
  test.use({ viewport: { width: 412, height: 839 }, hasTouch: true })

  test('[INT-008] the drawer, list, record and form work at phone width without horizontal scrolling @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const noHorizontalScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    await open(page, '/app/miscellaneous')
    await expect(page.locator('[data-qqq-id="sidebar-desktop"]')).toBeHidden()
    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    const drawer = page.locator('[data-qqq-id="sidebar-mobile-drawer"]')
    await expect(drawer).toBeVisible()
    await drawer.getByRole('button', { name: 'Expand People App' }).click()
    await drawer.getByRole('button', { name: 'Expand Greetings App' }).click()
    await drawer.getByRole('link', { name: 'Person', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/person\/?$/)
    await expect(drawer).toHaveCount(0)
    await expect(page.getByText('Avery').first()).toBeVisible()
    expect(await noHorizontalScroll()).toBe(true)

    await page.getByText('Blair').first().click()
    await expect(page).toHaveURL(/\/app\/person\/2\/?$/)
    await expect(page.getByRole('heading', { name: /Blair/ }).first()).toBeVisible()
    expect(await noHorizontalScroll()).toBe(true)

    await open(page, '/app/person/2/edit')
    const firstName = page.getByRole('textbox', { name: 'First Name' })
    await expect(firstName).toHaveValue('Blair')
    expect(await noHorizontalScroll()).toBe(true)
    await firstName.fill('Blaine')
    await page.getByRole('button', { name: /^Save/ }).click()
    await expect(page).toHaveURL(/\/app\/person\/2\/?$/)
    expect(await backend.sql('select first_name from person where id = 2')).toEqual([{ first_name: 'Blaine' }])
  })

  test('[INT-001] with a keyboard on a phone: open a card, the record actions sheet and the edit form, and save @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    // the drawer part of this row is proven by tap (INT-008) and by keyboard on wider screens: the
    // phone drawer does not yet move focus in when opened from the keyboard (QRun-IO/qqq#708)
    await open(page, '/app/person')
    const blair = listCell(page, 'Person', 'Blair')
    await tabTo(page, blair, 120)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/person\/2\/?$/)

    await tabTo(page, page.locator('[data-qqq-id="button-mobile-actions"]'))
    await page.keyboard.press('Enter')
    const sheet = page.getByRole('dialog', { name: 'Record actions' })
    await expect(sheet).toBeVisible()
    await tabTo(page, sheet.getByRole('button', { name: 'Edit Person' }))
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/person\/2\/edit\/?$/)
    const firstName = page.getByRole('textbox', { name: 'First Name' })
    await tabTo(page, firstName)
    await expect(firstName).toHaveValue('Blair')
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Blake', { delay: 30 })
    await expect(firstName).toHaveValue('Blake')
    await tabTo(page, page.locator('[data-qqq-id="button-save"]'))
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/person\/2\/?$/)
    await expect(page.getByRole('heading', { name: /Blake/ }).first()).toBeVisible()
    expect(await backend.sql('select first_name from person where id = 2')).toEqual([{ first_name: 'Blake' }])
  })

  test('[INT-009] a held list request shows busy placeholder cards on a phone, then the real cards @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    // QRun-IO/qqq#694: the card list rendered "No records found" while the records loaded
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => { release = resolve })
    await page.route('**/qqq/v1/table/person/query', async (route: Route) => { await held; await route.continue() })
    await open(page, '/app/person')
    const loading = page.locator('[data-qqq-id="record-card-view-loading-person"]')
    await expect(loading).toBeVisible()
    await expect(loading).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByRole('status', { name: 'Loading Person records' })).toBeVisible()
    await expect(page.getByText('No records found')).toHaveCount(0)
    release()
    const cards = page.getByRole('list', { name: 'Person records' }).getByRole('listitem')
    await expect(cards).toHaveCount(Number((await backend.sql('select count(*) as n from person'))[0].n))
    await expect(loading).toHaveCount(0)
  })
})

test.describe('loading, failure, delay and stale data', () => {
  test('[INT-009] a held list request shows the loading state, then the real rows', async ({ page, backend, diagnostics }) => {
    void diagnostics
    void backend
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => { release = resolve })
    await page.route('**/qqq/v1/table/person/query', async (route: Route) => { await held; await route.continue() })
    await open(page, '/app/person')
    await expect(page.locator('[data-qqq-id="grid-loading"]')).toBeVisible()
    await expect(personGrid(page)).toHaveCount(0)
    release()
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    await expect(page.locator('[data-qqq-id="grid-loading"]')).toHaveCount(0)
  })

  test('[INT-010] a failing list request explains the failure and Retry recovers @mobile', async ({ page, backend, diagnostics }) => {
    void backend
    diagnostics.allow('/qqq/v1/table/person/query 500')
    diagnostics.allow('status of 500')
    await page.route('**/qqq/v1/table/person/query', (route: Route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary storage failure' }) }))
    await open(page, '/app/person')
    const failure = page.locator('[data-qqq-id="grid-error"]')
    await expect(failure).toContainText('Failed to load records.', { timeout: 30_000 })
    await expect(failure).toContainText('Temporary storage failure')
    await page.unroute('**/qqq/v1/table/person/query')
    await failure.getByRole('button', { name: 'Retry' }).click()
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    await expect(failure).toHaveCount(0)
  })

  test('[INT-011] a slow save disables the submit control and a double submit creates one record @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await page.route('**/qqq/v1/table/person', async (route: Route) => {
      if (route.request().method() === 'POST') await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.continue()
    })
    await open(page, '/app/person/create')
    await page.getByRole('textbox', { name: 'First Name', exact: true }).fill('Quinn')
    await page.getByRole('textbox', { name: 'Last Name', exact: true }).fill('Once')
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('quinn@example.invalid')
    const save = page.locator('[data-qqq-id="button-save"]')
    await save.click()
    await expect(save).toBeDisabled()
    await save.click({ force: true })
    await expect(page).toHaveURL(/\/app\/person\/\d+\/?$/)
    expect(await backend.sql("select count(*) as n from person where first_name = 'Quinn'")).toEqual([{ n: '1' }])
  })

  test('[INT-011] a failed save is reported and not silently re-sent @mobile', async ({ page, backend, diagnostics }) => {
    diagnostics.allow('/qqq/v1/table/person 500')
    diagnostics.allow('status of 500')
    let attempts = 0
    await page.route('**/qqq/v1/table/person', async (route: Route) => {
      if (route.request().method() !== 'POST') return route.continue()
      attempts++
      if (attempts === 1) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Connection reset' }) })
      return route.continue()
    })
    await open(page, '/app/person/create')
    await page.getByRole('textbox', { name: 'First Name', exact: true }).fill('Riley')
    await page.getByRole('textbox', { name: 'Last Name', exact: true }).fill('Retry')
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('riley@example.invalid')
    await page.getByRole('button', { name: /^Save|^Create/ }).click()
    await expect(page.getByText('Failed to create Person: Connection reset')).toBeVisible()
    await page.waitForTimeout(4000)
    expect(attempts).toBe(1)
    expect(await backend.sql("select count(*) as n from person where first_name = 'Riley'")).toEqual([{ n: '0' }])
    await expect(page).toHaveURL(/\/app\/person\/create\/?$/)
  })

  test('[INT-012] records changed or deleted elsewhere are not shown stale after navigation @mobile', async ({ page, backend, diagnostics }) => {
    diagnostics.allow('/qqq/v1/table/person/3 404')
    diagnostics.allow('status of 404')
    await open(page, '/app/person')
    await expect(listCell(page, 'Person', 'Blair')).toBeVisible()
    await listCell(page, 'Person', 'Blair').click()
    // on a phone the card titles are headings too: wait for the record page before reading its heading
    await expect(page).toHaveURL(/\/app\/person\/2\/?$/)
    await expect(page.getByRole('heading', { name: /Blair/ }).first()).toBeVisible()
    await page.goBack()
    await expect(listCell(page, 'Person', 'Casey')).toBeVisible()

    // another user renames Blair and deletes Casey
    expect((await backend.api.put('/data/person/2', { multipart: { firstName: 'Bryn' } })).ok()).toBe(true)
    expect(await (await backend.api.delete('/data/person/3')).json()).toMatchObject({ deletedRecordCount: 1 })

    await listCell(page, 'Person', 'Avery').click()
    await expect(page).toHaveURL(/\/app\/person\/1\/?$/)
    await page.goBack()
    await expect(listCell(page, 'Person', 'Bryn')).toBeVisible()
    await expect(listCell(page, 'Person', 'Casey')).toHaveCount(0)
    await listCell(page, 'Person', 'Bryn').click()
    await expect(page).toHaveURL(/\/app\/person\/2\/?$/)
    await expect(page.getByRole('heading', { name: /Bryn/ }).first()).toBeVisible()

    await open(page, '/app/person/3')
    await expect(page.locator('[data-qqq-id="record-view-not-found-person"]')).toContainText('Record Not Found')
  })

  test('[INT-013] a query with no results explains it and offers the way back @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    void backend
    await open(page, '/app/person')
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    await page.getByRole('searchbox', { name: 'Quick search Person' }).fill('zz-no-such-person')
    await expect(page.getByRole('heading', { name: 'No records found' })).toBeVisible()
    await expect(page.getByText('Try adjusting your filters or search term.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create new Person record' })).toBeVisible()
    await page.getByRole('button', { name: 'Clear Filters' }).click()
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  })

  test('[INT-014] an unreachable backend at sign-in is explained and Try again recovers @mobile', async ({ page, backend, diagnostics }) => {
    void backend
    // the aborted request is reported differently per browser (net::ERR_FAILED, NS_ERROR_FAILURE, Web Inspector)
    diagnostics.allow(/POST \S*\/qqq\/v1\/manageSession /)
    diagnostics.allow('net::ERR_FAILED')
    let fail = true
    await page.route('**/qqq/v1/manageSession', (route: Route) => fail ? route.abort('failed') : route.continue())
    await open(page, '/app/person')
    await expect(page.locator('[data-qqq-id="login-error"]')).toContainText('Sign-in failed')
    await expectTouchReady(page)
    fail = false
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  })
})
