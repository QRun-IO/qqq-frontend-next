/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Record URL state must be durable before the user reloads or leaves the page.
import { test, expect } from '@playwright/test'
import { setupApiMocks, METADATA } from './api-mocks'

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page)
  const table = structuredClone(METADATA.tables.person)
  table.sections.push(
    { ...table.sections[0], name: 'contact', label: 'Contact', tier: 'T2', fieldNames: ['email'] },
    { ...table.sections[0], name: 'status', label: 'Status', tier: 'T3', fieldNames: ['status'] },
  )
  await page.route('**/qqq/v1/metaData/table/person**', (route) => route.fulfill({ json: table }))
  await page.goto('/app/person/1?from=%2Fapp%2Fperson&fromLabel=People&keep=yes')
  await expect(page.getByRole('tab', { name: 'Contact', exact: true })).toBeVisible()
  await page.waitForLoadState('networkidle')
})

test('tab selection survives an immediate reload', async ({ page }, testInfo) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.isNavigationRequest() || request.url().includes('_rsc=')) requests.push(request.url())
  })
  const before = await page.evaluate(() => history.length)
  const reloaded = page.waitForEvent('domcontentloaded')
  const urlAtClick = await page.getByRole('tab', { name: 'Contact', exact: true }).evaluate((tab) => {
    (tab as HTMLElement).click()
    const url = location.href
    location.reload()
    return url
  })
  await reloaded
  await testInfo.attach('navigation', { body: JSON.stringify({ urlAtClick, requests }), contentType: 'application/json' })
  await expect(page.getByRole('tab', { name: 'Contact', exact: true })).toHaveAttribute('aria-selected', 'true')
  expect(new URL(urlAtClick).searchParams.get('tab')).toBe('section-contact')
  expect(await page.evaluate(() => history.length)).toBe(before)
})

test('view selection preserves URL context and survives immediate departure and Back', async ({ page }, testInfo) => {
  await page.evaluate(() => history.replaceState(history.state, '', location.href + '#identity'))
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.isNavigationRequest() || request.url().includes('_rsc=')) requests.push(request.url())
  })
  const snapshot = await page.getByRole('radio', { name: 'List view' }).evaluate((radio) => {
    (radio as HTMLElement).focus()
    const scroll = window.scrollY
    ;(radio as HTMLElement).click()
    const result = { url: location.href, focused: document.activeElement === radio, scrollBefore: scroll, scrollAfter: window.scrollY }
    location.assign('/app/person')
    return result
  })
  await expect(page).toHaveURL(/\/app\/person\/?$/)
  await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible()
  await page.goBack()
  await expect(page.locator('[data-qqq-id="record-view-list-mode"]')).toBeVisible()
  await testInfo.attach('navigation', { body: JSON.stringify({ snapshot, requests, returnUrl: page.url() }), contentType: 'application/json' })
  const url = new URL(page.url())
  expect(url.searchParams.get('view')).toBe('list')
  expect(url.searchParams.get('from')).toBe('/app/person')
  expect(url.searchParams.get('fromLabel')).toBe('People')
  expect(url.searchParams.get('keep')).toBe('yes')
  expect(url.hash).toBe('#identity')
  expect(snapshot.focused).toBe(true)
  expect(snapshot.scrollAfter).toBe(snapshot.scrollBefore)
  await expect(page.locator('[data-qqq-id="link-back-to-table"]')).toHaveAttribute('href', /\/app\/person\/?$/)
})

test('keyboard tabs retain focus and view changes do not add history entries', async ({ page }, testInfo) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.isNavigationRequest() || request.url().includes('_rsc=')) requests.push(request.url())
  })
  await page.setViewportSize({ width: 1280, height: 480 })
  const contact = page.getByRole('tab', { name: 'Contact', exact: true })
  await contact.focus()
  const before = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('#main-content')!
    main.scrollTop = 30
    return { length: history.length, scroll: main.scrollTop }
  })
  expect(before.scroll).toBeGreaterThan(0)
  await page.keyboard.press('Enter')
  await expect(contact).toHaveAttribute('aria-selected', 'true')
  await expect(contact).toBeFocused()
  expect(await page.locator('#main-content').evaluate((main) => main.scrollTop)).toBe(before.scroll)
  await page.getByRole('radio', { name: 'List view' }).click()
  await expect(page.locator('[data-qqq-id="record-view-list-mode"]')).toBeVisible()
  await page.getByRole('radio', { name: 'Card view' }).click()
  await expect(contact).toHaveAttribute('aria-selected', 'true')
  await testInfo.attach('before-reload', { body: JSON.stringify({ before, url: page.url(), requests }), contentType: 'application/json' })
  expect(requests).toEqual([])
  await page.reload()
  await expect(contact).toHaveAttribute('aria-selected', 'true')
  expect(await page.evaluate(() => history.length)).toBe(before.length)
  await testInfo.attach('navigation', { body: JSON.stringify({ before, url: page.url(), requests }), contentType: 'application/json' })
})


test('successive tab and view changes preserve both values and the saved view preference', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('qqq-user-preferences', JSON.stringify({ recordDefaultViewMode: 'list' })))
  await page.reload()
  await expect(page.getByRole('radio', { name: 'List view' })).toHaveAttribute('aria-checked', 'true')
  await page.goto('/app/person/1?view=tabs&keep=yes#identity')
  const contact = page.getByRole('tab', { name: 'Contact', exact: true })
  await expect(contact).toBeVisible()
  const snapshot = await page.evaluate(() => {
    const tab = document.querySelector<HTMLElement>('[data-qqq-id="record-tab-section-contact"]')
    if (!tab) throw new Error('Contact tab is missing')
    tab.click()
    document.querySelector<HTMLElement>('[role="radio"][aria-label="List view"]')!.click()
    return { url: location.href, preference: localStorage.getItem('qqq-user-preferences') }
  })
  const url = new URL(snapshot.url)
  expect(url.searchParams.get('tab')).toBe('section-contact')
  expect(url.searchParams.get('view')).toBe('list')
  expect(url.searchParams.get('keep')).toBe('yes')
  expect(url.hash).toBe('#identity')
  expect(JSON.parse(snapshot.preference!).recordDefaultViewMode).toBe('list')
  await page.reload()
  await expect(page.locator('[data-qqq-id="record-view-list-mode"]')).toBeVisible()
})
