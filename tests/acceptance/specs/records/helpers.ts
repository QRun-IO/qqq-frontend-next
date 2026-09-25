/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Locator, Page, Request } from '@playwright/test'
import { expect, type Backend } from '../../support/fixtures'

/** Every records spec runs in a fixed zone and locale so DATE_TIME text is deterministic. */
export const VIEWER = { timezoneId: 'America/New_York', locale: 'en-US' } as const

/** The rendered value of a field on the record view (or header). */
export function fieldValue(page: Page, fieldName: string): Locator {
  return page.locator(`[data-qqq-id="field-value-${fieldName}"]`).first()
}

/** A form control by field name (`field-<name>` ids). */
export function control(page: Page, fieldName: string): Locator {
  return page.locator(`#field-${fieldName}`)
}

/** Toast notifications currently shown (sonner). */
export function toasts(page: Page): Locator {
  return page.locator('[data-sonner-toast]')
}

/** Reads exactly one row with an independent SQL query. */
export async function sqlOne(backend: Backend, query: string): Promise<Record<string, string | null>> {
  const rows = await backend.sql(query)
  expect(rows, query).toHaveLength(1)
  return rows[0]
}

/** Number of rows matching a SQL count query (`select count(*) as n ...`). */
export async function sqlCount(backend: Backend, query: string): Promise<number> {
  return Number((await sqlOne(backend, query)).n)
}

/**
 * Records every request whose path starts with a prefix, for asserting what was (not) sent.
 * The table's v1 query, count and possible-value requests share a table prefix and are not
 * record requests (unless the prefix names them).
 */
export function recordRequests(page: Page, pathPrefix: string): Request[] {
  const requests: Request[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (path.startsWith(pathPrefix) && !/^\/(query|count|possibleValues\/.*)$/.test(path.slice(pathPrefix.length))) requests.push(request)
  })
  return requests
}

/** Multipart field names and text values of a captured record write. */
export function multipartFields(request: Request): Record<string, string> {
  const body = request.postDataBuffer()?.toString('latin1') ?? ''
  const boundary = /boundary=([^;]+)/.exec(request.headers()['content-type'] ?? '')?.[1]
  if (!boundary) return {}
  const fields: Record<string, string> = {}
  for (const part of body.split(`--${boundary}`)) {
    const name = /name="([^"]+)"/.exec(part)?.[1]
    if (!name) continue
    const value = part.slice(part.indexOf('\r\n\r\n') + 4).replace(/\r\n$/, '')
    fields[name] = value
  }
  return fields
}

/** Waits for the record view of a table to render its heading. */
export async function openRecord(page: Page, table: string, id: string | number, heading: string) {
  await page.goto(`/app/${table}/${id}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
}

/** Waits for an entity form (create, edit or copy) to render. */
export async function openForm(page: Page, path: string, heading: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible()
}

/**
 * Starts a record action (Edit, Copy or Delete) whether the view shows it as a
 * button or inside the Actions menu (tables with record processes).
 */
export async function recordAction(page: Page, action: 'Edit' | 'Copy' | 'Delete', tableLabel: string) {
  const button = page.getByRole('button', { name: `${action} ${tableLabel} record` })
  const menu = page.getByRole('button', { name: 'Record actions menu' })
  await expect(button.or(menu).first()).toBeVisible()
  if (await button.count()) {
    await button.click()
    return
  }
  await menu.click()
  await page.getByRole('menuitem', { name: action, exact: true }).click()
}

/** The record's primary key from a record view URL such as /app/person/7. */
export function recordIdFromUrl(page: Page, table: string): string {
  const match = new RegExp(`/app/${table}/(\\d+)/?$`).exec(new URL(page.url()).pathname)
  expect(match, `record view URL for ${table}: ${page.url()}`).not.toBeNull()
  return match![1]
}
