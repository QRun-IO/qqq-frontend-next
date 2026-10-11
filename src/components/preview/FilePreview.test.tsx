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

import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'
import type { FieldAdornment, QFieldMetaData, QRecord } from '@/types'
import { filePreview } from '@/lib/utils/file-preview'
import { DataCell } from '@/components/query/DataCell'
import { FieldValue } from '@/components/records/FieldValue'
import { FilePreviewGallery } from './FilePreviewGallery'
import { FileThumbnail } from './FileThumbnail'
import { FilePreviewLightbox } from './FilePreviewLightbox'
import type { FilePreviewItem } from '@/lib/utils/file-preview'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

function field(name: string, values: Record<string, unknown> = {}, extra: Partial<QFieldMetaData> = {}): QFieldMetaData {
  const adornments: FieldAdornment[] = [{ type: 'FILE_PREVIEW', values }]
  return { name, label: name, type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments, ...extra }
}

function record(values: Record<string, unknown>, displayValues: Record<string, string> = {}): QRecord {
  return { tableName: 'media', values, displayValues }
}

function item(overrides: Partial<FilePreviewItem> = {}): FilePreviewItem {
  return { url: '/files/a.png', thumbnailUrl: '/files/a-t.png', fileName: 'a.png', mimeType: 'image/png', kind: 'image', alt: 'a.png', previewable: true, thumbnailSize: 40, ...overrides }
}

const media = field('url', { thumbnailUrlField: 'thumb', fileNameField: 'name', mimeTypeField: 'type', widthField: 'w', heightField: 'h', sizeBytesField: 'size', captionField: 'caption' })
const rows = [
  record({ url: '/files/one.jpg', thumb: '/files/one-t.jpg', name: 'one.jpg', type: 'image/jpeg', w: 1200, h: 800, size: 204800, caption: 'First' }),
  record({ url: '/files/two.pdf', name: 'two.pdf', type: 'application/pdf' }),
  record({ url: '/files/three.png', name: 'three.png', type: 'image/png' }),
]

/**
 * Renders the thumbnails of rows inside a gallery, as a grid would.
 */
function Gallery({ onRowClick }: { onRowClick?: () => void }) {
  return (
    <FilePreviewGallery records={rows} fields={[media]}>
      {rows.map((row, index) => (
        <div key={index} onClick={onRowClick} data-testid={`row-${index}`}>
          <DataCell field={media} value={row.values.url} displayValue={undefined} record={row} />
        </div>
      ))}
    </FilePreviewGallery>
  )
}

