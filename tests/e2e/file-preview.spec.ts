/*
 * Copyright 2026 QRun.IO, Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

// E2E: FILE_PREVIEW thumbnails and the preview lightbox (QRun-IO/qqq#1056), against mocked v1 routes

import { test, expect, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { METADATA, setupApiMocks } from './api-mocks'
import { checkA11y } from './a11y-helpers'

// a 2x2 PNG, served for every /media-fixtures/*.png request
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DwnwEMGBgYGBgYAAAg6AHvOnTvPAAAAABJRU5ErkJggg==', 'base64')

const field = (name: string, label: string, type: string, adornments: unknown[] = []) =>
  ({ name, label, type, isEditable: false, isRequired: false, isHeavy: false, isHidden: false, adornments })

const MEDIA_TABLE = {
  name: 'media',
  label: 'Media',
  isHidden: false,
  primaryKeyField: 'id',
  fields: {
    id: field('id', 'ID', 'INTEGER'),
    name: field('name', 'Name', 'STRING'),
    originalUrl: field('originalUrl', 'Image', 'STRING', [{
      type: 'FILE_PREVIEW',
      values: { thumbnailUrlField: 'thumbnailUrl', fileNameField: 'fileName', mimeTypeField: 'mimeType', widthField: 'width', heightField: 'height', sizeBytesField: 'fileSize' },
    }]),
    thumbnailUrl: field('thumbnailUrl', 'Thumbnail URL', 'STRING'),
    fileName: field('fileName', 'File Name', 'STRING'),
    mimeType: field('mimeType', 'MIME Type', 'STRING'),
    width: field('width', 'Width', 'INTEGER'),
    height: field('height', 'Height', 'INTEGER'),
    fileSize: field('fileSize', 'File Size', 'LONG'),
  },
  sections: [
    { name: 'identity', label: 'Media', tier: 'T1', fieldNames: ['id', 'name', 'originalUrl'], isHidden: false },
    { name: 'file', label: 'File', tier: 'T2', fieldNames: ['fileName', 'mimeType', 'width', 'height', 'fileSize', 'thumbnailUrl'], isHidden: false },
  ],
  exposedJoins: [],
  capabilities: ['TABLE_QUERY', 'TABLE_GET', 'TABLE_COUNT'],
  readPermission: true,
  insertPermission: false,
  editPermission: false,
  deletePermission: false,
  usesVariants: false,
  variantTableLabel: '',
}

const media = (id: number, name: string, mimeType = 'image/png') => ({
  tableName: 'media', recordLabel: name,
  values: {
    id, name, originalUrl: `/media-fixtures/${name}`, thumbnailUrl: mimeType.startsWith('image/') ? `/media-fixtures/t-${name}` : null,
    fileName: name, mimeType, width: 1200, height: 800, fileSize: 102400 * id,
  },
  displayValues: { id: String(id) },
})

const MEDIA_RECORDS = [media(1, 'harbor.png'), media(2, 'sunset.png'), media(3, 'brochure.zip', 'application/zip')]

const INSTANCE = {
  ...METADATA,
  tables: { ...METADATA.tables, media: MEDIA_TABLE },
  apps: {
    crm: {
      ...METADATA.apps.crm,
      children: [...METADATA.apps.crm.children, { name: 'media', label: 'Media', type: 'TABLE', iconName: 'image' }],
      sections: [{ ...METADATA.apps.crm.sections[0], tables: ['person', 'media'] }],
    },
  },
}

async function setupMediaMocks(page: Page) {
  await setupApiMocks(page)
  // later routes win: only the whole-instance request, not /metaData/table or /metaData/authentication
  await page.route(/\/qqq\/v1\/metaData(\?|$)/, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(INSTANCE) }))
  await page.route('**/qqq/v1/metaData/table/media**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(MEDIA_TABLE) }))
  await page.route(/\/qqq\/v1\/table\/media\/\d+(\?|$)/, (route) => {
    const id = Number(/\/table\/media\/(\d+)/.exec(route.request().url())?.[1])
    const record = MEDIA_RECORDS.find((r) => r.values.id === id)
    return record
      ? route.fulfill({ contentType: 'application/json', body: JSON.stringify({ record }) })
      : route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not found"}' })
  })
  await page.route('**/qqq/v1/table/media/count**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ count: MEDIA_RECORDS.length }) }))
  await page.route('**/qqq/v1/table/media/query**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ records: MEDIA_RECORDS }) }))
  await page.route('**/media-fixtures/**', (route) => route.fulfill({ contentType: 'image/png', body: PNG }))
}

async function waitForGrid(page: Page) {
  await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('[data-qqq-id^="grid-row-"]').first()).toBeVisible({ timeout: 30000 })
}

