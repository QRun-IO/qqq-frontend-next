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
import type { FieldAdornment, QFieldMetaData, QRecord } from '@/types'
import {
  DEFAULT_THUMBNAIL_SIZE, filePreview, filePreviewItems, formatBytes, hasFilePreview, isBackendFileUrl, isSameOrigin,
  joinedPreviewField, kindOfMimeType, mimeTypeOfName, safePreviewUrl,
} from './file-preview'

function field(name: string, adornments: FieldAdornment[] = [], extra: Partial<QFieldMetaData> = {}): QFieldMetaData {
  return { name, label: name, type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments, ...extra }
}

function record(values: Record<string, unknown>, displayValues: Record<string, string> = {}): QRecord {
  return { tableName: 'media', values, displayValues }
}

const preview = (values: Record<string, unknown> = {}): FieldAdornment => ({ type: 'FILE_PREVIEW', values })

describe('safePreviewUrl (QRun-IO/qqq#1056)', () => {
  it('accepts https URLs and same-origin paths', () => {
    expect(safePreviewUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
    expect(safePreviewUrl('  /files/a b.jpg ')).toBe('/files/a b.jpg')
  })

  it('serves backend field downloads from the v1 route', () => {
    expect(safePreviewUrl('/data/media/7/blob/a.png')).toBe('/qqq/v1/table/media/7/blob/a.png')
  })

  it('rejects other schemes, protocol-relative and malformed values', () => {
    for (const value of ['javascript:alert(1)', '//evil.example/a.png', 'ftp://x/a.png', 'images/a.png', '', '   ', '/a"onerror="x', '/a\u0000b', 42, null, undefined]) {
      expect(safePreviewUrl(value)).toBeUndefined()
    }
  })

  it('accepts inline images only where asked, and never other data URLs', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo='
    expect(safePreviewUrl(png)).toBeUndefined()
    expect(safePreviewUrl(png, true)).toBe(png)
    expect(safePreviewUrl('data:text/html,<b>x</b>', true)).toBeUndefined()
  })
})

describe('file type helpers', () => {
  it('maps MIME types to preview kinds', () => {
    expect(kindOfMimeType('image/webp')).toBe('image')
    expect(kindOfMimeType('Application/PDF; charset=binary')).toBe('pdf')
    expect(kindOfMimeType('video/mp4')).toBe('video')
    expect(kindOfMimeType('audio/mpeg')).toBe('audio')
    expect(kindOfMimeType('application/zip')).toBe('other')
    expect(kindOfMimeType(undefined)).toBe('other')
  })

  it('reads MIME types from extensions, ignoring query strings', () => {
    expect(mimeTypeOfName('photo.JPG')).toBe('image/jpeg')
    expect(mimeTypeOfName('https://x.example/a/clip.webm?sig=1#t')).toBe('video/webm')
    expect(mimeTypeOfName('report.pdf')).toBe('application/pdf')
    expect(mimeTypeOfName('song.mp3')).toBe('audio/mpeg')
    expect(mimeTypeOfName('archive.tar.zz')).toBeUndefined()
    expect(mimeTypeOfName('https://x.example/a.b/file')).toBeUndefined()
    expect(mimeTypeOfName(undefined)).toBeUndefined()
  })

  it('formats byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(15 * 1024 * 1024)).toBe('15 MB')
    expect(formatBytes(3 * 1024 ** 4)).toBe('3 TB')
    expect(formatBytes(-1)).toBe('')
    expect(formatBytes(Number.NaN)).toBe('')
  })

  it('tells same-origin URLs from others', () => {
    expect(isSameOrigin('/files/a.pdf')).toBe(true)
    expect(isSameOrigin(`${window.location.origin}/a.pdf`)).toBe(true)
    expect(isSameOrigin('https://elsewhere.example/a.pdf')).toBe(false)
    expect(isSameOrigin('//elsewhere.example/a.pdf')).toBe(false)
    expect(isSameOrigin('not a url')).toBe(false)
    expect(isBackendFileUrl('/qqq/v1/table/media/1/blob/a.pdf')).toBe(true)
    expect(isBackendFileUrl(`${window.location.origin}/qqq/v1/table/media/1/blob/a.pdf`)).toBe(true)
    expect(isBackendFileUrl('/app/media/1')).toBe(false)
    expect(isBackendFileUrl('/qqq-not/a.pdf')).toBe(false)
    expect(isBackendFileUrl('https://elsewhere.example/qqq/a.pdf')).toBe(false)
  })
})

