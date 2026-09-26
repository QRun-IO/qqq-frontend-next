/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { QRecord, QTableMetaData } from '@/types'
import { deliverRecordFieldFile, recordFieldFile } from './record-download'

const table = {
  name: 'lab', label: 'Lab', primaryKeyField: 'id',
  fields: {
    id: { name: 'id', label: 'Id', type: 'INTEGER', adornments: [] },
    photo: { name: 'photo', label: 'Photo', type: 'BLOB', adornments: [] },
    manual: { name: 'manual', label: 'Manual', type: 'STRING', adornments: [] },
    attachment: { name: 'attachment', label: 'Attachment', type: 'BLOB', adornments: [{ type: 'FILE_DOWNLOAD', values: {} }] },
  },
} as unknown as QTableMetaData
const record = (values: Record<string, unknown>, displayValues: Record<string, string> = {}) =>
  ({ tableName: 'lab', values: { id: 7, ...values }, displayValues }) as QRecord

afterEach(() => vi.restoreAllMocks())

describe('record field file delivery', () => {
  it('names inline blobs from their display value or field metadata', () => {
    expect(recordFieldFile(table, record({ photo: 'Ynl0ZXM=' }, { photo: 'portrait.png' }), 'photo')).toEqual({
      url: 'data:application/octet-stream;base64,Ynl0ZXM=', fileName: 'portrait.png', mode: 'download',
    })
    expect(recordFieldFile(table, record({ photo: 'Ynl0ZXM=' }), 'photo')?.fileName).toBe('Lab 7 Photo')
  })

  it('uses backend file links for download adornments and opens URL fields', () => {
    expect(recordFieldFile(table, record({ attachment: '/data/lab/7/attachment/report.pdf' }), 'attachment')).toEqual({
      url: '/qqq/v1/table/lab/7/attachment/report.pdf?download=1', fileName: 'report.pdf', mode: 'download',
    })
    expect(recordFieldFile(table, record({ manual: 'https://example.invalid/guide.pdf?revision=2' }), 'manual')).toEqual({
      url: 'https://example.invalid/guide.pdf?revision=2', fileName: 'guide.pdf', mode: 'open',
    })
    expect(recordFieldFile(table, record({ manual: '/files/readme.txt' }), 'manual')?.mode).toBe('open')
  })

  it('does not offer missing, non-file or unsafe values as downloads', () => {
    expect(recordFieldFile(table, record({ photo: null }), 'photo')).toBeNull()
    expect(recordFieldFile(table, record({ manual: '//other.invalid/file' }), 'manual')).toBeNull()
    expect(recordFieldFile(table, record({ manual: 'javascript:alert(1)' }), 'manual')).toBeNull()
    expect(recordFieldFile(table, record({ manual: 12 }), 'manual')).toBeNull()
    expect(recordFieldFile(table, record({ id: 7 }), 'missing')).toBeNull()
  })

  it('opens external files without an opener and removes temporary download links', () => {
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null)
    deliverRecordFieldFile({ url: 'https://example.invalid/guide.pdf', fileName: 'guide.pdf', mode: 'open' })
    expect(opened).toHaveBeenCalledWith('https://example.invalid/guide.pdf', '_blank', 'noopener,noreferrer')
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    deliverRecordFieldFile({ url: 'data:application/octet-stream;base64,YQ==', fileName: 'a.bin', mode: 'download' })
    expect(clicked).toHaveBeenCalledOnce()
    const link = clicked.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toBe('a.bin')
    expect(link.rel).toBe('noopener')
    expect(document.body.contains(link)).toBe(false)
  })
})