test.describe('FILE_PREVIEW', () => {
  test('the query grid shows thumbnails that open a navigable preview', async ({ page }) => {
    await setupMediaMocks(page)
    await page.goto('/app/media')
    await waitForGrid(page)

    const thumbnail = page.getByRole('button', { name: 'Preview harbor.png' })
    await expect(thumbnail).toBeVisible()
    const image = thumbnail.locator('img')
    await expect(image).toHaveAttribute('src', '/media-fixtures/t-harbor.png')
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0)
    // a non-image file gets the file icon
    await expect(page.getByRole('button', { name: 'Preview brochure.zip' }).locator('[data-file-kind="other"]')).toBeVisible()
    await checkA11y(page)

    await thumbnail.click()
    // the click opens the preview, not the record
    await expect(page).toHaveURL(/\/app\/media(\?|$)/)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'harbor.png' })).toBeVisible()
    await expect(dialog.getByText('1 of 3')).toBeVisible()
    await expect(dialog.locator('[data-qqq-id="file-preview-image"]')).toHaveAttribute('src', '/media-fixtures/harbor.png')
    await expect(dialog.locator('[data-qqq-id="file-preview-details"]')).toContainText('1200 × 800 px')
    await checkA11y(page)

    await page.keyboard.press('ArrowRight')
    await expect(dialog.getByRole('heading', { name: 'sunset.png' })).toBeVisible()
    await page.keyboard.press('+')
    await expect(dialog.locator('[data-qqq-id="file-preview-image"]')).toHaveAttribute('data-zoom', '1.5')
    await page.keyboard.press('ArrowRight')
    await expect(dialog.getByText('No preview is available for this type of file.')).toBeVisible()
    await expect(dialog.locator('[data-qqq-id="file-preview-download"]')).toHaveAttribute('href', '/media-fixtures/brochure.zip')

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(thumbnail).toBeFocused()
  })

  test('the record view shows a large thumbnail with the file name', async ({ page }) => {
    await setupMediaMocks(page)
    await page.goto('/app/media/2')
    await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible({ timeout: 30000 })
    const thumbnail = page.getByRole('button', { name: 'Preview sunset.png' })
    await expect(thumbnail).toBeVisible({ timeout: 30000 })
    await expect(thumbnail).toContainText('sunset.png')
    await thumbnail.press('Enter')
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'sunset.png' })).toBeVisible()
  })
})

// A deterministic two-page PDF includes a JavaScript OpenAction; the canvas-only
// preview must render its graphics without executing the action or framing bytes.
function canvasProofPdf(): Buffer {
  const stream = '0.8 0.1 0.1 rg 10 10 80 80 re f\n'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /OpenAction 6 0 R >>',
    '<< /Type /Pages /Count 2 /Kids [3 0 R 4 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 5 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 5 0 R >>',
    '<< /Length ' + Buffer.byteLength(stream) + ' >>\nstream\n' + stream + 'endstream',
    '<< /S /JavaScript /JS (app.alert\\(\\"PDF action ran\\"\\)) >>',
  ]
  let source = '%PDF-1.7\n'; const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(source)); source += (index + 1) + ' 0 obj\n' + object + '\nendobj\n' })
  const xref = Buffer.byteLength(source)
  source += 'xref\n0 7\n0000000000 65535 f \n' + offsets.slice(1).map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n').join('')
  source += 'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n'
  return Buffer.from(source)
}

