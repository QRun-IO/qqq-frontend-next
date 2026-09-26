/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { recordCollection, waitForShell } from './nav-helpers'

async function expectLookupError(page: Page, message: string) {
  await waitForShell(page)
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(message)
  await expect(page).toHaveURL(/\/key\/?\?/)
}

test.describe('record lookup by key', () => {
  test('[NAV-023] a unique-key value opens the matching record in place of the key URL', async ({ page, backend, diagnostics }) => {
    const [item] = await backend.sql("select id, name from nav_deep_item where code = 'NAV-B2'")
    expect(item).toEqual({ id: '2', name: 'Tide Chart' })

    // The list's reads finish before the test leaves it, so none is cut off mid-flight
    const listLoaded = Promise.all(['/table/person/query', '/table/person/count', '/processes/querySavedView/init']
      .map((path) => page.waitForResponse((response) => new URL(response.url()).pathname.endsWith(path))))
    await open(page, '/app/person')
    await expect(recordCollection(page, 'Person')).toBeVisible()
    await listLoaded
    await open(page, '/app/navDeepItem/key?code=NAV-B2')
    await expect(page).toHaveURL(new RegExp(`/app/navDeepItem/${item.id}/?$`))
    await expect(page).toHaveTitle(`${item.name} | Nav Deep Item | Nav Level Three | Nav Level Two | Nav Level One | QQQ Sample`)
    await expect(page.getByRole('main')).toContainText('NAV-B2')
    // The key URL was replaced, so Back returns to the page before it
    await page.goBack()
    await expect(page).toHaveURL(/\/app\/person\/?$/)

    const [person] = await backend.sql("select id from person where email = 'casey@example.invalid'")
    await open(page, '/app/person/key?email=casey%40example.invalid')
    await expect(page).toHaveURL(new RegExp(`/app/person/${person.id}/?$`))
  })

  test('[NAV-023] no match, several matches, an unknown field and no values explain why nothing opened', async ({ page, backend, diagnostics }) => {
    expect(Number((await backend.sql("select count(*) as n from nav_deep_item where shelf = 'North'"))[0].n)).toBe(2)
    const queries: string[] = []
    page.on('request', (request) => { if (request.url().includes('/table/navDeepItem/query')) queries.push(request.url()) })

    await open(page, '/app/navDeepItem/key?code=NOPE')
    await expectLookupError(page, 'No Nav Deep Item record was found matching the given values.')
    await open(page, '/app/navDeepItem/key?shelf=North')
    await expectLookupError(page, 'More than one Nav Deep Item record was found matching the given values.')
    expect(queries).toHaveLength(2)

    await open(page, '/app/navDeepItem/key?color=red')
    await expectLookupError(page, 'Query-string parameter [color] is not a defined field on the Nav Deep Item table.')
    await open(page, '/app/navDeepItem/key')
    await waitForShell(page)
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('Add field values to the address to look up a Nav Deep Item record, for example ?id=1.')
    // Invalid lookups never reach the backend
    expect(queries).toHaveLength(2)
  })
})
