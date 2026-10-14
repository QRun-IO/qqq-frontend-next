// E2E: the record picker for a possible-value field whose source declares a picker (large
// tables such as media): open, search, filter, page, select, save, and the saved value persists.
// Against mocked v1 routes that behave like the backend (keyset pages, allow-listed filters).

import { test, expect, type Page, type Route } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'
import { checkA11y } from './a11y-helpers'

// a 2x2 PNG, served for every /media-fixtures/*.png request
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DwnwEMGBgYGBgYAAAg6AHvOnTvPAAAAABJRU5ErkJggg==', 'base64')

const field = (name: string, label: string, type: string, extra: object = {}) =>
  ({ name, label, type, isEditable: true, isRequired: false, isHeavy: false, isHidden: false, adornments: [], ...extra })

const PICKER = {
  thumbnailField: 'thumbnailUrl',
  previewField: 'galleryUrl',
  subtitleFields: ['mediaTypeId', 'dimensions'],
  detailFields: ['dimensions', 'fileSize', 'altText'],
  filterFields: ['mediaTypeId', 'width'],
  searchFields: ['name'],
  sorts: [{ label: 'Newest', fieldName: 'id', isAscending: false }, { label: 'Name', fieldName: 'name', isAscending: true }],
  pageSize: 24,
}

const MEDIA_TABLE = {
  name: 'media',
  label: 'Media',
  isHidden: false,
  primaryKeyField: 'id',
  fields: {
    id: field('id', 'ID', 'LONG', { isEditable: false }),
    name: field('name', 'Name', 'STRING'),
    mediaTypeId: field('mediaTypeId', 'Media Type', 'LONG', { possibleValueSourceName: 'mediaType' }),
    width: field('width', 'Width', 'INTEGER'),
    dimensions: field('dimensions', 'Dimensions', 'STRING'),
    fileSize: field('fileSize', 'File Size', 'LONG'),
    altText: field('altText', 'Alt Text', 'STRING'),
    thumbnailUrl: field('thumbnailUrl', 'Thumbnail URL', 'STRING'),
    galleryUrl: field('galleryUrl', 'Gallery URL', 'STRING'),
  },
  sections: [{ name: 'media', label: 'Media', tier: 'T1', fieldNames: ['id', 'name', 'mediaTypeId', 'width'], isHidden: false }],
  exposedJoins: [],
  capabilities: ['TABLE_QUERY', 'TABLE_GET'],
  readPermission: true, insertPermission: false, editPermission: false, deletePermission: false,
  usesVariants: false, variantTableLabel: '',
}

const BLOG_POST_TABLE = {
  name: 'blog_post',
  label: 'Blog Post',
  isHidden: false,
  primaryKeyField: 'id',
  fields: {
    id: field('id', 'ID', 'LONG', { isEditable: false }),
    title: field('title', 'Title', 'STRING', { maxLength: 100 }),
    featuredMediaId: field('featuredMediaId', 'Featured Image', 'LONG', { possibleValueSourceName: 'media', picker: PICKER, pickerTableName: 'media' }),
  },
  sections: [{ name: 'content', label: 'Content', tier: 'T1', fieldNames: ['title', 'featuredMediaId'], isHidden: false }],
  exposedJoins: [],
  capabilities: ['TABLE_QUERY', 'TABLE_GET', 'TABLE_COUNT', 'TABLE_UPDATE'],
  readPermission: true, insertPermission: true, editPermission: true, deletePermission: false,
  usesVariants: false, variantTableLabel: '',
}

const TYPES = [{ id: 1, label: 'Photo' }, { id: 2, label: 'Logo' }]
const WORDS = ['Harbor', 'Sunset', 'Lighthouse', 'Forest', 'Desert', 'Canyon', 'Glacier', 'Meadow']

