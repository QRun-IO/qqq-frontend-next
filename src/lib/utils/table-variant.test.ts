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

import { afterEach, describe, expect, it } from 'vitest'
import type { QTableMetaData } from '@/types'
import { storedRecordVariantJson } from './table-variant'

afterEach(() => window.localStorage.clear())

describe('storedRecordVariantJson', () => {
  it('sends only type and id for a table that declares variants', () => {
    window.localStorage.setItem('qqq.tableVariant.stock', JSON.stringify({ type: 'store', id: '2', name: 'South' }))
    const table = { name: 'stock', usesVariants: true } as QTableMetaData
    expect(storedRecordVariantJson(table)).toBe('{"type":"store","id":"2"}')
    expect(storedRecordVariantJson({ ...table, usesVariants: false })).toBeUndefined()
    expect(storedRecordVariantJson(undefined)).toBeUndefined()
  })
})
