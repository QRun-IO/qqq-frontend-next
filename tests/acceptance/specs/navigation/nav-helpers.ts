/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Locator, Page } from '@playwright/test'
import { expect, type Backend, type Diagnostics } from '../../support/fixtures'

/** App-tree node as serialized by `GET /qqq/v1/metaData`. */
export interface TreeNode {
  name: string
  label: string
  type: 'APP' | 'TABLE' | 'PROCESS' | 'REPORT'
  icon?: { name?: string; path?: string; color?: string }
  children?: TreeNode[]
}

/** The v1 instance metadata fields these specs read. */
export interface V1MetaData {
  appTree: TreeNode[]
  apps: Record<string, { name: string; label: string; widgets?: string[]; sections?: Array<{ name: string; label: string; tables?: string[]; processes?: string[]; reports?: string[] }> }>
  tables: Record<string, { name: string; label: string; isHidden?: boolean; insertPermission?: boolean; capabilities?: string[] }>
  processes: Record<string, { name: string; label: string; isHidden?: boolean }>
  branding?: Record<string, unknown>
}

/** Reads the backend's v1 instance metadata for this test's session, independently of the UI. */
export async function v1MetaData(backend: Backend): Promise<V1MetaData> {
  const response = await backend.api.get('/qqq/v1/metaData')
  expect(response.status()).toBe(200)
  return response.json()
}

/** Finds a node anywhere in the app tree. */
export function findNode(nodes: TreeNode[], name: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.name === name) return node
    const inChild = findNode(node.children ?? [], name)
    if (inChild) return inChild
  }
  return undefined
}

/**
 * The greetingsApp dashboard includes the sample's QuickSight widget, which needs an AWS
 * account the fixture does not own; the backend answers 500 for its data. Navigation specs
 * that land on that app home allow exactly that failure (widget rendering is covered by the
 * widgets matrix).
 */
export function allowQuickSight(diagnostics: Diagnostics) {
  diagnostics.allow('/widget/QuickSightChartRenderer 500')
  diagnostics.allow(/Failed to load resource: the server responded with a status of 500/)
}

/** Waits until the dashboard shell has loaded metadata and rendered the page content. */
export async function waitForShell(page: Page) {
  await expect(page.locator('#main-content')).toBeVisible()
  await expect(page.getByRole('status', { name: 'Loading content' })).toHaveCount(0)
}

/**
 * Returns the app navigation tree, opening the mobile drawer first on narrow viewports
 * (the desktop sidebar is hidden there).
 */
export async function appNavigation(page: Page): Promise<Locator> {
  await waitForShell(page)
  const menu = page.getByRole('button', { name: 'Open navigation menu' })
  if (await menu.isVisible()) {
    await menu.click()
  }
  const nav = page.getByRole('navigation', { name: 'App navigation' })
  await expect(nav).toBeVisible()
  return nav
}

/** The top-level entries (links) of the sidebar tree, in order. */
export function topLevelLinks(nav: Locator): Locator {
  return nav.locator(':scope > ul > li > a, :scope > ul > li > div > a')
}

/** The link entries directly inside an app group of the sidebar. */
export function groupChildLinks(nav: Locator, appName: string): Locator {
  return nav.locator(`li:has(> div > a[data-qqq-id="sidebar-collapse-${appName}"]) > ul > li > a, li:has(> div > a[data-qqq-id="sidebar-collapse-${appName}"]) > ul > li > div > a`)
}

/** Asserts the breadcrumb trail (links and current page), retrying until it matches. */
export async function expectBreadcrumbs(page: Page, labels: string[]) {
  const trail = page.getByRole('navigation', { name: 'Breadcrumb' })
  await expect(trail.locator('a, [aria-current="page"]')).toHaveText(labels)
}

/**
 * The record list of a table page: a grid on wide viewports, a card list on narrow ones
 * (both are labelled "{table label} records").
 */
export function recordCollection(page: Page, tableLabel: string): Locator {
  const name = `${tableLabel} records`
  return page.getByRole('grid', { name }).or(page.getByRole('list', { name }))
}

/** Asserts the table page lists exactly these records (by a displayed value each), in any layout. */
export async function expectRecords(page: Page, tableLabel: string, values: string[]) {
  const collection = recordCollection(page, tableLabel)
  await expect(collection).toBeVisible()
  for (const value of values) await expect(collection.getByText(value, { exact: true }).first()).toBeVisible()
  await expect(recordItems(collection)).toHaveCount(values.length)
}

/** The rows (grid) or cards (list) of a record collection. */
export function recordItems(collection: Locator): Locator {
  return collection.locator('[data-qqq-id^="grid-row-"]').or(collection.getByRole('listitem'))
}
