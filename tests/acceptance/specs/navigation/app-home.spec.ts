/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { allowQuickSight, appNavigation, recordCollection, v1MetaData, waitForShell } from './nav-helpers'

/** SQL table behind each RDBMS-backed app-home table (the enum table petSpecies is counted via the API). */
const SQL_TABLE: Record<string, string> = {
  carrier: 'carrier',
  fieldLab: 'field_lab',
  person: 'person',
  pet: 'pet',
  petNote: 'pet_note',
  navDeepItem: 'nav_deep_item',
}

function section(page: Page, label: string) {
  return page.getByRole('main').getByRole('region', { name: label, exact: true })
}

test.describe('app home', () => {
  test('[NAV-008] Miscellaneous home lists actions and data by label with icons, and entries navigate', async ({ page, backend, diagnostics }) => {
    const meta = await v1MetaData(backend)
    const declared = meta.apps.miscellaneous.sections?.[0]
    expect(declared?.processes).toEqual(['sleepInteractive', 'simpleThrow'])
    expect(declared?.tables).toEqual(['carrier', 'fieldLab', 'petSpecies'])

    await open(page, '/app/miscellaneous')
    await waitForShell(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Miscellaneous' })).toBeVisible()
    const misc = section(page, 'Miscellaneous')
    await expect(misc.getByRole('heading', { level: 2 }).locator('svg')).toHaveAttribute('data-qqq-icon', 'badge')

    const actions = misc.getByRole('list', { name: 'Actions' }).getByRole('link')
    await expect(actions).toHaveText(declared!.processes!.map((name) => meta.processes[name].label))
    const data = misc.getByRole('list', { name: 'Data' }).getByRole('link')
    await expect(data).toHaveCount(3)
    for (const [index, name] of declared!.tables!.entries()) {
      await expect(data.nth(index)).toContainText(meta.tables[name].label)
      await expect(data.nth(index)).toHaveAttribute('href', new RegExp(`/app/${name}/?$`))
    }
    // [NAV-005] entry icons: declared table icons, and the app icon for processes without one (Material parity)
    await expect(data.nth(0).locator('svg')).toHaveAttribute('data-qqq-icon', 'local_shipping')
    await expect(data.nth(0).locator('svg')).toHaveClass(/lucide-truck/)
    await expect(data.nth(1).locator('svg')).toHaveAttribute('data-qqq-icon', 'science')
    await expect(actions.nth(0).locator('svg')).toHaveAttribute('data-qqq-icon', 'stars')

    await data.nth(0).click()
    await expect(page).toHaveURL(/\/app\/carrier\/?$/)
    await expect(recordCollection(page, 'Carrier')).toBeVisible()
    await page.goBack()
    await section(page, 'Miscellaneous').getByRole('link', { name: 'Simple Throw' }).click()
    await expect(page).toHaveURL(/\/app\/simpleThrow\/?$/)
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).locator('[aria-current="page"]')).toHaveText('Simple Throw')
    await expect(page).toHaveTitle('Simple Throw | Miscellaneous | QQQ Sample')
  })

  test('[NAV-008] Greetings App home uses labels, omits the hidden process and table', async ({ page, backend, diagnostics }) => {
    allowQuickSight(diagnostics)
    await open(page, '/app/greetingsApp')
    await waitForShell(page)
    const greetings = section(page, 'Greetings App')
    await expect(greetings.getByRole('list', { name: 'Actions' }).getByRole('link')).toHaveText(['Greet Interactive'])
    await expect(greetings.getByRole('list', { name: 'Actions' }).locator('svg')).toHaveAttribute('data-qqq-icon', 'waving_hand')
    const data = greetings.getByRole('list', { name: 'Data' }).getByRole('link')
    await expect(data).toHaveCount(3)
    await expect(data.nth(0)).toContainText('Person')
    await expect(data.nth(1)).toContainText('Pet')
    await expect(data.nth(2)).toContainText('Pet Note')
    // [NAV-006] hidden sample objects (greet process, city table) are not offered
    await expect(page.getByRole('main').getByRole('link', { name: /Greet People|City/ })).toHaveCount(0)
    await expect(page.getByRole('main')).not.toContainText('petNote')
  })

  test.describe('without pet permissions', () => {
    test.use({ persona: 'noPets' })

    test('[NAV-008] unpermitted section entries are omitted', async ({ page, backend, diagnostics }) => {
      allowQuickSight(diagnostics)
      await open(page, '/app/greetingsApp')
      await waitForShell(page)
      const data = section(page, 'Greetings App').getByRole('list', { name: 'Data' }).getByRole('link')
      await expect(data).toHaveCount(1)
      await expect(data.first()).toContainText('Person')
    })
  })

  test('[NAV-009] table entries show the backend record count', async ({ page, backend, diagnostics }) => {
    allowQuickSight(diagnostics)
    for (const [app, label] of [['miscellaneous', 'Miscellaneous'], ['greetingsApp', 'Greetings App']] as const) {
      await open(page, `/app/${app}`)
      await waitForShell(page)
      const meta = await v1MetaData(backend)
      for (const table of meta.apps[app].sections![0].tables!) {
        let expected: number
        if (SQL_TABLE[table]) {
          expected = Number((await backend.sql(`select count(*) as n from ${SQL_TABLE[table]}`))[0].n)
        } else {
          const response = await backend.api.post(`/qqq/v1/table/${table}/count`, { data: {} })
          expect(response.status()).toBe(200)
          expected = (await response.json()).count
        }
        await expect(section(page, label).locator(`[data-qqq-id="app-section-table-count-${table}"]`))
          .toHaveText(`${expected.toLocaleString('en-US')} ${expected === 1 ? 'total record' : 'total records'}`)
      }
    }
  })

  test('[NAV-010] People App home shows its process and its child app, which navigates', async ({ page, backend, diagnostics }) => {
    allowQuickSight(diagnostics)
    const meta = await v1MetaData(backend)
    expect(meta.apps.peopleApp.widgets).toBeUndefined()

    await open(page, '/app/peopleApp')
    await waitForShell(page)
    await expect(page.getByRole('heading', { level: 1, name: 'People App' })).toBeVisible()
    await expect(section(page, 'People App').getByRole('list', { name: 'Actions' }).getByRole('link')).toHaveText(['Clone People'])
    const apps = section(page, 'Apps').getByRole('link')
    await expect(apps).toHaveText(['Greetings App'])
    await expect(apps.locator('svg')).toHaveAttribute('data-qqq-icon', 'emoji_people')
    await apps.click()
    await expect(page).toHaveURL(/\/app\/greetingsApp\/?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Greetings App' })).toBeVisible()
  })

  test('[NAV-010] nested fixture apps chain through their child apps; an empty app shows the empty state', async ({ page, backend, diagnostics }) => {
    await open(page, '/app/navLevelOne')
    await waitForShell(page)
    const one = section(page, 'Apps').getByRole('link')
    await expect(one).toHaveText(['Nav Level Two'])
    await expect(one.locator('svg')).toHaveCSS('color', 'rgb(185, 28, 28)')
    await one.click()
    await expect(page.getByRole('heading', { level: 1, name: 'Nav Level Two' })).toBeVisible()
    await section(page, 'Apps').getByRole('link', { name: 'Nav Level Three' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Nav Level Three' })).toBeVisible()
    // [NAV-006] the hidden fixture table is not offered on its app home
    const data = section(page, 'Nav Level Three').getByRole('list', { name: 'Data' }).getByRole('link')
    await expect(data).toHaveCount(1)
    await expect(data.first()).toContainText('Nav Deep Item')
    // [NAV-028] the report is listed in its section's Reports group
    const reports = section(page, 'Nav Level Three').getByRole('list', { name: 'Reports' }).getByRole('link')
    await expect(reports).toHaveText(['Nav Deep Item Report'])
    await expect(reports.locator('svg')).toHaveAttribute('data-qqq-icon', 'assessment')
    await reports.click()
    await expect(page).toHaveURL(/\/app\/navDeepItemReport\/?$/)
    await expect(page.getByRole('heading', { name: 'Nav Deep Item Report' })).toBeVisible()

    await open(page, '/app/navEmptyApp')
    await waitForShell(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Nav Empty App' })).toBeVisible()
    await expect(page.getByText('No dashboard content configured for this app')).toBeVisible()
  })

  test.describe('as a viewer', () => {
    test.use({ persona: 'viewer' })

    test('[NAV-010] People App shows only the permitted child app', async ({ page, backend, diagnostics }) => {
      allowQuickSight(diagnostics)
      const meta = await v1MetaData(backend)
      expect(meta.processes.clonePeople).toBeUndefined()
      expect((await backend.api.get('/qqq/v1/metaData/process/clonePeople')).status()).toBe(403)

      await open(page, '/app/peopleApp')
      await waitForShell(page)
      await expect(section(page, 'Apps').getByRole('link')).toHaveText(['Greetings App'])
      await expect(page.getByRole('main').getByRole('link', { name: 'Clone People' })).toHaveCount(0)
      await expect(page.getByRole('main').getByRole('list', { name: 'Actions' })).toHaveCount(0)
    })
  })

  test('[NAV-011] Sample Widgets Dashboard opens from the sidebar with one labelled container per widget', async ({ page, backend, diagnostics }) => {
    const meta = await v1MetaData(backend)
    const declared = meta.apps.SampleWidgetsDashboard.widgets!
    expect(declared).toHaveLength(11)
    // Widget labels are only in the full (legacy) metadata; v1 widgets are name-only
    const full = await (await backend.api.get('/metaData')).json()
    const labels = declared.filter((name) => full.widgets[name].hasPermission).map((name) => full.widgets[name].label)

    await open(page, '/app')
    const nav = await appNavigation(page)
    await nav.getByRole('link', { name: 'Sample Widgets Dashboard', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/SampleWidgetsDashboard\/?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Sample Widgets Dashboard' })).toBeVisible()
    const widgets = page.getByRole('region', { name: 'Dashboard widgets' })
    for (const label of labels) {
      await expect(widgets.getByRole('region', { name: label, exact: true })).toBeVisible()
    }
    // One grid item per declared widget, in declared order
    await expect(widgets.locator('[data-qqq-id^="widget-grid-item-"]')).toHaveCount(labels.length)
    const order = await widgets.locator('[data-qqq-id^="widget-grid-item-"]').evaluateAll((items) => items.map((item) => item.getAttribute('data-qqq-id')))
    expect(order).toEqual(declared.map((name) => `widget-grid-item-${name}`))
  })
})
