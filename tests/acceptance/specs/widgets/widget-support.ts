/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Helpers for the widgets & reports acceptance specs.
import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import type { APIRequestContext, Download, Locator, Page } from '@playwright/test'
import { expect } from '../../support/fixtures'
import type { Backend } from '../../support/fixtures'

/** Reads rows whose selected columns are all non-null (fails otherwise). */
export async function sqlRows(backend: Backend, query: string): Promise<Array<Record<string, string>>> {
  const rows = await backend.sql(query)
  for (const row of rows) {
    for (const [column, value] of Object.entries(row)) {
      if (value === null) throw new Error(`${column} is null in ${query}`)
    }
  }
  return rows as Array<Record<string, string>>
}

/** The visible element with a data-qqq-id (record views mount one layout; WID-065 proves it). */
export function byId(page: Page, id: string): Locator {
  return page.locator(`[data-qqq-id="${id}"]`).filter({ visible: true })
}

/** The widget card (or container) rendered for a widget name. */
export function widget(page: Page, name: string): Locator {
  return byId(page, `widget-${name}`)
}

/** The body of a widget. */
export function widgetBody(page: Page, name: string): Locator {
  return byId(page, `widget-content-${name}`)
}

/** Waits until the widget's data has arrived (its card is no longer busy). */
export async function expectLoaded(page: Page, name: string) {
  await expect(widget(page, name)).toBeVisible()
  await expect(widget(page, name)).toHaveAttribute('aria-busy', 'false')
}

/** Whether the page shows the phone layout (below Tailwind's `md` breakpoint, 768 px). */
export async function isPhoneLayout(page: Page): Promise<boolean> {
  return page.evaluate(() => matchMedia('(max-width: 767.98px)').matches)
}

/** Whether the page shows the desktop dashboard grid (Tailwind's `lg` breakpoint, 1024 px). */
export async function isLargeLayout(page: Page): Promise<boolean> {
  return page.evaluate(() => matchMedia('(min-width: 1024px)').matches)
}

/**
 * Opens a record view and shows every section: on a phone the sections are an accordion with
 * only the first one open, so widgets in the others render once their section is expanded.
 */
export async function openRecord(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await showRecordSections(page)
}

/** Shows every section of the record view on screen (expands the phone accordion; see {@link openRecord}). */
export async function showRecordSections(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  if (!(await isPhoneLayout(page))) return
  const accordion = page.locator('[data-qqq-id="record-view-accordion"]')
  await expect(accordion).toBeVisible()
  const closed = accordion.locator('[data-qqq-id^="accordion-trigger-"][aria-expanded="false"]')
  for (let count = await closed.count(); count > 0; count = await closed.count()) {
    await closed.first().click()
    await expect(closed).toHaveCount(count - 1)
  }
}

/**
 * Runs one of a record's actions: from the Actions menu on wider screens, from the record
 * actions sheet on a phone.
 */
export async function recordAction(page: Page, label: string) {
  if (await isPhoneLayout(page)) {
    await page.locator('[data-qqq-id="button-mobile-actions"]').click()
    await page.getByRole('dialog', { name: 'Record actions' }).getByRole('button', { name: label }).click()
    return
  }
  await page.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name: label }).click()
}

/** The backend's own payload for a widget, read with the test's session. */
export async function widgetPayload(api: APIRequestContext, name: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString()
  const response = await api.get(`/widget/${name}${query ? `?${query}` : ''}`)
  expect(response.status(), `payload for ${name}`).toBe(200)
  return response.json()
}

/** The rows of the accessible data table a chart renders ([label, ...values]). */
export async function chartTable(page: Page, name: string): Promise<string[][]> {
  const table = page.locator(`[data-qqq-id="chart-data-${name}"]`)
  await expect(table).toHaveCount(1)
  return table.locator('tbody tr').evaluateAll((rows) => rows.map((row) => Array.from(row.querySelectorAll('th,td')).map((cell) => (cell.textContent ?? '').trim())))
}

/** Reads a finished download as text. */
export async function downloadText(download: Download): Promise<string> {
  const path = await download.path()
  if (!path) throw new Error('download did not complete')
  return readFileSync(path, 'utf8')
}

/** Reads a finished download as bytes. */
export async function downloadBytes(download: Download): Promise<Buffer> {
  const path = await download.path()
  if (!path) throw new Error('download did not complete')
  return readFileSync(path)
}

/**
 * Minimal ZIP reader (stored and deflated entries) for inspecting XLSX files
 * without adding a dependency. Returns entry name → contents.
 */
export function readZip(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>()
  let end = buffer.length - 22
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--
  if (end < 0) throw new Error('not a zip file')
  const count = buffer.readUInt16LE(end + 10)
  let offset = buffer.readUInt32LE(end + 16)
  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('bad central directory')
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const start = localOffset + 30 + localNameLength + localExtraLength
    const data = buffer.subarray(start, start + compressedSize)
    entries.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data))
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/**
 * Cell texts of the first worksheet of an XLSX file, resolving shared strings,
 * as rows of strings in sheet order.
 */
export function xlsxRows(buffer: Buffer, sheet = 'xl/worksheets/sheet1.xml'): string[][] {
  const zip = readZip(buffer)
  const shared = [...(zip.get('xl/sharedStrings.xml')?.toString('utf8') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((match) => [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((text) => decode(text[1])).join(''))
  const xml = zip.get(sheet)?.toString('utf8')
  if (!xml) throw new Error(`no ${sheet}`)
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((row) =>
    [...row[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map((cell) => {
      const attributes = cell[1]
      const body = cell[2] ?? ''
      const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
      const inline = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1]
      if (/t="s"/.test(attributes) && value !== undefined) return shared[Number(value)] ?? ''
      if (inline !== undefined) return decode(inline)
      return value === undefined ? '' : decode(value)
    }))
}

/** Decodes XML entities. */
function decode(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

/** Parses simple CSV (quoted fields, doubled quotes) into rows. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index++ } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(cell); cell = '' } else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = '' } else if (char !== '\r') cell += char
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows
}