describe('filePreview', () => {
  it('ignores fields without the adornment', () => {
    expect(hasFilePreview(field('url'))).toBe(false)
    expect(hasFilePreview(undefined)).toBe(false)
    expect(filePreview(field('url'), record({ url: 'https://x.example/a.jpg' }))).toBeNull()
  })

  it('uses the field itself as thumbnail and full-size source by default', () => {
    const item = filePreview(field('url', [preview()]), record({ url: 'https://x.example/a/cat%20photo.png' }))
    expect(item).toEqual({
      thumbnailUrl: 'https://x.example/a/cat%20photo.png', url: 'https://x.example/a/cat%20photo.png', fileName: 'cat photo.png',
      mimeType: 'image/png', kind: 'image', alt: 'cat photo.png', previewable: true, thumbnailSize: DEFAULT_THUMBNAIL_SIZE,
    })
  })

  it('reads the thumbnail, full-size URL and details from the named fields', () => {
    const f = field('originalUrl', [preview({
      thumbnailUrlField: 'thumbnailUrl', fullSizeUrlField: 'galleryUrl', fileNameField: 'fileName', mimeTypeField: 'mimeType',
      altTextField: 'alt', captionField: 'caption', widthField: 'width', heightField: 'height', sizeBytesField: 'fileSize', thumbnailMaxSize: 64,
    })])
    const item = filePreview(f, record({
      originalUrl: 'https://x.example/o.jpg', thumbnailUrl: 'https://x.example/t.jpg', galleryUrl: 'https://x.example/g.jpg',
      fileName: 'sunset.jpg', mimeType: 'image/jpeg', alt: 'A sunset', caption: 'Evening', width: 4000, height: '3000', fileSize: 2048,
    }))
    expect(item).toMatchObject({
      thumbnailUrl: 'https://x.example/t.jpg', url: 'https://x.example/g.jpg', fileName: 'sunset.jpg', mimeType: 'image/jpeg',
      kind: 'image', alt: 'A sunset', caption: 'Evening', width: 4000, height: 3000, sizeBytes: 2048, thumbnailSize: 64,
    })
  })

  it('falls back to the field value when a named URL field is empty or unsafe, and to the thumbnail when only it is set', () => {
    const f = field('url', [preview({ fullSizeUrlField: 'big', thumbnailUrlField: 'small' })])
    expect(filePreview(f, record({ url: '/a.png', big: 'javascript:x', small: '' }))?.url).toBe('/a.png')
    expect(filePreview(f, record({ url: null, small: '/t.png' }))).toMatchObject({ url: '/t.png', thumbnailUrl: '/t.png' })
    expect(filePreview(f, record({ url: null, small: null }))).toBeNull()
  })

  it('uses the caption as alt text and the display value as file name', () => {
    const f = field('url', [preview({ captionField: 'caption' })])
    const item = filePreview(f, record({ url: '/x/123', caption: 'Team photo' }, { url: 'team.webp' }))
    expect(item).toMatchObject({ alt: 'Team photo', fileName: 'team.webp', kind: 'image', mimeType: 'image/webp' })
    // a display value that is the URL itself is not a file name
    expect(filePreview(f, record({ url: '/x/b.gif' }, { url: '/x/b.gif' }))?.fileName).toBe('b.gif')
  })

  it('takes the type from the MIME field, then the default, then the extension', () => {
    const f = field('url', [preview({ mimeTypeField: 'type', defaultMimeType: 'application/pdf' })])
    expect(filePreview(f, record({ url: '/f/a', type: 'video/mp4' }))?.kind).toBe('video')
    expect(filePreview(f, record({ url: '/f/a', type: '' }))?.kind).toBe('pdf')
    const wildcard = field('url', [preview({ defaultMimeType: 'image/*' })])
    expect(filePreview(wildcard, record({ url: '/f/a.mp3' }))).toMatchObject({ kind: 'audio', mimeType: 'audio/mpeg' })
    expect(filePreview(wildcard, record({ url: '/f/blob' }))).toMatchObject({ kind: 'image', mimeType: 'image/*' })
    const none = filePreview(field('url', [preview()]), record({ url: '/f/blob' }))
    expect(none?.kind).toBe('other')
    expect(none).not.toHaveProperty('thumbnailUrl')
    expect(none).not.toHaveProperty('mimeType')
  })

  it('previews a BLOB through its FILE_DOWNLOAD URL and file name', () => {
    const f = field('photo', [{ type: 'FILE_DOWNLOAD', values: { fileNameField: 'photoFileName' } }, preview()], { type: 'BLOB' })
    const item = filePreview(f, record({ photo: '/data/media/3/photo/me.png' }, { photo: 'me.png' }), '{"type":"site","id":"1"}')
    expect(item).toMatchObject({ url: '/qqq/v1/table/media/3/photo/me.png?tableVariant=%7B%22type%22%3A%22site%22%2C%22id%22%3A%221%22%7D', fileName: 'me.png', kind: 'image' })
  })

  it('honours previewable=false (boolean or text) and clamps the thumbnail size', () => {
    expect(filePreview(field('u', [preview({ previewable: false })]), record({ u: '/a.png' }))?.previewable).toBe(false)
    expect(filePreview(field('u', [preview({ previewable: 'FALSE' })]), record({ u: '/a.png' }))?.previewable).toBe(false)
    expect(filePreview(field('u', [preview({ thumbnailMaxSize: 4 })]), record({ u: '/a.png' }))?.thumbnailSize).toBe(16)
    expect(filePreview(field('u', [preview({ thumbnailMaxSize: '9000' })]), record({ u: '/a.png' }))?.thumbnailSize).toBe(512)
    expect(filePreview(field('u', [preview({ thumbnailMaxSize: 'big' })]), record({ u: '/a.png' }))?.thumbnailSize).toBe(DEFAULT_THUMBNAIL_SIZE)
  })

  it('ignores non-positive dimensions and blank details', () => {
    const f = field('u', [preview({ widthField: 'w', heightField: 'h', sizeBytesField: 's', altTextField: 'a', fileNameField: 'n' })])
    const item = filePreview(f, record({ u: '/a.png', w: 0, h: 'x', s: '', a: '  ', n: null }))
    expect(item).not.toHaveProperty('width')
    expect(item).not.toHaveProperty('height')
    expect(item).not.toHaveProperty('sizeBytes')
    expect(item?.alt).toBe('a.png')
  })

  it('names a data URL file after the field', () => {
    expect(filePreview(field('logo', [preview()]), record({ logo: 'data:image/png;base64,AAAA' }))?.fileName).toBe('logo')
  })
})

