/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, test } from '../../support/fixtures'
import { advance, choosePossibleValue, openProcess, screen, viewValue } from './process-helpers'

test('[PRC-068] process country/state/city inputs share metadata, cascade clears, and submit the chosen city @mobile', async ({ page, backend, diagnostics }) => {
  void backend
  void diagnostics
  await openProcess(page, 'placeAddressPick')
  const state = page.getByRole('combobox', { name: 'State / province', exact: true })
  const city = page.getByRole('combobox', { name: 'City', exact: true })
  await expect(state).toHaveAttribute('aria-disabled', 'true')
  await expect(state).toHaveAccessibleDescription('Choose Country first')
  await expect(city).toHaveAccessibleDescription('Choose State / province first')
  await choosePossibleValue(page, 'Country', 'USA')
  await choosePossibleValue(page, 'State / province', 'Illinois')
  await choosePossibleValue(page, 'City', 'Chester')
  await choosePossibleValue(page, 'Country', 'Canada')
  await expect(page.locator('[data-qqq-id="contingent-cleared-stateId"]')).toBeVisible()
  await expect(page.locator('[data-qqq-id="contingent-cleared-cityId"]')).toBeVisible()
  await expect(city).toHaveAttribute('aria-disabled', 'true')
  await choosePossibleValue(page, 'State / province', 'Quebec')
  await city.click()
  const options = page.getByRole('listbox', { name: 'City options' }).getByRole('option')
  await expect(options).toHaveCount(2)
  expect((await options.allTextContents()).sort()).toEqual(['Montreal', 'Quebec City'])
  await page.getByRole('option', { name: 'Montreal', exact: true }).click()
  await advance(page, 'Submit')
  await expect(viewValue(screen(page, 'result'), 'chosenCityName')).toHaveText('Montreal')
})
