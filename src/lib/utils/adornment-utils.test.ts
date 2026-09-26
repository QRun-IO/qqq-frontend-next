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
import { AxiosError, AxiosHeaders } from 'axios'

import type { FieldAdornment, QFieldMetaData, QRecord } from '@/types'
import { attachmentUrl, chipStyle, fileDownload, linkTarget, sizeWidth, tooltipText } from './adornment-utils'
import { selectHelpContent, EDIT_SCREEN_HELP_ROLES, INSERT_SCREEN_HELP_ROLES, VIEW_SCREEN_HELP_ROLES } from './help-utils'
import { getErrorMessage, recordLoadFailure } from './error-utils'

function field(name: string, adornments: FieldAdornment[], extra: Partial<QFieldMetaData> = {}): QFieldMetaData {
  return { name, label: name, type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments, ...extra }
}

function record(values: Record<string, unknown>, displayValues: Record<string, string> = {}): QRecord {
  return { tableName: 'lab', values, displayValues }
}

describe('adornment-utils (backend value keys)', () => {
  it('resolves LINK targets: static and dynamic record links, http(s) and same-origin URLs only', () => {
    const owner = field('ownerId', [{ type: 'LINK', values: { toRecordFromTable: 'person' } }])
    expect(linkTarget(owner, record({ ownerId: 3 }))).toEqual({ kind: 'record', tableName: 'person', primaryKey: '3' })
    const dynamic = field('refId', [{ type: 'LINK', values: { toRecordFromTableDynamic: true } }])
    expect(linkTarget(dynamic, record({ refId: 9 }, { 'refId:toRecordFromTableDynamic': 'pet' }))).toEqual({ kind: 'record', tableName: 'pet', primaryKey: '9' })
    expect(linkTarget(dynamic, record({ refId: 9 }))).toBeNull()
    const url = field('site', [{ type: 'LINK', values: { target: '_blank' } }])
    expect(linkTarget(url, record({ site: 'https://example.invalid' }))).toEqual({ kind: 'url', href: 'https://example.invalid', external: true, target: '_blank' })
    expect(linkTarget(url, record({ site: '/app/person/1' }))).toMatchObject({ kind: 'url', external: false })
    expect(linkTarget(url, record({ site: 'javascript:alert(1)' }))).toBeNull()
    expect(linkTarget(url, record({ site: '//evil.invalid' }))).toBeNull()
    expect(linkTarget(url, record({ site: null }))).toBeNull()
  })

  it('reads CHIP color.<value> and icon.<value> with a default color', () => {
    const status = field('status', [{ type: 'CHIP', values: { 'color.ACTIVE': 'success', 'icon.ACTIVE': 'check_circle', 'color.OLD': 'not-a-color' } }])
    expect(chipStyle(status, 'ACTIVE')).toEqual({ color: 'success', icon: 'check_circle' })
    expect(chipStyle(status, 'OLD')).toEqual({ color: 'default' })
    expect(chipStyle(status, 'OTHER')).toEqual({ color: 'default' })
  })

  it('uses the backend download URL and file name for FILE_DOWNLOAD values', () => {
    const file = field('attachment', [{ type: 'FILE_DOWNLOAD', values: { fileNameField: 'name' } }], { type: 'BLOB' })
    expect(fileDownload(file, record({ attachment: '/data/lab/1/attachment/a.txt' }, { attachment: 'a.txt' }))).toEqual({ url: '/qqq/v1/table/lab/1/attachment/a.txt', fileName: 'a.txt' })
    expect(fileDownload(file, record({ attachment: '/data/lab/1/attachment/My%20Notes' }))).toEqual({ url: '/qqq/v1/table/lab/1/attachment/My%20Notes', fileName: 'My Notes' })
    // only backend field-download paths move to the v1 route; other URLs are kept
    expect(fileDownload(file, record({ attachment: 'https://files.example/a.txt' }))?.url).toBe('https://files.example/a.txt')
    expect(fileDownload(file, record({ attachment: '/data/lab/1/attachment/a.txt?v=2' }))?.url).toBe('/qqq/v1/table/lab/1/attachment/a.txt?v=2')
    expect(fileDownload(file, record({ attachment: null }))).toBeNull()
    expect(fileDownload(file, record({ attachment: 'aGVsbG8=' }))).toBeNull()
    const dynamic = field('report', [{ type: 'FILE_DOWNLOAD', values: { downloadUrlDynamic: true } }])
    expect(fileDownload(dynamic, record({ report: 'x' }, { report: 'r.pdf', 'report:downloadUrlDynamic': 'https://files.invalid/r.pdf' })))
      .toEqual({ url: 'https://files.invalid/r.pdf', fileName: 'r.pdf' })
    expect(attachmentUrl('/data/lab/1/a/x')).toBe('/data/lab/1/a/x?download=1')
    expect(attachmentUrl('/d?x=1')).toBe('/d?x=1&download=1')
  })

  it('reads TOOLTIP staticText or the dynamic display value, and SIZE widths', () => {
    expect(tooltipText(field('hint', [{ type: 'TOOLTIP', values: { staticText: 'Static' } }]), record({ hint: 'x' }))).toBe('Static')
    const dynamic = field('cron', [{ type: 'TOOLTIP', values: { tooltipDynamic: true } }])
    expect(tooltipText(dynamic, record({ cron: '* * *' }, { 'cron:tooltipDynamic': 'Every minute' }))).toBe('Every minute')
    expect(tooltipText(field('plain', []), record({ plain: 'x' }))).toBeUndefined()
    expect(sizeWidth(field('code', [{ type: 'SIZE', values: { width: 'small' } }]))).toBe(100)
    expect(sizeWidth(field('code', [{ type: 'SIZE', values: { width: 'XLARGE' } }]))).toBe(600)
    expect(sizeWidth(field('code', [{ type: 'SIZE', values: { width: 'huge' } }]))).toBeUndefined()
  })
})

