/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Restrictions that need owned fixture metadata (SecurityFixtures.java), run against the
// security backend variant: disabled tables/processes/widgets/apps, record locks,
// protected fields and capability limits.
import type { Page } from '@playwright/test'
import { open } from '../../support/fixtures'
import { expect, test } from './support/variant'
import { navigation, recordRequests } from './support/ui'

const grid = (page: Page, label: string) => page.getByRole('grid', { name: `${label} records` })
const denied = (page: Page) => page.locator('[data-qqq-id="permission-denied"]')

test.describe('disabled table (DenyBehavior.DISABLED)', () => {
  test('[SEC-002] admin lists the ledger; noPets sees it listed but every link explains the denial and loads nothing', async ({ page, security, diagnostics }) => {
    void diagnostics
    await open(page, '/app/securityLedger')
    await expect(grid(page, 'Security Ledger').getByRole('gridcell', { name: 'Opening Balance', exact: true })).toBeVisible()

    await security.setPersona('noPets')
    const reads = recordRequests(page)
    await open(page, '/app/securityLedger')
    await expect(denied(page)).toHaveText('You do not have permission to view Security Ledger records.')
    const nav = await navigation(page)
    await expect(nav.getByRole('link', { name: 'Security Ledger', exact: true }).first()).toBeVisible()
    await open(page, '/app/securityLedger/1')
    await expect(denied(page)).toHaveText('You do not have permission to view Security Ledger records.')
    await open(page, '/app/securityLedger/create')
    await expect(denied(page)).toHaveText('You do not have permission to create Security Ledger records.')
    await open(page, '/app/securityLedger/1/edit')
    await expect(denied(page)).toHaveText('You do not have permission to edit Security Ledger records.')
    // field metadata of a disabled table is public to the user; its records are not requested
    expect(reads.filter((url) => /\/data\/securityLedger|\/table\/securityLedger\//.test(url))).toEqual([])

    expect((await security.api.post('/qqq/v1/table/securityLedger/query', { data: {} })).status()).toBe(403)
    expect((await security.api.get('/data/securityLedger/1')).status()).toBe(403)
    expect((await security.api.post('/data/securityLedger', { multipart: { entryName: 'Forged', amount: '1' } })).status()).toBe(403)
    expect((await security.api.put('/data/securityLedger/1', { multipart: { entryName: 'Forged' } })).status()).toBe(403)
    expect(await security.sql('select id, entry_name from security_ledger order by id')).toEqual([
      { id: '1', entry_name: 'Opening Balance' }, { id: '2', entry_name: 'Quarterly Fee' },
    ])
  })
})

test.describe('disabled process (DenyBehavior.DISABLED)', () => {
  test('[SEC-008] admin runs the audit and it writes one row', async ({ page, security, diagnostics }) => {
    void diagnostics
    await open(page, '/app/securityAudit')
    await expect(page.getByText('Audit by sample:alice')).toBeVisible()
    expect(await security.sql('select message from security_audit_log')).toEqual([{ message: 'Audit by sample:alice' }])
  })

  test.describe('viewer', () => {
    test.use({ persona: 'viewer' })

    test('[SEC-008] the audit is shown disabled, its link never starts it and the backend refuses it', async ({ page, security, diagnostics }) => {
      void diagnostics
      const reads = recordRequests(page)
      await open(page, '/app/securityApp')
      const tile = page.locator('[data-qqq-id="app-section-process-securityAudit"]')
      await expect(tile).toHaveAttribute('aria-disabled', 'true')
      await expect(tile).not.toHaveAttribute('href', /.*/)
      await expect(page.locator('[data-qqq-id="app-section-table-securityVault"]')).toHaveAttribute('href', /\/app\/securityVault/)

      await open(page, '/app/securityAudit')
      await expect(denied(page)).toHaveText('You do not have permission to run Security Audit.')
      expect(reads.filter((url) => /\/processes\//.test(url))).toEqual([])

      expect((await security.api.post('/processes/securityAudit/init')).status()).toBe(403)
      expect((await security.api.post('/qqq/v1/processes/securityAudit/init', { data: {} })).status()).toBe(403)
      expect(await security.sql('select count(*) as n from security_audit_log')).toEqual([{ n: '0' }])
    })
  })
})

test.describe('widget restrictions', () => {
  test('[SEC-009] admin sees every security widget with its content', async ({ page, security, diagnostics }) => {
    void diagnostics
    void security
    await open(page, '/app/securityApp')
    await expect(page.getByText('Bulletin for every user')).toBeVisible()
    await expect(page.getByText('Pet-only secret content')).toBeVisible()
    await expect(page.getByText('Pet-only disabled content')).toBeVisible()
  })

  test.describe('noPets', () => {
    test.use({ persona: 'noPets' })

    test('[SEC-009] hidden widgets are absent, disabled widgets explain the denial and load no data', async ({ page, security, diagnostics }) => {
      void diagnostics
      const reads = recordRequests(page)
      await open(page, '/app/securityApp')
      await expect(page.getByText('Bulletin for every user')).toBeVisible()
      await expect(page.getByText('Pet Secrets', { exact: true })).toHaveCount(0)
      await expect(page.getByText('Pet-only secret content')).toHaveCount(0)
      await expect(page.getByText('Pet Disabled Secrets')).toBeVisible()
      await expect(page.locator('[data-qqq-id="widget-permission-denied-securityPetDisabledWidget"]')).toHaveText('You do not have permission to view this data.')
      await expect(page.getByText('Pet-only disabled content')).toHaveCount(0)
      expect(reads.filter((url) => /securityPet/.test(url))).toEqual([])

      expect((await security.api.get('/widget/securityPetWidget')).status()).toBe(403)
      expect((await security.api.get('/widget/securityPetDisabledWidget')).status()).toBe(403)
    })
  })
})

test.describe('app restrictions', () => {
  test('[SEC-010] admin sees both pet apps; noPets loses the hidden one and keeps the disabled one gated', async ({ page, security, diagnostics }) => {
    void diagnostics
    await open(page, '/app/securityApp')
    let nav = await navigation(page)
    await expect(nav.getByRole('link', { name: 'Pet Vault App', exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Pet Disabled App', exact: true })).toBeVisible()

    await security.setPersona('noPets')
    const reads = recordRequests(page)
    await open(page, '/app/securityApp')
    nav = await navigation(page)
    await expect(nav.getByRole('link', { name: 'Security Center', exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Pet Vault App', exact: true })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: 'Pet Disabled App', exact: true })).toBeVisible()

    await open(page, '/app/securityPetApp')
    await expect(page.locator('[data-qqq-id="not-found-state"]', { hasText: 'securityPetApp' })).toBeVisible()
    await open(page, '/app/securityPetDisabledApp')
    await expect(page.locator('[data-qqq-id="app-section-table-securityLedger"]')).toHaveAttribute('aria-disabled', 'true')
    expect(reads.filter((url) => /securityLedger/.test(url))).toEqual([])
  })
})

test.describe('record security lock', () => {
  test('[SEC-012] alice sees and edits only her notes', async ({ page, security, diagnostics }) => {
    void diagnostics
    await open(page, '/app/securityNote')
    const notes = grid(page, 'Security Note')
    await expect(notes.getByRole('gridcell', { name: 'Alice Plan', exact: true })).toBeVisible()
    await expect(notes.getByRole('gridcell', { name: 'Alice Budget', exact: true })).toBeVisible()
    await expect(notes.getByRole('gridcell', { name: 'Bob Memo', exact: true })).toHaveCount(0)
    await expect(page.locator('[data-qqq-id^="grid-row-"]')).toHaveCount(2)

    await open(page, '/app/securityNote/1/edit')
    const title = page.getByRole('textbox', { name: 'Title' })
    await expect(title).toHaveValue('Alice Plan')
    await title.fill('Alice Plan v2')
    await page.getByRole('button', { name: /^Save/ }).click()
    await expect(page).toHaveURL(/\/app\/securityNote\/1\/?$/)
    expect(await security.sql('select title, owner_id from security_note where id = 1')).toEqual([{ title: 'Alice Plan v2', owner_id: 'sample:alice' }])
  })

  test.describe('bob', () => {
    test.use({ user: 'bob' })

    test("[SEC-012] bob cannot list, open, change, delete or forge alice's notes", async ({ page, security, diagnostics }) => {
      diagnostics.allow('/data/securityNote/1 404')
      diagnostics.allow('status of 404')
      await open(page, '/app/securityNote')
      const notes = grid(page, 'Security Note')
      await expect(notes.getByRole('gridcell', { name: 'Bob Memo', exact: true })).toBeVisible()
      await expect(page.locator('[data-qqq-id^="grid-row-"]')).toHaveCount(1)
      await expect(notes.getByText('Alice Plan')).toHaveCount(0)

      await open(page, '/app/securityNote/1')
      await expect(page.locator('[data-qqq-id="record-view-not-found-securityNote"]')).toContainText('Record Not Found')
      await expect(page.getByText('Alice private plan')).toHaveCount(0)

      expect((await security.api.get('/data/securityNote/1')).status()).toBe(404)
      const update = await security.api.put('/data/securityNote/1', { multipart: { title: 'Taken by Bob' } })
      expect(update.ok()).toBe(false)
      // the legacy delete reports per-record failures in a 200 body
      const removal = await security.api.delete('/data/securityNote/1')
      expect(await removal.json()).toMatchObject({ deletedRecordCount: 0, recordsWithErrors: [{ errors: [{ message: 'No record was found to delete for Id = 1' }] }] })
      const forged = await security.api.post('/data/securityNote', { multipart: { title: 'Forged', body: 'x', ownerId: 'sample:alice' } })
      expect(forged.ok()).toBe(false)
      expect(await forged.text()).toContain('You do not have permission to insert a record with a value of sample:alice')
      expect(await security.sql('select id, title, owner_id from security_note order by id')).toEqual([
        { id: '1', title: 'Alice Plan', owner_id: 'sample:alice' },
        { id: '2', title: 'Alice Budget', owner_id: 'sample:alice' },
        { id: '3', title: 'Bob Memo', owner_id: 'sample:bob' },
      ])
    })
  })
})

test.describe('protected fields', () => {
  // never sent to the browser at all
  const SECRETS = ['hidden-note-7f3a', 'vault-secret-1234']
  // heavy values may be fetched for a single record, never by list queries
  const HEAVY = ['heavy-payload-9c2e', Buffer.from('heavy-payload-9c2e').toString('base64')]

  test('[SEC-013] hidden, password and heavy values never reach the list or record view', async ({ page, security, diagnostics }) => {
    void diagnostics
    const bodies: { url: string; body: string }[] = []
    page.on('response', async (response) => {
      if (/securityVault/.test(response.url()) && response.request().resourceType() !== 'document') {
        try { bodies.push({ url: response.url(), body: await response.text() }) } catch { /* redirected or aborted */ }
      }
    })
    await open(page, '/app/securityVault')
    const vault = grid(page, 'Security Vault')
    await expect(vault.getByRole('gridcell', { name: 'Primary Vault', exact: true })).toBeVisible()
    await expect(vault.getByRole('columnheader', { name: /Vault Note/ })).toHaveCount(0)
    await expect(vault.locator('td[data-qqq-id="grid-cell-accessCode"]')).toHaveText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022')

    await open(page, '/app/securityVault/1')
    await expect(page.getByRole('heading', { name: 'Primary Vault' }).first()).toBeVisible()
    await expect(page.getByText('Vault Note')).toHaveCount(0)
    const masked = /^(\u2022{8}|\*{12})$/
    const revealValue = page.locator('[data-qqq-id="field-value-revealCode"]').first()
    await expect(revealValue).toHaveText(masked)
    // only the REVEAL password can be shown; the masked one has nothing to reveal
    await expect(page.getByRole('button', { name: /^Show Access Code$/ })).toHaveCount(0)
    await page.getByRole('button', { name: /^Show (Reveal Code|value)$/ }).first().click()
    await expect(page.getByText('reveal-5678', { exact: true }).first()).toBeVisible()
    const accessValues = page.locator('[data-qqq-id="field-value-accessCode"]')
    await expect(accessValues.first()).toHaveText(masked)

    const html = await page.content()
    for (const secret of SECRETS) expect(html).not.toContain(secret)
    expect(bodies.some(({ url }) => /\/table\/securityVault\/query/.test(url))).toBe(true)
    for (const { body } of bodies) for (const secret of SECRETS) expect(body).not.toContain(secret)
    for (const { url, body } of bodies.filter(({ url }) => /\/table\/securityVault\/query/.test(url))) {
      for (const heavy of HEAVY) expect(body, url).not.toContain(heavy)
    }

    const record = await (await security.api.get('/data/securityVault/1')).json() as { values: Record<string, unknown> }
    expect(record.values.vaultNote).toBeUndefined()
    expect(record.values.accessCode).toBe('************')
    expect(record.values.revealCode).toBe('reveal-5678')
  })

  test('[SEC-013] editing another field keeps the stored password, hidden and heavy values', async ({ page, security, diagnostics }) => {
    void diagnostics
    await open(page, '/app/securityVault/1/edit')
    const label = page.getByRole('textbox', { name: 'Label' })
    await expect(label).toHaveValue('Primary Vault')
    expect(await page.content()).not.toContain('vault-secret-1234')
    await expect(page.getByLabel('Vault Note')).toHaveCount(0)
    await label.fill('Primary Vault v2')
    await page.getByRole('button', { name: /^Save/ }).click()
    await expect(page).toHaveURL(/\/app\/securityVault\/1\/?$/)
    expect(await security.sql("select label, vault_note, access_code, reveal_code, payload from security_vault where id = 1")).toEqual([{
      label: 'Primary Vault v2', vault_note: 'hidden-note-7f3a', access_code: 'vault-secret-1234', reveal_code: 'reveal-5678',
      payload: Buffer.from('heavy-payload-9c2e').toString('base64'),
    }])
  })
})

test.describe('capability restrictions', () => {
  test('[SEC-014] a table without insert/update/delete capabilities offers none of them and refuses them', async ({ page, security, diagnostics }) => {
    void diagnostics
    await open(page, '/app/securityArchive')
    await expect(grid(page, 'Security Archive').getByRole('gridcell', { name: 'Archived Contract', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create new Security Archive record' })).toHaveCount(0)
    await open(page, '/app/securityArchive/1')
    await expect(page.getByRole('heading', { name: 'Archived Contract' }).first()).toBeVisible()
    for (const action of ['Edit', 'Delete', 'Copy']) {
      await expect(page.getByRole('button', { name: `${action} Security Archive record` })).toHaveCount(0)
    }
    await open(page, '/app/securityArchive/create')
    await expect(denied(page)).toHaveText('Security Archive records cannot be created.')
    await open(page, '/app/securityArchive/1/edit')
    await expect(denied(page)).toHaveText('Security Archive records cannot be edited.')

    expect((await security.api.post('/data/securityArchive', { multipart: { title: 'Forged' } })).ok()).toBe(false)
    expect((await security.api.put('/data/securityArchive/1', { multipart: { title: 'Changed' } })).ok()).toBe(false)
    expect((await security.api.delete('/data/securityArchive/1')).ok()).toBe(false)
    expect(await security.sql('select id, title from security_archive')).toEqual([{ id: '1', title: 'Archived Contract' }])
  })
})