// 150 media records: enough for several keyset pages
const MEDIA = Array.from({ length: 150 }, (_, index) => {
  const id = index + 1
  const name = `${WORDS[index % WORDS.length]} ${id}`
  const type = id % 5 === 0 ? 2 : 1
  const width = 800 + (id % 4) * 400
  return {
    id, label: name,
    values: { thumbnailUrl: `/media-fixtures/t-${id}.png`, galleryUrl: `/media-fixtures/g-${id}.png`, mediaTypeId: type, dimensions: `${width} × 800`, fileSize: 1000 * id, altText: `${name} alt`, width },
    displayValues: { mediaTypeId: TYPES[type - 1].label, fileSize: `${id} KB` },
  }
})

const INSTANCE = {
  ...METADATA,
  tables: { ...METADATA.tables, media: MEDIA_TABLE, blog_post: BLOG_POST_TABLE },
  apps: {
    crm: {
      ...METADATA.apps.crm,
      children: [...METADATA.apps.crm.children, { name: 'blog_post', label: 'Blog Posts', type: 'TABLE', iconName: 'article' }],
      sections: [{ ...METADATA.apps.crm.sections[0], tables: ['person', 'blog_post'] }],
    },
  },
}

interface Criterion { fieldName: string; operator: string; values: unknown[] }
interface PickerBody { searchTerm?: string; ids?: string[]; picker?: { filter?: { criteria?: Criterion[]; orderBys?: Array<{ fieldName: string; isAscending: boolean }> }; afterId?: string | number; skip?: number; limit?: number } }

/**
 * Answer a possible-values request for the image field as the backend does for a picker request.
 * @param body - The request body.
 * @returns The response body.
 */
function pickerResponse(body: PickerBody) {
  const strip = (option: typeof MEDIA[number]) => body.picker ? option : { id: option.id, label: option.label }
  if (body.ids?.length) return { options: MEDIA.filter((option) => body.ids!.includes(String(option.id))).map(strip) }
  let rows = [...MEDIA]
  const term = body.searchTerm?.toLowerCase()
  if (term) rows = rows.filter((option) => option.label.toLowerCase().includes(term))
  for (const criterion of body.picker?.filter?.criteria ?? []) {
    if (!PICKER.filterFields.includes(criterion.fieldName)) throw new Error(`not a filter field: ${criterion.fieldName}`)
    const value = (option: typeof MEDIA[number]) => Number(option.values[criterion.fieldName as 'width'])
    if (criterion.operator === 'EQUALS') rows = rows.filter((option) => String(value(option)) === String(criterion.values[0]))
    if (criterion.operator === 'GREATER_THAN_OR_EQUALS') rows = rows.filter((option) => value(option) >= Number(criterion.values[0]))
  }
  const order = body.picker?.filter?.orderBys?.[0] ?? { fieldName: 'id', isAscending: false }
  rows.sort((a, b) => order.fieldName === 'name' ? a.label.localeCompare(b.label) : b.id - a.id)
  if (body.picker?.afterId !== undefined) rows = rows.filter((option) => option.id < Number(body.picker!.afterId))
  else rows = rows.slice(body.picker?.skip ?? 0)
  const limit = body.picker?.limit ?? PICKER.pageSize
  return { options: rows.slice(0, limit).map(strip), hasMore: body.picker ? rows.length > limit : undefined }
}

/**
 * The values of a record update: a JSON body, or multipart parts (a `values` JSON part, or one
 * part per field).
 * @param body - The raw request body.
 * @returns The values sent.
 */
