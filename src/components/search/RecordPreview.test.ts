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

import { describe, it, expect } from 'vitest'

import type { QFieldMetaData, QTableMetaData } from '@/types'
import { previewFields } from './RecordPreview'

/** A field for the fixture. */
const field = (name: string, extra: Partial<QFieldMetaData> = {}) => ({ name, label: name, type: 'STRING', adornments: [], ...extra }) as unknown as QFieldMetaData

describe('previewFields', () => {
  it('shows the first-tier fields but never the key, heavy fields, secrets, widgets, code, HTML or binary data', () => {
    const fields = {
      id: field('id', { type: 'INTEGER' }),
      name: field('name'),
      apiKey: field('apiKey', { adornments: [{ type: 'REVEAL' }] } as Partial<QFieldMetaData>),
      chart: field('chart', { adornments: [{ type: 'WIDGET' }] } as Partial<QFieldMetaData>),
      script: field('script', { adornments: [{ type: 'CODE_EDITOR' }] } as Partial<QFieldMetaData>),
      body: field('body', { type: 'HTML' } as Partial<QFieldMetaData>),
      blob: field('blob', { type: 'BLOB' } as Partial<QFieldMetaData>),
      notes: field('notes', { isHeavy: true }),
      status: field('status'),
      other: field('other'),
    }
    const table = {
      name: 'thing',
      primaryKeyField: 'id',
      fields,
      sections: [{ name: 'identity', tier: 'T1', fieldNames: ['id', 'name', 'apiKey', 'chart', 'script', 'body', 'blob', 'notes', 'status'] }, { name: 'more', tier: 'T2', fieldNames: ['other'] }],
    } as unknown as QTableMetaData
    expect(previewFields(table).map((f) => f.name)).toEqual(['name', 'status'])
  })
})
