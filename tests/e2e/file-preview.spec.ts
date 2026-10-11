// E2E: FILE_PREVIEW thumbnails and the preview lightbox (QRun-IO/qqq#1056), against mocked v1 routes

import { test, expect, type Page } from '@playwright/test'
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