function updateValues(body: string): Record<string, unknown> {
  try {
    const json = JSON.parse(body) as Record<string, unknown>
    return (json.values ?? json) as Record<string, unknown>
  } catch {
    const parts = Object.fromEntries([...body.matchAll(/name="([^"]+)"\r\n(?:[^\r\n]+\r\n)*\r\n([\s\S]*?)\r\n--/g)].map((m) => [m[1], m[2]]))
    if (parts.values) return updateValues(parts.values)
    return parts
  }
}

/**
 * Mock the blog post (stateful: an update is what a later read returns), media and the picker.
 * @param page - The page.
 * @returns The bodies of the updates sent.
 */
async function setupPickerMocks(page: Page): Promise<Array<Record<string, unknown>>> {
  await setupApiMocks(page)
  const updates: Array<Record<string, unknown>> = []
  const post = { id: 1, title: 'Harbor walk', featuredMediaId: 2 }
  const postRecord = () => ({
    tableName: 'blog_post', recordLabel: post.title,
    values: { ...post },
    displayValues: { id: '1', title: post.title, featuredMediaId: MEDIA.find((option) => option.id === post.featuredMediaId)?.label ?? '' },
  })
  const json = (route: Route, body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })

  await page.route(/\/qqq\/v1\/metaData(\?|$)/, (route) => json(route, INSTANCE))
  await page.route('**/qqq/v1/metaData/table/media**', (route) => json(route, MEDIA_TABLE))
  await page.route('**/qqq/v1/metaData/table/blog_post**', (route) => json(route, BLOG_POST_TABLE))
  await page.route(/\/qqq\/v1\/table\/blog_post\/1(\?|$)/, async (route) => {
    const method = route.request().method()
    if (method === 'PATCH' || method === 'PUT') {
      const values = updateValues(route.request().postData() ?? '')
      updates.push(values)
      if (values.featuredMediaId !== undefined) post.featuredMediaId = Number(values.featuredMediaId)
      if (typeof values.title === 'string') post.title = values.title
    }
    return json(route, { record: postRecord() })
  })
  await page.route('**/qqq/v1/table/blog_post/possibleValues/featuredMediaId**', (route) => json(route, pickerResponse(route.request().postDataJSON() as PickerBody)))
  await page.route('**/qqq/v1/table/media/possibleValues/mediaTypeId**', (route) => json(route, { options: TYPES }))
  await page.route('**/media-fixtures/**', (route) => route.fulfill({ contentType: 'image/png', body: PNG }))
  return updates
}

/**
 * Open the edit form of blog post 1 and wait for the image field.
 * @param page - The page.
 */
async function openEditForm(page: Page) {
  await page.goto('/app/blog_post/1/edit')
  await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('combobox', { name: 'Featured Image' })).toContainText('Sunset 2', { timeout: 30000 })
}

