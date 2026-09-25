/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test, type Backend, type Persona } from '../../support/fixtures'
import { appNavigation, topLevelLinks, v1MetaData, waitForShell, type TreeNode, type V1MetaData } from './nav-helpers'

/** Navigable (non-hidden) app-tree nodes in tree order, computed from backend metadata. */
function navigable(meta: V1MetaData): TreeNode[] {
  const out: TreeNode[] = []
  const visit = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      const hidden = (node.type === 'TABLE' && meta.tables[node.name]?.isHidden) || (node.type === 'PROCESS' && meta.processes[node.name]?.isHidden)
      if (!hidden) out.push(node)
      if (node.type === 'APP') visit(node.children ?? [])
    }
  }
  visit(meta.appTree)
  return out
}

/** Count of permitted widgets declared on navigable apps (labels and permissions live in the full metadata). */
async function widgetCount(backend: Backend, meta: V1MetaData, apps: TreeNode[]): Promise<number> {
  const full = await (await backend.api.get('/metaData')).json()
  const names = new Set(apps.flatMap((app) => (meta.apps[app.name]?.widgets ?? []).filter((name) => full.widgets[name]?.hasPermission)))
  return names.size
}

test.describe('dashboard landing page', () => {
  test('[NAV-017] counts, quick actions and application cards come from navigable, permitted metadata', async ({ page, backend, diagnostics }) => {
    const meta = await v1MetaData(backend)
    const nodes = navigable(meta)
    const tables = nodes.filter((node) => node.type === 'TABLE')
    const processes = nodes.filter((node) => node.type === 'PROCESS')
    const apps = nodes.filter((node) => node.type === 'APP')
    expect(tables.map((node) => node.name)).not.toContain('navHiddenNote')

    await open(page, '/app')
    await waitForShell(page)
    await expect(page.locator('[data-qqq-id="dashboard-stat-tables-value"]')).toHaveText(String(tables.length))
    await expect(page.locator('[data-qqq-id="dashboard-stat-processes-value"]')).toHaveText(String(processes.length))
    await expect(page.locator('[data-qqq-id="dashboard-stat-apps-value"]')).toHaveText(String(apps.length))
    await expect(page.locator('[data-qqq-id="dashboard-stat-widgets-value"]')).toHaveText(String(await widgetCount(backend, meta, apps)))

    const actions = page.getByRole('region', { name: 'Quick Actions' }).getByRole('link')
    const creatable = tables.filter((node) => meta.tables[node.name].insertPermission && meta.tables[node.name].capabilities?.includes('TABLE_INSERT')).slice(0, 6)
    const expected = [...creatable.map((node) => `Create ${meta.tables[node.name].label}`), ...processes.slice(0, 4).map((node) => meta.processes[node.name].label)]
    expect(expected).toEqual(['Create Carrier', 'Create Field Lab', 'Create Pet Species', 'Create Nav Deep Item', 'Create Person', 'Create Pet',
      'Sleep Interactive', 'Simple Throw', 'Greet Interactive', 'Clone People'])
    await expect(actions).toHaveText(expected)
    // Regression: internal processes and table-bulk processes were offered
    for (const internal of ['Run Scheduled Report', 'Get Shared Records', 'Store Saved View', 'Person Bulk Edit']) {
      await expect(page.getByRole('link', { name: internal })).toHaveCount(0)
    }

    const cards = page.getByRole('region', { name: 'Applications' }).getByRole('heading', { level: 3 })
    await expect(cards).toHaveText(meta.appTree.map((node) => node.label))

    await page.getByRole('link', { name: 'Create Carrier' }).click()
    await expect(page).toHaveURL(/\/app\/carrier\/create\/?$/)
    await expect(page).toHaveTitle('Create Carrier | Carrier | Miscellaneous | QQQ Sample')
    await page.goBack()
    await page.locator('[data-qqq-id="dashboard-app-peopleApp"]').click()
    await expect(page).toHaveURL(/\/app\/peopleApp\/?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'People App' })).toBeVisible()
  })

  test.describe('as a viewer', () => {
    test.use({ persona: 'viewer' })

    test('[NAV-017] a viewer is offered no create or process quick actions', async ({ page, backend, diagnostics }) => {
      const meta = await v1MetaData(backend)
      expect(meta.tables.person.insertPermission).toBe(false)
      expect((await backend.api.post('/qqq/v1/processes/clonePeople/init', { data: {} })).status()).toBe(403)

      await open(page, '/app')
      await waitForShell(page)
      const actions = page.getByRole('region', { name: 'Quick Actions' })
      await expect(actions).toContainText('No quick actions available')
      await expect(actions.getByRole('link')).toHaveCount(0)
      await expect(page.locator('[data-qqq-id="dashboard-stat-processes-value"]')).toHaveText('0')
    })
  })

  test.describe('with no permitted apps', () => {
    // Requires the harness persona 'noApps' (every permission except App access), requested in the navigation report
    test.use({ persona: 'noApps' as Persona })

    test('[NAV-029] a user without app access sees the dashboard entry and the no-apps message', async ({ page, backend, diagnostics }) => {
      const meta = await v1MetaData(backend)
      expect(meta.appTree).toEqual([])
      expect(meta.apps).toEqual({})

      await open(page, '/app')
      const nav = await appNavigation(page)
      await expect(topLevelLinks(nav)).toHaveText(['Dashboard'])
      await expect(page.locator('[data-qqq-id="dashboard-no-apps"]')).toHaveText('You do not have permission to access any apps.')
      await expect(page.locator('[data-qqq-id="dashboard-stat-apps-value"]')).toHaveText('0')

      await open(page, '/app/peopleApp')
      await waitForShell(page)
      await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    })
  })
})
