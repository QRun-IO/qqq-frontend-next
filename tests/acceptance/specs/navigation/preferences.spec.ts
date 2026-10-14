/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { expectNoHorizontalScroll } from '../../support/touch'
import { appNavigation } from './nav-helpers'
import { checkA11y } from '../../../e2e/a11y-helpers'

test('[NAV-057] regional preferences save from the user menu and persist after reload @mobile', async ({ page, backend, diagnostics }) => {
  void backend; void diagnostics
  await open(page, '/app/person')
  await appNavigation(page)
  await page.locator('[data-qqq-id="sidebar"]:visible [data-qqq-id="sidebar-user-button"]').click()
  await page.getByRole('menuitem', { name: 'Preferences', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/preferences\/?$/)
  await expect(page.getByRole('heading', { name: 'Display', exact: true })).toBeVisible()
  const select = page.locator('[data-qqq-id="preferences-section-select"]')
  if (await select.isVisible()) await select.selectOption('regional')
  else await page.locator('[data-qqq-id="preferences-section-nav-regional"]').click()
  await expect(page.getByRole('heading', { name: 'Regional settings', exact: true })).toBeVisible()
  const weekStart = page.getByRole('combobox', { name: /week starts on/i })
  const current = await weekStart.inputValue()
  const next = await weekStart.locator('option').evaluateAll((options, current) => options.map((option) => (option as HTMLOptionElement).value).find((value) => value !== '' && value !== current), current)
  expect(next, 'The sample regional enum must offer at least two week starts').toBeTruthy()
  await weekStart.selectOption(next!)
  const saved = page.waitForResponse((response) => response.url().endsWith('/qqq/v1/preferences/regional') && response.request().method() === 'PATCH')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  expect((await saved).status()).toBe(200)
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
  await page.reload()
  await expect(weekStart).toHaveValue(next!)
  await expectNoHorizontalScroll(page)
  await checkA11y(page)
})

test('[NAV-057] a regional section deep link selects and renders the sample backend metadata @mobile', async ({ page, backend, diagnostics }) => {
  void backend; void diagnostics
  await open(page, '/app/preferences?section=regional')
  await expect(page.getByRole('heading', { name: 'Regional settings', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: /time zone/i })).toBeVisible()
  await expect(page.getByRole('combobox', { name: /date format/i })).toBeVisible()
  await expect(page.getByRole('combobox', { name: /week starts on/i })).toBeVisible()
  await expectNoHorizontalScroll(page)
})
