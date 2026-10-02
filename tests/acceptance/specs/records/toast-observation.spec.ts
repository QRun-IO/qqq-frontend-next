/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */
import { expect, test } from '../../support/fixtures'
import { control, expectToastDuringAction, openForm, sqlCount, toasts } from './helpers'

test('[REC-006] success feedback is observed when action delivery returns after dismissal @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openForm(page, '/app/person/create', 'Create Person')
  await control(page, 'firstName').fill('Feedback')
  await control(page, 'lastName').fill('Observation')
  await control(page, 'email').fill('feedback@example.invalid')

  await expectToastDuringAction(page, 'Person created successfully.', async () => {
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Feedback Observation' })).toBeVisible()
    // Model the hosted trace/driver delay without extending the product notification lifetime.
    await expect(toasts(page)).toHaveCount(0)
  }, true)

  expect(await sqlCount(backend, "select count(*) as n from person where email = 'feedback@example.invalid'")).toBe(1)
})
