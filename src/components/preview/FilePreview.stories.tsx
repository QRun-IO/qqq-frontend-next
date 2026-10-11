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

/**
 * FILE_PREVIEW stories: thumbnails as the query grid and the record view show them, and the
 * preview lightbox they open (arrow keys step through the gallery).
 */
import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'

import type { QFieldMetaData, QRecord } from '@/types'
import { DataCell } from '@/components/query/DataCell'
import { FieldValue } from '@/components/records/FieldValue'
import { FilePreviewGallery } from './FilePreviewGallery'

/** An inline SVG "photo", so the stories need no network. */
function swatch(from: string, to: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><text x="600" y="430" font-family="sans-serif" font-size="96" fill="white" text-anchor="middle">${label}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const field: QFieldMetaData = {
  name: 'originalUrl', label: 'Image', type: 'STRING', isEditable: false, isRequired: false, isHeavy: false, isHidden: false,
  adornments: [{
    type: 'FILE_PREVIEW',
    values: { fileNameField: 'fileName', mimeTypeField: 'mimeType', widthField: 'width', heightField: 'height', sizeBytesField: 'fileSize', captionField: 'caption' },
  }],
}

const records: QRecord[] = [
  { tableName: 'media', values: { originalUrl: swatch('#0ea5e9', '#6366f1', 'Harbor'), fileName: 'harbor.svg', mimeType: 'image/svg+xml', width: 1200, height: 800, fileSize: 48213, caption: 'Morning at the harbor' } },
  { tableName: 'media', values: { originalUrl: swatch('#f97316', '#db2777', 'Sunset'), fileName: 'sunset.svg', mimeType: 'image/svg+xml', width: 1200, height: 800, fileSize: 51022 } },
  { tableName: 'media', values: { originalUrl: '/files/annual-report.pdf', fileName: 'annual-report.pdf', mimeType: 'application/pdf', fileSize: 1832000 } },
]

/** Thumbnails in a grid-like list; click one (or focus it and press Enter) to preview. */
function GridThumbnails() {
  return (
    <FilePreviewGallery records={records} fields={[field]}>
      <table className="text-sm">
        <tbody>
          {records.map((record) => (
            <tr key={String(record.values.fileName)} className="border-b border-border">
              <td className="p-2"><DataCell field={field} value={record.values.originalUrl} displayValue={undefined} record={record} /></td>
              <td className="p-2">{String(record.values.fileName)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </FilePreviewGallery>
  )
}

const meta = {
  title: 'Records/FilePreview',
  component: GridThumbnails,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'FILE_PREVIEW adornment: fixed-size lazy thumbnails (file-type icons for non-images) that open an accessible preview lightbox with zoom, details, open/download and arrow-key navigation.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof GridThumbnails>

export default meta
type Story = StoryObj<typeof meta>

/** Query-grid thumbnails (40 px, the default `thumbnailMaxSize`). */
export const QueryGrid: Story = {}

/** A record view value: a larger thumbnail with the file name. */
export const RecordView: Story = {
  render: () => (
    <FilePreviewGallery records={[records[0]]} fields={[field]}>
      <FieldValue field={field} record={records[0]} thumbnailSize={160} />
    </FilePreviewGallery>
  ),
}
