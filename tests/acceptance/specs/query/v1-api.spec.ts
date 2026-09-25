/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { readFileSync } from 'node:fs'
import type { Request } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { expectColumn, sqlColumn } from './query-helpers'

test('[QRY-065] export streams from the v1 export route and the route enforces the export capability', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const exports: Request[] = []
  page.on('request', (request) => { if (/\/export(\/|$)/.test(new URL(request.url()).pathname)) exports.push(request) })
  await open(page, '/app/qryItem')
  await expectColumn(page, 'id', await sqlColumn(backend, 'select id from qry_item order by id desc'))
  await page.getByRole('button', { name: 'Export records' }).click()
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /^Export CSV/ }).click(),
  ])
  const lines = readFileSync((await file.path())!, 'utf8').trim().split(/\r?\n/)
  expect(lines.length - 1).toBe((await sqlColumn(backend, 'select id from qry_item')).length)

  // The page used the v1 route with a JSON body naming the format, file and columns.
  expect(exports.map((request) => `${request.method()} ${new URL(request.url()).pathname}`)).toEqual(['POST /qqq/v1/table/qryItem/export'])
  const body = exports[0].postDataJSON()
  expect(body).toMatchObject({ format: 'csv', filename: file.suggestedFilename() })
  expect(body.fieldNames).toContain('id')

  // The v1 route streams the same rows, and refuses a table whose export capability is off.
  const direct = await backend.api.post('/qqq/v1/table/qryItem/export', { data: { format: 'csv', fieldNames: ['id'] } })
  expect(direct.status()).toBe(200)
  expect(direct.headers()['content-type']).toContain('text/csv')
  expect((await direct.text()).trim().split(/\r?\n/).length - 1).toBe(lines.length - 1)
  const refused = await backend.api.post('/qqq/v1/table/qryLedger/export', { data: { format: 'csv' } })
  expect(refused.status()).toBe(403)
})
