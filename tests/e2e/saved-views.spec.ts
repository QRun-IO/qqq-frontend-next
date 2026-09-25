// E2E: SavedViews — backend saved views (querySavedView / storeSavedView / deleteSavedView), mocked

import { test, expect, type Page, type Route } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'

interface StoredView { id: number; label: string; userId: string; tableName: string; viewJson: string }

const ME = 'e2e@example.invalid'

/** Reads the JSON `values` field of a multipart process request. */
function processValues(route: Route): Record<string, unknown> {
  const body = route.request().postData() ?? ''
  const match = body.match(/name="values"\r\n\r\n([^\r]*)/)
  return match ? JSON.parse(match[1]) : {}
}

/** Mocks the saved-view processes over an in-memory store; returns the store. */
async function mockSavedViews(page: Page, initial: StoredView[]) {
  const store = [...initial]
  let nextId = 100
  const record = (v: StoredView) => ({ tableName: 'savedView', values: { ...v } })
  const complete = (route: Route, list: StoredView[]) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ type: 'COMPLETE', processUUID: 'mock', values: { savedViewList: list.map(record) } }) })
  const processes = Object.fromEntries(['querySavedView', 'storeSavedView', 'deleteSavedView'].map((name) =>
    [name, { name, label: name, tableName: '', isHidden: false, iconName: '', hasPermission: true, stepFlow: 'LINEAR', minInputRecords: 0, frontendSteps: [] }]))
  await page.route('**/qqq/v1/metaData**', (route) => {
    if (!/\/qqq\/v1\/metaData\/?(\?|$)/.test(route.request().url())) return route.fallback()
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...METADATA, processes: { ...METADATA.processes, ...processes } }) })
  })
  await page.route('**/qqq/v1/manageSession**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ uuid: 'mock', values: { user: { name: 'E2E User', email: ME } } }) }))
  await page.route('**/qqq/v1/processes/querySavedView/init**', (route) => {
    const values = processValues(route)
    if (values.id !== undefined) {
      const found = store.filter((v) => v.id === Number(values.id))
      if (!found.length) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ type: 'ERROR', processUUID: 'mock', error: 'The requested view was not found.' }) })
      return complete(route, found)
    }
    return complete(route, store.filter((v) => v.tableName === values.tableName))
  })
  await page.route('**/qqq/v1/processes/storeSavedView/init**', (route) => {
    const values = processValues(route)
    const existing = store.find((v) => v.id === Number(values.id))
    const view: StoredView = { id: existing?.id ?? nextId++, label: String(values.label), userId: ME, tableName: String(values.tableName), viewJson: String(values.viewJson) }
    if (existing) store.splice(store.indexOf(existing), 1, view)
    else store.push(view)
    return complete(route, [view])
  })
  await page.route('**/qqq/v1/processes/deleteSavedView/init**', (route) => {
    const index = store.findIndex((v) => v.id === Number(processValues(route).id))
    if (index >= 0) store.splice(index, 1)
    return complete(route, [])
  })
  return store
}

/** Opens the saved views menu. */
async function openMenu(page: Page) {
  await page.locator('[data-qqq-id="button-saved-views"]').click()
  return page.getByRole('menu', { name: 'Saved views' })
}

test.describe('SavedViews', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
  })

  test('lists your views and views shared with you', async ({ page }) => {
    await setupApiMocks(page)
    await mockSavedViews(page, [
      { id: 1, label: 'Mine', userId: ME, tableName: 'person', viewJson: '{"queryFilter":{}}' },
      { id: 2, label: 'Theirs', userId: 'someone@else.invalid', tableName: 'person', viewJson: '{"queryFilter":{}}' },
    ])
    await page.goto('/app/person')
    const menu = await openMenu(page)
    await expect(menu.getByRole('group', { name: 'Your Saved Views' })).toContainText('Mine')
    await expect(menu.getByRole('group', { name: 'Views Shared with you' })).toContainText('Theirs')
  })

  test('shows empty messages when there are no views', async ({ page }) => {
    await setupApiMocks(page)
    await mockSavedViews(page, [])
    await page.goto('/app/person')
    const menu = await openMenu(page)
    await expect(menu).toContainText('You do not have any saved views for this table.')
    await expect(menu).toContainText('You do not have any views shared with you for this table.')
  })

  test('saves the current view and opens it on its route', async ({ page }) => {
    await setupApiMocks(page)
    const store = await mockSavedViews(page, [])
    await page.goto('/app/person')
    await (await openMenu(page)).getByRole('menuitem', { name: 'Save As...' }).click()
    const dialog = page.getByRole('dialog', { name: 'Save View As' })
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled()
    await dialog.getByLabel('Enter a name for this view').fill('My View')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL(/\/app\/person\/savedView\/100/)
    expect(store).toHaveLength(1)
    expect(JSON.parse(store[0].viewJson)).toHaveProperty('queryColumns')
    await expect(page.locator('[data-qqq-id="button-saved-views"]')).toContainText('My View')
  })

  test('opening a view applies its filter, and deleting it returns to a new view', async ({ page }) => {
    await setupApiMocks(page)
    const store = await mockSavedViews(page, [{ id: 7, label: 'Alices', userId: ME, tableName: 'person',
      viewJson: JSON.stringify({ queryFilter: { criteria: [{ fieldName: 'firstName', operator: 'EQUALS', values: ['Alice'] }] } }) }])
    await page.goto('/app/person')
    const request = page.waitForRequest((r) => r.url().includes('/qqq/v1/table/person/query') && (r.postData() ?? '').includes('"Alice"'))
    await (await openMenu(page)).getByRole('menuitem', { name: 'Alices' }).click()
    await request
    await expect(page).toHaveURL(/\/app\/person\/savedView\/7/)
    await (await openMenu(page)).getByRole('menuitem', { name: 'Delete...' }).click()
    await page.getByRole('dialog', { name: 'Delete View' }).getByRole('button', { name: 'Delete' }).click()
    await expect(page).toHaveURL(/\/app\/person\/?$/)
    expect(store).toHaveLength(0)
  })

  test('the menu is absent when the backend has no saved view processes', async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/app/person')
    await expect(page.locator('[data-qqq-id^="grid-person"]')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('[data-qqq-id="button-saved-views"]')).toHaveCount(0)
  })
})
