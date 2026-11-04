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

import { describe, expect, it } from 'vitest'
import { attachmentRecoveryView } from './attachment-recovery-view'

const descriptor = {
  tableName: 'owner_upload_history', label: 'Review interrupted uploads',
  filter: { booleanOperator: 'AND', criteria: [
    { fieldName: 'createdByUserId', operator: 'EQUALS', values: [{ type: 'CurrentUser' }] },
    { fieldName: 'state', operator: 'IN', values: ['PREPARED', 'REGISTERED'] },
  ] },
}
describe('attachmentRecoveryView', () => {
  it('keeps server actor/status criteria and adds literal source identity pins', () => {
    const source = { table: 'purchase/order', pk: 'a & b/#雪' }
    const link = attachmentRecoveryView(descriptor, source)!
    const url = new URL(link.href, 'https://app.example')
    expect(url.pathname).toBe('/app/owner_upload_history')
    expect(link.label).toBe(descriptor.label)
    expect(JSON.parse(url.searchParams.get('filter')!)).toEqual({ booleanOperator: 'AND', criteria: [
      ...descriptor.filter.criteria,
      { fieldName: 'tableName', operator: 'EQUALS', values: [source.table] },
      { fieldName: 'recordId', operator: 'EQUALS', values: [source.pk] },
    ] })
  })
  it('does not show recovery navigation on ordinary installations or malformed metadata', () => {
    for (const metadata of [undefined, null, {}, { ...descriptor, tableName: '../outside' }, { ...descriptor, label: '' },
      { ...descriptor, filter: {} }, { ...descriptor, filter: { ...descriptor.filter, booleanOperator: 'OR' } },
      { ...descriptor, filter: { ...descriptor.filter, criteria: [{ fieldName: 'id', operator: 'EQUALS', values: [{ type: 'Unexpected' }] }] } },
      { ...descriptor, filter: { ...descriptor.filter, criteria: [{ fieldName: 'state', operator: 'EQUALS', values: [{ type: 'CurrentUser' }] }] } },
      { ...descriptor, filter: { ...descriptor.filter, criteria: [{ fieldName: 'createdByUserId', operator: 'IN', values: [{ type: 'CurrentUser' }] }] } },
      { ...descriptor, filter: { ...descriptor.filter, subFilterSetOperator: 'UNION' } }]) {
      expect(attachmentRecoveryView(metadata, { table: 'orders', pk: '1' })).toBeNull()
    }
  })
})
