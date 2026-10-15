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

import { afterEach, describe, expect, it, vi } from 'vitest'

import apiClient from './client'
import { runFormAdjuster } from './form-adjuster'

describe('runFormAdjuster (QRun-IO/qqq#720)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('posts the event, field, new value and all values as JSON to the table adjuster route', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ updatedFieldValues: { total: 5 } })
    const output = await runFormAdjuster('lab', 'lab:size', 'onChange', { fieldName: 'size', newValue: 3, allValues: { size: 3, note: null, file: new File(['x'], 'x.txt') } })
    expect(output).toEqual({ updatedFieldValues: { total: 5 } })
    const [url, body] = post.mock.calls[0]
    expect(url).toBe('/table/lab/formAdjuster/lab%3Asize/onChange')
    expect(body).toEqual({ fieldName: 'size', newValue: 3, allValues: { size: 3, note: null } })
  })

  it('sends a cleared value as null and leaves the field out for a table on-load adjuster', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
    await runFormAdjuster('lab', 'lab:size', 'onChange', { fieldName: 'size', newValue: null, allValues: {} })
    expect(post.mock.calls[0][1]).toEqual({ fieldName: 'size', newValue: null, allValues: {} })
    await runFormAdjuster('lab', 'table:lab', 'onLoad', { allValues: { a: 1 } })
    const onLoad = post.mock.calls[1][1]
    expect(post.mock.calls[1][0]).toBe('/table/lab/formAdjuster/table%3Alab/onLoad')
    expect(onLoad).toEqual({ allValues: { a: 1 } })
  })

  it.each([false, ['a', 'b'], { count: 2 }].map((newValue) => ({ newValue })))('preserves JSON newValue $newValue', async ({ newValue }) => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
    await runFormAdjuster('lab data', 'lab:size', 'onChange', { fieldName: 'size', newValue, allValues: { size: newValue } })
    expect(post).toHaveBeenCalledWith('/table/lab%20data/formAdjuster/lab%3Asize/onChange', {
      fieldName: 'size', newValue, allValues: { size: newValue },
    })
  })

  it('returns every effect of the output and drops absent ones', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({
      updatedFieldMetaData: { note: { name: 'note', label: 'Notes', isHidden: true } },
      updatedFieldValues: null,
      updatedFieldDisplayValues: { ownerId: 'Ada', other: null },
      fieldsToClear: ['code'],
      updatedSectionMetaData: { extra: { name: 'extra', label: 'Extra', isHidden: false, fieldNames: ['note'] } },
      isFormDisabled: true,
      formDisabledMessage: 'Closed for edits',
    })
    const output = await runFormAdjuster('lab', 'table:lab', 'onLoad', { allValues: {} })
    expect(output).toEqual({
      updatedFieldMetaData: { note: { name: 'note', label: 'Notes', isHidden: true } },
      updatedFieldDisplayValues: { ownerId: 'Ada', other: '' },
      fieldsToClear: ['code'],
      updatedSectionMetaData: { extra: { name: 'extra', label: 'Extra', isHidden: false, fieldNames: ['note'] } },
      isFormDisabled: true,
      formDisabledMessage: 'Closed for edits',
    })
  })

  it('rejects a response that is not an adjuster output', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({ fieldsToClear: 'code' })
    await expect(runFormAdjuster('lab', 'table:lab', 'onLoad', { allValues: {} })).rejects.toThrow('Invalid form adjuster response')
  })
})