describe('filePreviewItems', () => {
  it('lists the previewable values of adorned fields, record by record', () => {
    const a = field('a', [preview()])
    const b = field('b', [preview({ previewable: false })])
    const c = field('c')
    const records = [record({ a: '/1.png', b: '/x.png', c: '/c.png' }), record({ a: null }), record({ a: '/2.png' })]
    const items = filePreviewItems(records, [a, b, c])
    expect(items.map((entry) => entry.item.url)).toEqual(['/1.png', '/2.png'])
    expect(items[1].record).toBe(records[2])
    expect(filePreviewItems(records, [c])).toEqual([])
  })
})

describe('joinedPreviewField', () => {
  it('prefixes the field name and FILE_PREVIEW field references with the join table', () => {
    const f = field('photoUrl', [{ type: 'CHIP' }, preview({ thumbnailUrlField: 'thumbUrl', thumbnailMaxSize: 48, captionField: '' })])
    const joined = joinedPreviewField(f, 'author')
    expect(joined.name).toBe('author.photoUrl')
    expect(joined.adornments[0]).toEqual({ type: 'CHIP' })
    expect(joined.adornments[1].values).toEqual({ thumbnailUrlField: 'author.thumbUrl', thumbnailMaxSize: 48, captionField: '' })
    expect(filePreview(joined, record({ 'author.photoUrl': '/p.png', 'author.thumbUrl': '/t.png' }))?.thumbnailUrl).toBe('/t.png')
  })

  it('returns other fields unchanged', () => {
    const f = field('name')
    expect(joinedPreviewField(f, 'author')).toBe(f)
    expect(joinedPreviewField({ name: 'x', adornments: [{ type: 'FILE_PREVIEW' }] }, 'j')).toEqual({ name: 'j.x', adornments: [{ type: 'FILE_PREVIEW', values: {} }] })
  })
})