test('PDF preview uses a real worker and canvas, with no uploaded frame or document action', async ({ page }) => {
  await setupMediaMocks(page)
  const record = media(9, 'packing-slip.pdf', 'application/pdf')
  record.values.originalUrl = '/qqq/v1/table/media/9/blob/packing-slip.pdf'
  await page.route(/\/qqq\/v1\/table\/media\/9(\?|$)/, (route) => route.fulfill({ json: { record } }))
  await page.route('**/qqq/v1/table/media/9/blob/packing-slip.pdf', (route) => route.fulfill({ contentType: 'application/pdf', body: canvasProofPdf() }))
  const dialogs: string[] = []; const errors: string[] = []
  page.on('dialog', (dialog) => { dialogs.push(dialog.message()); void dialog.dismiss() })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/app/media/9')
  await page.getByRole('button', { name: 'Preview packing-slip.pdf' }).click()
  const preview = page.locator('[data-qqq-id="file-preview-pdf"]')
  await expect(preview.getByRole('button', { name: 'Next page' })).toBeEnabled({ timeout: 30000 })
  await expect(page.locator('iframe,object,embed')).toHaveCount(0)
  await expect(page.locator('[data-qqq-id="file-preview-open"]')).toHaveCount(0)
  await expect.poll(() => preview.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data[1])).toBeLessThan(100)
  await preview.getByRole('button', { name: 'Next page' }).click()
  await expect(preview.getByText('Page 2 of 2')).toBeVisible()
  expect(dialogs).toEqual([]); expect(errors).toEqual([])
  await page.screenshot({ path: 'test-results/pdf-canvas-preview.png', fullPage: true })
})

test('audited original preview and download use separate verified attempts and refuse an incomplete receipt', async ({ page }) => {
  await setupMediaMocks(page)
  const table = {
    ...MEDIA_TABLE,
    fields: {
      ...MEDIA_TABLE.fields,
      originalUrl: field('originalUrl', 'Retained original', 'STRING', [
        { type: 'FILE_DOWNLOAD', values: { deliveryModeField: 'delivery', fileNameField: 'fileName' } },
        { type: 'FILE_PREVIEW', values: { fileNameField: 'fileName', mimeTypeField: 'mimeType' } },
      ]),
      delivery: { ...field('delivery', 'Delivery', 'STRING'), isHidden: true },
    },
  }
  const instance = { ...INSTANCE, tables: { ...INSTANCE.tables, media: table } }
  await page.route(/\/qqq\/v1\/metaData(\?|$)/, (route) => route.fulfill({ json: instance }))
  await page.route('**/qqq/v1/metaData/table/media**', (route) => route.fulfill({ json: table }))
  const issuedAttempt = '10000000-0000-4000-8000-000000000001'
  const record = media(10, 'retained-slip.pdf', 'application/pdf')
  const values = { ...record.values, originalUrl: `/qqq/v1/qbit/record-files/files/10/downloads/${issuedAttempt}`, delivery: 'AUTHENTICATED_FETCH' }
  await page.route(/\/qqq\/v1\/table\/media\/10(\?|$)/, (route) => route.fulfill({ json: { record: { ...record, values } } }))
  const bytes = canvasProofPdf()
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const attempts: string[] = []
  const receipts: string[] = []
  let incompleteReceipt = false
  let savedDownloads = 0
  page.on('download', () => { savedDownloads++ })
  await page.route(/\/qqq\/v1\/qbit\/record-files\/files\/10\/downloads\/[a-f0-9-]+(?:\/receipt)?$/, async (route) => {
    const path = new URL(route.request().url()).pathname
    const match = /\/downloads\/([a-f0-9-]+)(\/receipt)?$/.exec(path)!
    expect(route.request().headers()['x-record-files-download']).toBe('1')
    expect(match[1]).not.toBe(issuedAttempt)
    if (match[2]) {
      expect(attempts).toContain(match[1])
      receipts.push(match[1])
      await route.fulfill({ json: { state: incompleteReceipt ? 'UNKNOWN' : 'BODY_WRITE_COMPLETED', sizeBytes: bytes.length, sha256 } })
    } else {
      expect(attempts).not.toContain(match[1])
      attempts.push(match[1])
      await route.fulfill({ contentType: 'application/octet-stream', body: bytes })
    }
  })
  await page.goto('/app/media/10')
  await page.getByRole('button', { name: 'Preview file', exact: true }).click()
  await expect(page.locator('[data-qqq-id="file-preview-pdf"] canvas')).toBeVisible({ timeout: 30000 })
  const downloadEvent = page.waitForEvent('download')
  await page.locator('[data-qqq-id="file-preview-download"]').click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('retained-slip.pdf')
  expect(await readFile((await download.path())!)).toEqual(bytes)
  await page.getByRole('button', { name: 'Close preview' }).click()
  incompleteReceipt = true
  await page.getByRole('button', { name: 'Download file', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'could not confirm the download audit' })).toBeVisible()
  expect(savedDownloads).toBe(1)
  expect(attempts).toHaveLength(3)
  expect(new Set(attempts).size).toBe(3)
  expect(receipts).toEqual(attempts)
  await expect(page.locator('a[href*="/downloads/"],iframe,object,embed')).toHaveCount(0)
})
