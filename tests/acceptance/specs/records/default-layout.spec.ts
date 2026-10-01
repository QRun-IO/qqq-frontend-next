/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { expectNoSidewaysScroll, isPhone, showSection, shown } from './helpers'

test('[REC-013] copy scope controls align with the editable form @mobile', async ({ page, backend, diagnostics }) => {
  void backend
  void diagnostics
  await open(page, '/app/person/1/copy')
  const form = page.locator('[data-qqq-id="entity-form-person"]')
  await expect(form).toBeVisible()
  for (const mode of ['base', 'full']) {
    await page.locator(`[data-qqq-id="copy-mode-${mode}"]`).check()
    const formBox = (await form.boundingBox())!
    const scopeBox = (await page.getByRole('group', { name: 'Copy scope', exact: true }).boundingBox())!
    expect(Math.abs(scopeBox.x - formBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(scopeBox.width - formBox.width)).toBeLessThanOrEqual(1)
  }
  await expectNoSidewaysScroll(page)
})

test('[REC-004] an unconfigured selected section fills its panel with responsive field columns @mobile', async ({ page, backend, diagnostics }) => {
  void backend
  void diagnostics
  await open(page, '/app/navDeepItem/3')
  await showSection(page, 'Other Fields')
  const code = shown(page, '[data-qqq-id="record-field-code"]')
  const shelf = shown(page, '[data-qqq-id="record-field-shelf"]')
  await expect(code).toContainText('NAV-C3')
  await expect(shelf).toContainText('North')
  const codeBox = (await code.boundingBox())!
  const shelfBox = (await shelf.boundingBox())!
  if (isPhone(page)) {
    expect(shelfBox.y).toBeGreaterThan(codeBox.y)
  } else {
    const panel = page.getByRole('tabpanel').filter({ visible: true })
    const panelBox = (await panel.boundingBox())!
    const sectionBox = (await code.locator('xpath=ancestor::section').boundingBox())!
    expect(panelBox.width - sectionBox.width).toBeLessThanOrEqual(52)
    expect(Math.abs(codeBox.y - shelfBox.y)).toBeLessThanOrEqual(1)
    expect(shelfBox.x).toBeGreaterThanOrEqual(codeBox.x + codeBox.width)
  }
  await expectNoSidewaysScroll(page)
})

for (const mode of ['light', 'dark']) {
  test(`[REC-004] overview fields retain original Next spacing in ${mode} mode`, async ({ page, backend, diagnostics }) => {
    void backend
    void diagnostics
    await page.addInitScript((dark) => localStorage.setItem('qqq-dark-mode', String(dark)), mode === 'dark')
    await open(page, '/app/person/1')
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode)
    const panel = page.getByRole('tabpanel', { name: 'Overview', exact: true })
    const email = panel.locator('[data-qqq-id="record-field-email"]')
    const birthDate = panel.locator('[data-qqq-id="record-field-birthDate"]')
    await expect(email).toContainText('avery@example.invalid')
    await expect(birthDate).toContainText('1990-01-15')
    await expect(email.locator('dd')).toHaveCSS('line-height', '20px')
    const emailBox = (await email.boundingBox())!
    const birthDateBox = (await birthDate.boundingBox())!
    expect(emailBox.height).toBe(42)
    expect(birthDateBox.y - emailBox.y).toBe(58)
    await expectNoSidewaysScroll(page)
  })
}
