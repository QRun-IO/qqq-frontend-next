/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'

test('[NAV-001] direct table link lists the seeded people', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/person')
  const grid = page.getByRole('grid', { name: 'Person records' })
  await expect(grid.getByRole('gridcell', { name: 'Avery', exact: true })).toBeVisible()
  const rows = await backend.sql('select count(*) as n from person')
  await expect(page.locator('[data-qqq-id^="grid-row-"]')).toHaveCount(Number(rows[0].n))
})