describe('FileThumbnail (QRun-IO/qqq#1056)', () => {
  it('renders a fixed-size lazy thumbnail with a loading pulse until the image loads', () => {
    render(<FileThumbnail field={media} record={rows[0]} item={filePreview(media, rows[0])!} dataQqqId="grid-cell-url" />)
    const button = screen.getByRole('button', { name: 'Preview one.jpg' })
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    const box = document.querySelector('[data-qqq-id="grid-cell-url-thumbnail"]') as HTMLElement
    expect(box.style.width).toBe('40px')
    expect(box.style.height).toBe('40px')
    const image = box.querySelector('img') as HTMLImageElement
    expect(image).toHaveAttribute('src', '/files/one-t.jpg')
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(image).toHaveAttribute('alt', '')
    expect(document.querySelector('[data-qqq-id="grid-cell-url-thumbnail-loading"]')).not.toBeNull()
    fireEvent.load(image)
    expect(document.querySelector('[data-qqq-id="grid-cell-url-thumbnail-loading"]')).toBeNull()
  })

  it('shows the file-type icon when the image fails or the file is not an image', () => {
    render(<FileThumbnail field={media} record={rows[0]} item={filePreview(media, rows[0])!} dataQqqId="t1" />)
    fireEvent.error(document.querySelector('[data-qqq-id="t1-thumbnail"] img')!)
    expect(document.querySelector('[data-qqq-id="t1-thumbnail"] img')).toBeNull()
    expect(document.querySelector('[data-qqq-id="t1-thumbnail"] [data-file-kind="image"]')).not.toBeNull()
    render(<FileThumbnail field={media} record={rows[1]} item={filePreview(media, rows[1])!} dataQqqId="t2" />)
    expect(document.querySelector('[data-qqq-id="t2-thumbnail"] [data-file-kind="pdf"]')).not.toBeNull()
  })

  it('is not a button when previewable is false, and keeps the alt text', () => {
    const still = field('url', { previewable: false })
    const row = record({ url: '/files/x.png' })
    render(<FileThumbnail field={still} record={row} item={filePreview(still, row)!} size={160} showName dataQqqId="t3" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('img', { name: 'x.png' })).toBeInTheDocument()
    expect(screen.getByText('x.png')).toBeInTheDocument()
    expect((document.querySelector('[data-qqq-id="t3-thumbnail"]') as HTMLElement).style.width).toBe('160px')
  })

  it('opens a preview of just its file outside a gallery', async () => {
    const user = userEvent.setup()
    render(<FileThumbnail field={media} record={rows[2]} item={filePreview(media, rows[2])!} dataQqqId="solo" />)
    await user.click(screen.getByRole('button', { name: 'Preview three.png' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('three.png')).toBeInTheDocument()
    expect(within(dialog).getByText('Preview')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Next file' })).toBeNull()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('FilePreviewGallery', () => {
  it('opens at the clicked value without triggering the row, steps with the arrow keys and returns focus on Escape', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    render(<Gallery onRowClick={onRowClick} />)
    const first = screen.getByRole('button', { name: 'Preview one.jpg' })
    await user.click(first)
    expect(onRowClick).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'one.jpg' })).toBeInTheDocument()
    expect(within(dialog).getByText('1 of 3')).toBeInTheDocument()
    // the caption is the alt text when there is no alt text field
    expect(within(dialog).getByRole('img', { name: 'First' })).toHaveAttribute('src', '/files/one.jpg')
    // details: type, size, dimensions and caption
    const details = document.querySelector('[data-qqq-id="file-preview-details"]') as HTMLElement
    expect(details).toHaveTextContent('First')
    expect(details).toHaveTextContent('image/jpeg')
    expect(details).toHaveTextContent('200 KB')
    expect(details).toHaveTextContent('1200 × 800 px')

    await user.keyboard('{ArrowRight}')
    expect(within(dialog).getByRole('heading', { name: 'two.pdf' })).toBeInTheDocument()
    expect(dialog).toHaveAttribute('data-preview-kind', 'pdf')
    expect(document.querySelector('[data-qqq-id="file-preview-pdf"]')).toHaveAttribute('src', '/files/two.pdf')

    await user.keyboard('{End}')
    expect(within(dialog).getByText('3 of 3')).toBeInTheDocument()
    await user.keyboard('{ArrowRight}')
    expect(within(dialog).getByText('1 of 3')).toBeInTheDocument()
    await user.keyboard('{ArrowLeft}')
    expect(within(dialog).getByText('3 of 3')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Previous file' }))
    expect(within(dialog).getByText('2 of 3')).toBeInTheDocument()
    await user.keyboard('{Home}')
    expect(within(dialog).getByText('1 of 3')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(first).toHaveFocus()
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('opens from the keyboard without the key reaching the row', async () => {
    const user = userEvent.setup()
    const onKeyDown = vi.fn()
    render(
      <div onKeyDown={onKeyDown}><Gallery /></div>,
    )
    screen.getByRole('button', { name: 'Preview three.png' }).focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByText('3 of 3')).toBeInTheDocument()
    expect(onKeyDown).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Enter' }))
  })

  it('has no accessibility violations with the preview open', async () => {
    const user = userEvent.setup()
    const { baseElement } = render(<Gallery />)
    expect(await axe(baseElement)).toHaveNoViolations()
    await user.click(screen.getByRole('button', { name: 'Preview one.jpg' }))
    await screen.findByRole('dialog')
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})

describe('FilePreviewLightbox', () => {
  function show(items: FilePreviewItem[], index = 0) {
    const onIndexChange = vi.fn()
    const onClose = vi.fn()
    render(<FilePreviewLightbox items={items} index={index} onIndexChange={onIndexChange} onClose={onClose} />)
    return { onIndexChange, onClose, dialog: screen.getByRole('dialog') }
  }

  it('zooms images with the buttons, keys and a double click, and resets to fit', async () => {
    const user = userEvent.setup()
    show([item()])
    const image = screen.getByRole('img', { name: 'a.png' })
    expect(image).toHaveAttribute('data-zoom', '1')
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(image).toHaveAttribute('data-zoom', '1.5')
    await user.keyboard('+')
    expect(image).toHaveAttribute('data-zoom', '2')
    await user.keyboard('-')
    expect(image).toHaveAttribute('data-zoom', '1.5')
    await user.keyboard('0')
    expect(image).toHaveAttribute('data-zoom', '1')
    fireEvent.doubleClick(image)
    expect(image).toHaveAttribute('data-zoom', '2')
    await user.click(screen.getByRole('button', { name: 'Zoom 200%, fit to window' }))
    expect(image).toHaveAttribute('data-zoom', '1')
    for (let i = 0; i < 6; i++) await user.click(screen.getByRole('button', { name: 'Zoom in' }).closest('button')!)
    expect(image).toHaveAttribute('data-zoom', '4')
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled()
  })

  it('applies the zoom as a width once the image has its fitted size', () => {
    show([item()])
    const image = screen.getByRole('img', { name: 'a.png' }) as HTMLImageElement
    Object.defineProperty(image, 'naturalWidth', { value: 2000 })
    Object.defineProperty(image, 'naturalHeight', { value: 1000 })
    image.getBoundingClientRect = () => ({ width: 500, height: 250 } as DOMRect)
    fireEvent.load(image)
    expect(document.querySelector('[data-qqq-id="file-preview-details"]')).toHaveTextContent('2000 × 1000 px')
    fireEvent.doubleClick(image)
    expect(image.style.width).toBe('1000px')
  })

  it('offers open-original and download links (attachment for backend files)', () => {
    show([item({ url: '/qqq/v1/table/media/1/blob/a.png', fileName: 'a.png' })])
    expect(document.querySelector('[data-qqq-id="file-preview-open"]')).toHaveAttribute('href', '/qqq/v1/table/media/1/blob/a.png')
    expect(document.querySelector('[data-qqq-id="file-preview-open"]')).toHaveAttribute('rel', 'noopener noreferrer')
    expect(document.querySelector('[data-qqq-id="file-preview-download"]')).toHaveAttribute('href', '/qqq/v1/table/media/1/blob/a.png?download=1')
    expect(document.querySelector('[data-qqq-id="file-preview-download"]')).toHaveAttribute('download', 'a.png')
  })

  it('falls back to the file card for an image that fails to load', () => {
    show([item()])
    fireEvent.error(screen.getByRole('img', { name: 'a.png' }))
    expect(screen.getByText('This file could not be loaded.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull()
  })

  it('explains types it cannot show', () => {
    show([item({ kind: 'other', mimeType: 'application/zip', fileName: 'b.zip', url: '/files/b.zip' })])
    expect(screen.getByText('No preview is available for this type of file.')).toBeInTheDocument()
    expect(document.querySelector('[data-qqq-id="file-preview-download"]')).toHaveAttribute('href', '/files/b.zip')
  })

  it('does not frame a PDF from another origin', () => {
    show([item({ kind: 'pdf', mimeType: 'application/pdf', fileName: 'c.pdf', url: 'https://elsewhere.example/c.pdf' })])
    expect(document.querySelector('[data-qqq-id="file-preview-pdf"]')).toBeNull()
    expect(screen.getByText(/opens in a new tab instead/)).toBeInTheDocument()
  })

  it('plays video and audio, falling back when the player cannot load them', () => {
    show([item({ kind: 'video', mimeType: 'video/mp4', fileName: 'v.mp4', url: '/files/v.mp4' }), item({ kind: 'audio', mimeType: 'audio/mpeg', fileName: 's.mp3', url: '/files/s.mp3' })])
    const video = document.querySelector('[data-qqq-id="file-preview-video"]') as HTMLVideoElement
    expect(video).toHaveAttribute('src', '/files/v.mp4')
    expect(video).toHaveAttribute('controls')
    // arrow keys used inside the player are its own
    fireEvent.keyDown(video, { key: 'ArrowRight' })
    act(() => { fireEvent.error(video) })
    expect(screen.getByText('This file could not be loaded.')).toBeInTheDocument()
  })

  it('renders an audio player', () => {
    show([item({ kind: 'audio', mimeType: 'audio/mpeg', fileName: 's.mp3', url: '/files/s.mp3' })])
    expect(document.querySelector('[data-qqq-id="file-preview-audio"]')).toHaveAttribute('src', '/files/s.mp3')
  })

  it('reports navigation and closing to its owner, ignoring modified keys', async () => {
    const user = userEvent.setup()
    const { onIndexChange, onClose } = show([item(), item({ fileName: 'b.png', url: '/b.png' })], 1)
    await user.keyboard('{Control>}{ArrowRight}{/Control}')
    expect(onIndexChange).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Next file' }))
    expect(onIndexChange).toHaveBeenLastCalledWith(0)
    await user.click(screen.getByRole('button', { name: 'Close preview' }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('FILE_PREVIEW in the shared value renderers', () => {
  function renderValue(element: React.ReactElement) {
    return render(<QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>)
  }

  it('DataCell shows a thumbnail in place of other adornments, and the usual value without a URL', () => {
    const both = { ...media, adornments: [{ type: 'LINK' as const }, ...media.adornments] }
    renderValue(<DataCell field={both} value={rows[0].values.url} displayValue={undefined} record={rows[0]} />)
    expect(document.querySelector('[data-qqq-id="grid-cell-url"]')).toHaveAttribute('data-preview-kind', 'image')
    const empty = record({ url: 'javascript:alert(1)' })
    renderValue(<DataCell field={field('bad')} value={empty.values.bad} displayValue={undefined} record={empty} />)
    expect(document.querySelector('[data-qqq-id="grid-cell-bad"]')).toHaveTextContent('—')
  })

  it('FieldValue shows a record-view thumbnail with the file name, and an em dash without a file', () => {
    renderValue(<FieldValue field={media} record={rows[0]} thumbnailSize={160} />)
    const value = document.querySelector('[data-qqq-id="field-value-url"]') as HTMLElement
    expect(value).toHaveTextContent('one.jpg')
    expect((document.querySelector('[data-qqq-id="field-value-url-thumbnail"]') as HTMLElement).style.width).toBe('160px')
    renderValue(<FieldValue field={field('none')} record={record({ none: null })} />)
    expect(document.querySelector('[data-qqq-id="field-value-none"]')).toHaveTextContent('—')
  })
})