describe('selectHelpContent', () => {
  const entries = [
    { content: 'Read help', roles: ['READ_SCREENS'] },
    { content: 'View help', roles: ['VIEW_SCREEN'] },
    { content: 'Write help', roles: ['WRITE_SCREENS'] },
    { content: 'Insert help', roles: ['INSERT_SCREEN'] },
  ]
  it('prefers the most specific screen role', () => {
    expect(selectHelpContent(entries, VIEW_SCREEN_HELP_ROLES)?.content).toBe('View help')
    expect(selectHelpContent(entries, INSERT_SCREEN_HELP_ROLES)?.content).toBe('Insert help')
    expect(selectHelpContent(entries, EDIT_SCREEN_HELP_ROLES)?.content).toBe('Write help')
  })
  it('applies an entry without roles everywhere and skips empty content', () => {
    expect(selectHelpContent([{ content: 'Everywhere' }], EDIT_SCREEN_HELP_ROLES)?.content).toBe('Everywhere')
    expect(selectHelpContent([{ content: '  ', roles: ['ALL_SCREENS'] }], VIEW_SCREEN_HELP_ROLES)).toBeUndefined()
    expect(selectHelpContent(undefined, VIEW_SCREEN_HELP_ROLES)).toBeUndefined()
  })
})

describe('error messages', () => {
  function axiosError(status: number, data: unknown) {
    return new AxiosError('Request failed with status code ' + status, 'ERR_BAD_REQUEST', undefined, undefined,
      { status, statusText: '', headers: {}, config: { headers: new AxiosHeaders() }, data })
  }
  it('prefers the backend message over the transport message', () => {
    expect(getErrorMessage(axiosError(400, { error: 'Error inserting X: Missing value in required field: Name' }))).toBe('Error inserting X: Missing value in required field: Name')
    expect(getErrorMessage(axiosError(400, { userFacingError: 'Friendly', error: 'Technical' }))).toBe('Friendly')
    expect(getErrorMessage(axiosError(500, 'not json'))).toBe('Request failed with status code 500')
    expect(getErrorMessage(new Error('plain'))).toBe('plain')
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback')
  })
  it('explains record load failures by status', () => {
    expect(recordLoadFailure('Person', '9', axiosError(404, { error: 'x' }))).toBe('Person 9 could not be found.')
    expect(recordLoadFailure('Person', '9', axiosError(403, { error: 'x' }))).toBe('You do not have permission to view Person records')
    expect(recordLoadFailure('Person', '9', axiosError(500, { error: 'Boom' }))).toBe('Boom')
  })
})
