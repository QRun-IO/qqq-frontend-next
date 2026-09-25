/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { allowQuickSight, appNavigation, expectRecords, findNode, groupChildLinks, recordCollection, topLevelLinks, v1MetaData } from './nav-helpers'

test.describe('sidebar', () => {
  test('[NAV-002] sidebar lists every permitted top-level app once, by label, in backend order', async ({ page, backend, diagnostics }) => {
    const meta = await v1MetaData(backend)
    const expected = meta.appTree.map((node) => node.label)
    expect(expected).toEqual(['Miscellaneous', 'Nav Empty App', 'Nav Level One', 'People App', 'Sample Widgets Dashboard', 'Sharing Demo'])

    await open(page, '/app')
    const nav = await appNavigation(page)
    await expect(topLevelLinks(nav)).toHaveText(['Dashboard', ...expected])
    // Nested apps appear only under their parent: Greetings App is inside People App, not beside it
    await expect(nav.locator('[data-qqq-id="sidebar-collapse-greetingsApp"]')).toHaveCount(0)
    await nav.getByRole('button', { name: 'Expand People App' }).click()
    await expect(groupChildLinks(nav, 'peopleApp')).toHaveText(['Greetings App', 'Clone People'])
    await nav.getByRole('button', { name: 'Expand Greetings App' }).click()
    await expect(groupChildLinks(nav, 'greetingsApp')).toHaveText(['Person', 'Pet', 'Pet Note', 'Greet Interactive'])
  })

  test.describe('without pet permissions', () => {
    test.use({ persona: 'noPets' })

    test('[NAV-002] denied tables are absent from the sidebar and denied by the backend', async ({ page, backend, diagnostics }) => {
      const meta = await v1MetaData(backend)
      expect(findNode(meta.appTree, 'greetingsApp')?.children?.map((node) => node.name)).toEqual(['person', 'greetInteractive'])
      expect((await backend.api.get('/qqq/v1/metaData/table/pet')).status()).toBe(404)
      expect((await backend.api.post('/qqq/v1/table/pet/query', { data: {} })).status()).toBe(403)

      await open(page, '/app/person')
      const nav = await appNavigation(page)
      await expect(groupChildLinks(nav, 'greetingsApp')).toHaveText(['Person', 'Greet Interactive'])
      await expect(nav.getByRole('link', { name: 'Pet', exact: true })).toHaveCount(0)
      await expect(nav.getByRole('link', { name: 'Pet Note', exact: true })).toHaveCount(0)
    })
  })

  test('[NAV-003] apps nested three levels deep render as nested groups and navigate', async ({ page, backend, diagnostics }) => {
    const meta = await v1MetaData(backend)
    expect(findNode(meta.appTree, 'navLevelOne')?.children?.[0]?.children?.[0]?.children?.[0]?.name).toBe('navDeepItem')

    await open(page, '/app')
    const nav = await appNavigation(page)
    await nav.getByRole('button', { name: 'Expand Nav Level One' }).click()
    await nav.getByRole('button', { name: 'Expand Nav Level Two' }).click()
    await nav.getByRole('button', { name: 'Expand Nav Level Three' }).click()
    await expect(groupChildLinks(nav, 'navLevelThree')).toHaveText(['Nav Deep Item', 'Nav Deep Item Report'])
    await nav.getByRole('link', { name: 'Nav Deep Item', exact: true }).click()

    await expect(page).toHaveURL(/\/app\/navDeepItem\/?$/)
    const rows = await backend.sql('select name from nav_deep_item order by id')
    await expectRecords(page, 'Nav Deep Item', rows.map((row) => row.name!))
  })

  test('[NAV-003] a deep link expands every enclosing app group and marks the page active', async ({ page, backend, diagnostics }) => {
    await open(page, '/app/navDeepItem')
    const nav = await appNavigation(page)
    for (const app of ['Nav Level One', 'Nav Level Two', 'Nav Level Three']) {
      await expect(nav.getByRole('button', { name: `Collapse ${app}` })).toHaveAttribute('aria-expanded', 'true')
    }
    await expect(nav.getByRole('link', { name: 'Nav Deep Item', exact: true })).toHaveAttribute('aria-current', 'page')
  })

  test('[NAV-004] sidebar clicks open an app home, a table and a process, highlighting the active entry', async ({ page, backend, diagnostics }) => {
    allowQuickSight(diagnostics)
    await open(page, '/app')
    let nav = await appNavigation(page)
    await expect(nav.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page')

    await nav.getByRole('link', { name: 'Miscellaneous', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/miscellaneous\/?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Miscellaneous' })).toBeVisible()
    nav = await appNavigation(page)
    await expect(nav.getByRole('link', { name: 'Miscellaneous', exact: true })).toHaveAttribute('aria-current', 'page')

    await nav.getByRole('link', { name: 'Carrier', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/carrier\/?$/)
    await expect(recordCollection(page, 'Carrier')).toBeVisible()
    nav = await appNavigation(page)
    await expect(nav.getByRole('link', { name: 'Carrier', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('link', { name: 'Miscellaneous', exact: true })).not.toHaveAttribute('aria-current', 'page')

    await nav.getByRole('link', { name: 'Sleep Interactive', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/sleepInteractive\/?$/)
    await expect(page).toHaveTitle('Sleep Interactive | Miscellaneous | QQQ Sample')

    // Collapse and re-expand a group
    nav = await appNavigation(page)
    await nav.getByRole('button', { name: 'Collapse Miscellaneous' }).click()
    await expect(nav.getByRole('link', { name: 'Carrier', exact: true })).toHaveCount(0)
    await nav.getByRole('button', { name: 'Expand Miscellaneous' }).click()
    await expect(nav.getByRole('link', { name: 'Carrier', exact: true })).toBeVisible()
  })

  test('[NAV-005] declared icons render in the sidebar: named glyphs, colors, image paths and fallbacks', async ({ page, backend, diagnostics }) => {
    const meta = await v1MetaData(backend)
    expect(findNode(meta.appTree, 'miscellaneous')?.icon).toEqual({ name: 'stars' })
    expect(findNode(meta.appTree, 'navLevelOne')?.icon).toEqual({ path: '/kr-icon.png' })
    expect(findNode(meta.appTree, 'navLevelTwo')?.icon).toEqual({ name: 'folder', color: '#b91c1c' })

    await open(page, '/app/navDeepItem')
    const nav = await appNavigation(page)
    const glyph = (id: string) => nav.locator(`[data-qqq-id="${id}"] svg`)
    // Each declared Material icon name renders its own glyph (not the generic fallback)
    const declared: Array<[string, string, string]> = [
      ['sidebar-collapse-miscellaneous', 'stars', 'lucide-star'],
      ['sidebar-collapse-peopleApp', 'person', 'lucide-user'],
      ['sidebar-item-SampleWidgetsDashboard', 'widgets', 'lucide-layout-grid'],
      ['sidebar-collapse-sharing', 'share', 'lucide-share-2'],
      ['sidebar-collapse-navLevelThree', 'layers', 'lucide-layers'],
      ['sidebar-item-navDeepItem', 'inventory_2', 'lucide-package-open'],
      ['sidebar-item-navEmptyApp', 'inbox', 'lucide-inbox'],
      ['sidebar-item-navDeepItemReport', 'assessment', 'lucide-chart-bar'],
    ]
    for (const [id, name, lucideClass] of declared) {
      await expect(glyph(id)).toHaveAttribute('data-qqq-icon', name)
      await expect(glyph(id)).not.toHaveAttribute('data-qqq-icon-fallback', 'true')
      await expect(glyph(id)).toHaveClass(new RegExp(lucideClass))
    }
    await expect(glyph('sidebar-collapse-navLevelTwo')).toHaveCSS('color', 'rgb(185, 28, 28)')
    const image = nav.locator('[data-qqq-id="sidebar-collapse-navLevelOne"] img[data-qqq-icon="path"]')
    await expect(image).toHaveAttribute('src', '/kr-icon.png')
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)

    // Processes without a declared icon use the process fallback glyph
    await nav.getByRole('button', { name: 'Expand Miscellaneous' }).click()
    await expect(glyph('sidebar-item-sleepInteractive')).toHaveAttribute('data-qqq-icon', 'none')
    await expect(glyph('sidebar-item-sleepInteractive')).toHaveClass(/lucide-workflow/)
  })

  test('[NAV-006] hidden tables and processes never appear in the sidebar', async ({ page, backend, diagnostics }) => {
    const meta = await v1MetaData(backend)
    // city and greet (hidden, denied) are omitted by the backend; navHiddenNote (hidden, permitted) is sent with isHidden
    expect(meta.tables.city).toBeUndefined()
    expect(meta.processes.greet).toBeUndefined()
    expect(meta.processes.simpleSleep).toBeUndefined()
    expect(meta.tables.navHiddenNote?.isHidden).toBe(true)
    expect(findNode(meta.appTree, 'navLevelThree')?.children?.map((node) => node.name)).toEqual(['navDeepItem', 'navHiddenNote', 'navDeepItemReport'])

    await open(page, '/app/navDeepItem')
    const nav = await appNavigation(page)
    await nav.getByRole('button', { name: 'Expand People App' }).click()
    await nav.getByRole('button', { name: 'Expand Greetings App' }).click()
    await nav.getByRole('button', { name: 'Expand Miscellaneous' }).click()
    await expect(groupChildLinks(nav, 'navLevelThree')).toHaveText(['Nav Deep Item', 'Nav Deep Item Report'])
    await expect(groupChildLinks(nav, 'miscellaneous')).toHaveText(['Carrier', 'Field Lab', 'Pet Species', 'Sleep Interactive', 'Simple Throw'])
    for (const label of ['Nav Hidden Note', 'City', 'Greet People', 'Simple Sleep']) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0)
    }
  })

  test('[NAV-005] record view and form section headings show the section icons the table declares', async ({ page, backend, diagnostics }) => {
    const table = await (await backend.api.get('/qqq/v1/metaData/table/carrier')).json()
    const sections = (table.sections ?? []).filter((section: { icon?: { name?: string } }) => section.icon?.name)
    expect(sections.map((section: { name: string; icon: { name: string } }) => [section.name, section.icon.name])).toEqual([['identity', 'badge'], ['basicInfo', 'dataset']])
    const [carrier] = await backend.sql('select id from carrier order by id')

    await open(page, `/app/carrier/${carrier.id}`)
    // The T1 Identity section is the record header; T2 sections carry headings
    const viewIcon = page.getByRole('main').getByRole('heading', { name: 'Basic Info', exact: true }).first().locator('svg')
    await expect(viewIcon).toHaveAttribute('data-qqq-icon', 'dataset')
    await expect(viewIcon).toHaveClass(/lucide-database/)

    await open(page, `/app/carrier/${carrier.id}/edit`)
    for (const [label, name] of [['Identity', 'badge'], ['Basic Info', 'dataset']]) {
      await expect(page.getByRole('main').getByRole('heading', { name: label, exact: true }).first().locator('svg')).toHaveAttribute('data-qqq-icon', name)
    }
  })

  test('[NAV-028] a report in the app tree is listed under its app and opens the report page', async ({ page, backend, diagnostics }) => {
    const meta = await v1MetaData(backend)
    expect(findNode(meta.appTree, 'navDeepItemReport')?.type).toBe('REPORT')
    // v1 carries no report metadata; the full metadata route does
    const full = await (await backend.api.get('/metaData')).json()
    expect(full.reports.navDeepItemReport).toMatchObject({ name: 'navDeepItemReport', label: 'Nav Deep Item Report' })

    await open(page, '/app/navLevelThree')
    const nav = await appNavigation(page)
    await nav.getByRole('link', { name: 'Nav Deep Item Report', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/navDeepItemReport\/?$/)
    await expect(page.getByRole('heading', { name: 'Nav Deep Item Report' })).toBeVisible()
    await expect(page).toHaveTitle('Nav Deep Item Report | Nav Level Three | Nav Level Two | Nav Level One | QQQ Sample')
    const trail = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(trail.locator('a, [aria-current="page"]')).toHaveText(['Nav Level One', 'Nav Level Two', 'Nav Level Three', 'Nav Deep Item Report'])
    await expect((await appNavigation(page)).getByRole('link', { name: 'Nav Deep Item Report', exact: true })).toHaveAttribute('aria-current', 'page')
  })
})
