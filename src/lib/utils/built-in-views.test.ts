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
import { builtInViewHref } from './built-in-views'
import { prepFilterForBackend, deserializeFilter, describeExpression } from './filter-utils'
import { recordVersion } from './record-version'
import { qInstance } from '@/mocks/fixtures/q-instance'
it('round-trips CurrentUser unchanged through built-in view URLs and backend preparation', () => {
  const filter = qInstance.tables.person.builtInViews![0].filter
  const url = new URL(builtInViewHref('person', filter), 'https://example.test')
  const parsed = deserializeFilter(url.searchParams.get('filter')!, 25)
  expect(prepFilterForBackend(parsed, () => undefined).criteria[0].values).toEqual([
    { type: 'CurrentUser' },
  ])
  expect(describeExpression({ type: 'CurrentUser' })).toBe('Me')
})
it('uses the loaded version field and honors a table opt-out', () => {
  const record = { tableName: 'person', values: { modifyDate: 'old', revision: 4 } }
  expect(recordVersion(qInstance.tables.person, record)).toBe('old')
  expect(
    recordVersion({ ...qInstance.tables.person, recordVersionField: 'revision' }, record)
  ).toBe('4')
  expect(
    recordVersion({ ...qInstance.tables.person, recordVersionField: '' }, record)
  ).toBeUndefined()
})