test.describe('record picker', () => {
  test('open, search, filter, page, select and save; the new image persists', async ({ page }) => {
    const updates = await setupPickerMocks(page)
    await openEditForm(page)

    // the selection shows its thumbnail with Change, Preview and View
    const combobox = page.getByRole('combobox', { name: 'Featured Image' })
    await expect(combobox.locator('img')).toHaveAttribute('src', '/media-fixtures/t-2.png')
    await expect(page.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/app/media/2')

    await page.getByRole('button', { name: 'Change…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Choose Featured Image' })
    await expect(dialog).toBeVisible()
    const results = dialog.getByRole('listbox', { name: 'Featured Image results' })
    const options = results.getByRole('option')

    // the first keyset page, newest first; the current image is not on it
    await expect(options).toHaveCount(24)
    await expect(options.first()).toContainText('Canyon 150')
    await checkA11y(page)

    // more pages by keyset as the list scrolls
    await options.last().scrollIntoViewIfNeeded()
    await expect(options).toHaveCount(48)
    await expect(options.nth(24)).toContainText('126')

    // search on the server (debounced)
    await dialog.getByPlaceholder('Search').fill('lighthouse')
    await expect(options.first()).toContainText('Lighthouse 147')
    await expect(options).toHaveCount(19)

    // filter by media type from the media table's own possible values
    await dialog.getByRole('button', { name: 'Filters' }).click()
    await dialog.getByLabel('Media Type').selectOption({ label: 'Logo' })
    await expect(dialog.getByRole('button', { name: 'Filters (1)' })).toBeVisible()
    await expect(options).toHaveCount(3)
    await expect(options.first()).toContainText('Lighthouse 115')

    // choose with the keyboard: focus the results, move right, confirm with Enter
    await options.first().focus()
    await page.keyboard.press('ArrowRight')
    await expect(options.nth(1)).toBeFocused()
    await expect(dialog.locator('[data-qqq-id="record-picker-preview"]')).toContainText('Lighthouse 75')
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()

    await expect(combobox).toContainText('Lighthouse 75')
    await expect(combobox.locator('img')).toHaveAttribute('src', '/media-fixtures/t-75.png')

    await page.locator('[data-qqq-id="button-save"], button:has-text("Save")').first().click()
    await expect.poll(() => updates.length).toBe(1)
    expect(String(updates[0].featuredMediaId)).toBe('75')

    // a fresh load of the edit form shows the saved image
    await openEditFormAfterSave(page)
  })

  test('remembers the filters of the field and closes with Escape', async ({ page }) => {
    await setupPickerMocks(page)
    await openEditForm(page)
    await page.getByRole('button', { name: 'Change…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Choose Featured Image' })
    await dialog.getByRole('button', { name: 'Filters' }).click()
    await dialog.getByLabel('Media Type').selectOption({ label: 'Logo' })
    await expect(dialog.getByRole('listbox').getByRole('option')).toHaveCount(24)
    await dialog.getByRole('button', { name: 'List view' }).click()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('button', { name: 'Change…' })).toBeFocused()

    await page.getByRole('button', { name: 'Change…' }).click()
    await expect(dialog.getByRole('button', { name: 'Filters (1)' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true')
    await expect(dialog.getByRole('listbox').getByRole('option').first()).toContainText('Canyon 150')
  })
})

/**
 * After saving, the record is read back from the (stateful) mock: the edit form shows the new image.
 * @param page - The page.
 */
async function openEditFormAfterSave(page: Page) {
  await page.goto('/app/blog_post/1/edit')
  const combobox = page.getByRole('combobox', { name: 'Featured Image' })
  await expect(combobox).toContainText('Lighthouse 75', { timeout: 30000 })
  await expect(combobox.locator('img')).toHaveAttribute('src', '/media-fixtures/t-75.png')
}

// Screenshots for the PR (light and dark at phone, tablet and desktop widths), only on request:
// QQQ_PICKER_SCREENSHOTS=<dir> pnpm test:e2e record-picker
const SCREENSHOT_DIR = process.env.QQQ_PICKER_SCREENSHOTS
test.describe('record picker screenshots', () => {
  test.skip(!SCREENSHOT_DIR, 'set QQQ_PICKER_SCREENSHOTS to capture')
  for (const width of [390, 1024, 1440]) {
    for (const mode of ['light', 'dark'] as const) {
      test(`${mode} at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
        await page.addInitScript((dark) => localStorage.setItem('qqq-dark-mode', String(dark)), mode === 'dark')
        await setupPickerMocks(page)
        await openEditForm(page)
        await page.screenshot({ path: `${SCREENSHOT_DIR}/field-${mode}-${width}.png` })
        await page.getByRole('button', { name: 'Change…' }).click()
        const dialog = page.getByRole('dialog', { name: 'Choose Featured Image' })
        await expect(dialog.getByRole('listbox').getByRole('option').first()).toBeVisible()
        await dialog.getByRole('listbox').getByRole('option').nth(2).click()
        await dialog.getByRole('button', { name: 'Filters' }).click()
        await expect(dialog.getByLabel('Media Type')).toBeVisible()
        await page.waitForLoadState('networkidle')
        // no horizontal scroll inside the dialog at any width
        expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
        await page.screenshot({ path: `${SCREENSHOT_DIR}/picker-${mode}-${width}.png` })
        await dialog.getByRole('button', { name: 'List view' }).click()
        await page.screenshot({ path: `${SCREENSHOT_DIR}/picker-list-${mode}-${width}.png` })
      })
    }
  }
})
