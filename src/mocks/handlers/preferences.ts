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

/** @file Stateful MSW preferences endpoints; rejects unknown or locked writes atomically. */
import { http, HttpResponse } from 'msw'
import type { PreferenceSectionPatch, PreferenceActionRequest } from '@/types/preferences'
import { preferencesFixture } from '../fixtures/preferences'

let state = structuredClone(preferencesFixture)

/** Restores preference mock values between tests. */
export function resetPreferencesMock() {
  state = structuredClone(preferencesFixture)
}

export const preferencesHandlers = [
  http.post('/qqq/v1/preferences/:sectionName/actions/:actionName', async ({ params, request }) => {
    const section = state.sections.find((item) => item.name === params.sectionName)
    const action = section?.actions?.find((item) => item.name === params.actionName)
    if (!section || !action)
      return HttpResponse.json({ error: 'Action not found' }, { status: 404 })
    const body = (await request.json()) as PreferenceActionRequest
    const errors = Object.keys(body)
      .filter((key) => key !== 'rowKey' && key !== 'values')
      .map((key) => `Unexpected property: ${key}`)
    const list = section.lists.find((item) => item.name === action.listName) ?? section.lists[0]
    const row = list?.rows.find((item) => item.key === body.rowKey)
    if (
      action.scope === 'ROW' &&
      (!row || (row.actionNames != null && !row.actionNames.includes(action.name)))
    )
      errors.push("This action isn't available for this token.")
    if (action.scope !== 'ROW' && body.rowKey !== undefined)
      errors.push('Unexpected property: rowKey')
    for (const field of action.inputFields ?? []) {
      if (field.isRequired && !body.values?.[field.name]) errors.push(`${field.label}: is required`)
    }
    if (errors.length) return HttpResponse.json({ errors }, { status: 400 })
    if (action.name === 'revoke') {
      list.rows = list.rows.filter((item) => item.key !== body.rowKey)
      return HttpResponse.json(
        { section, message: 'Token revoked.', secrets: [] },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }
    const key = row?.key ?? crypto.randomUUID()
    if (action.name === 'create')
      list.rows.push({
        key,
        label: String(body.values?.description),
        values: { ...body.values, lastUsedAt: null },
        actionNames: ['rotate', 'revoke'],
      })
    // Demo-only value is generated per response and never added to mock preference state.
    const value = `demo_only_${crypto.randomUUID()}`
    return HttpResponse.json(
      {
        section,
        message: 'Token ready.',
        focusRowKey: key,
        secrets: [
          {
            label: 'Access token',
            value,
            masked: `demo_only_…${value.slice(-4)}`,
            usageText: `curl -H "Authorization: Bearer ${value}" https://example.test/qqq/v1/metaData`,
          },
        ],
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }),
  http.get('/qqq/v1/preferences', () => HttpResponse.json(state)),
  http.get('/qqq/v1/preferences/:sectionName', ({ params }) => {
    const section = state.sections.find((section) => section.name === params.sectionName)
    return section
      ? HttpResponse.json(section)
      : HttpResponse.json({ error: 'Preference section not found' }, { status: 404 })
  }),
  http.patch('/qqq/v1/preferences/:sectionName', async ({ params, request }) => {
    const section = state.sections.find((section) => section.name === params.sectionName)
    if (!section)
      return HttpResponse.json({ error: 'Preference section not found' }, { status: 404 })
    const patch = (await request.json()) as PreferenceSectionPatch
    const errors: string[] = Object.keys(patch)
      .filter((key) => key !== 'values' && key !== 'lists')
      .map((key) => `Unknown property: ${key}`)
    for (const name of Object.keys(patch.values ?? {})) {
      if (!section.fields.some((field) => field.name === name && field.isEditable))
        errors.push(`Unknown or read-only field: ${name}`)
    }
    for (const [name, rows] of Object.entries(patch.lists ?? {})) {
      const list = section.lists.find((list) => list.name === name)
      if (!list) {
        errors.push(`Unknown list: ${name}`)
        continue
      }
      for (const change of rows) {
        const row = list.rows.find((row) => row.key === change.key)
        if (!row) {
          errors.push(`Unknown row: ${change.key}`)
          continue
        }
        for (const fieldName of Object.keys(change.values)) {
          if (row.readOnlyFields?.includes(fieldName))
            errors.push(row.readOnlyReason || `${fieldName} is read only`)
          else if (!list.fields.some((field) => field.name === fieldName && field.isEditable))
            errors.push(`Unknown or read-only field: ${fieldName}`)
        }
      }
    }
    if (errors.length)
      return HttpResponse.json({ error: errors.join('\n'), errors }, { status: 400 })
    Object.assign(section.values, patch.values)
    for (const [name, rows] of Object.entries(patch.lists ?? {})) {
      const list = section.lists.find((list) => list.name === name)!
      for (const change of rows)
        Object.assign(list.rows.find((row) => row.key === change.key)!.values, change.values)
    }
    return HttpResponse.json(section)
  }),
]
