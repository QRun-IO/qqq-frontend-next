/*
 * Copyright 2026 QRun.IO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import {
  analysisSql,
  exportAnalysis,
  exportSavedAnalysis,
  listSavedAnalyses,
  previewWatch,
  runSavedAnalysis,
  starAnalysis,
} from './data-analysis'
const root = '*/qqq/v1/qbit/data-analysis'
it('uses the saved, star, SQL and watch 1.4.0 routes and verbs', async () => {
  server.use(
    http.get(`${root}/saved`, () => HttpResponse.json({ analyses: [{ id: 7, starred: false }] })),
    http.post(`${root}/saved/7/run`, () =>
      HttpResponse.json({ kind: 'TABLE_PROFILE', tableProfile: {} })
    ),
    http.put(`${root}/saved/7/star`, () => HttpResponse.json({ starred: true })),
    http.delete(`${root}/saved/7/star`, () => HttpResponse.json({ starred: false })),
    http.post(`${root}/watches/9/preview`, () => HttpResponse.json({ verdict: { message: 'OK' } })),
    http.post(`${root}/tables/person/sql`, async ({ request }) => {
      expect(await request.json()).toEqual({ kind: 'TABLE_PROFILE', request: {} })
      return HttpResponse.json({ available: true, sql: 'SELECT COUNT(*) FROM person' })
    })
  )
  expect((await listSavedAnalyses()).analyses).toHaveLength(1)
  expect((await runSavedAnalysis('7')).kind).toBe('TABLE_PROFILE')
  expect(await starAnalysis('7', true)).toEqual({ starred: true })
  expect(await starAnalysis('7', false)).toEqual({ starred: false })
  expect((await previewWatch('9')).verdict?.message).toBe('OK')
  expect((await analysisSql('person', { kind: 'TABLE_PROFILE', request: {} })).available).toBe(true)
})
it('receives file bodies for both saved and ad hoc exports', async () => {
  server.use(
    http.post(`${root}/export`, async ({ request }) => {
      expect(await request.json()).toEqual({
        kind: 'TABLE_PROFILE',
        tableName: 'person',
        request: {},
        format: 'csv',
      })
      return new HttpResponse('count\n42', { headers: { 'Content-Type': 'text/csv' } })
    }),
    http.get(`${root}/saved/7/export`, ({ request }) => {
      expect(new URL(request.url).searchParams.get('format')).toBe('xlsx')
      return new HttpResponse(new Uint8Array([80, 75, 3, 4]), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      })
    })
  )
  expect(
    await exportAnalysis({ kind: 'TABLE_PROFILE', tableName: 'person', request: {}, format: 'csv' })
  ).toBeInstanceOf(Blob)
  expect(await exportSavedAnalysis('7', 'xlsx')).toBeInstanceOf(Blob)
})
