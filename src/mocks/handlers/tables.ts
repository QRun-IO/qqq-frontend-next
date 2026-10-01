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
 * @file MSW handlers for table data endpoints (CRUD, query, count, and audits).
 *
 * Uses an in-memory mutable store — mutations persist within a browser session
 * and are reset on page reload.
 */

import { http, HttpResponse } from 'msw'
import type { QRecord } from '@/types'
import { personRecords } from '../fixtures/records/person'
import { companyRecords } from '../fixtures/records/company'
import { orderRecords } from '../fixtures/records/order'
import { orderLineRecords } from '../fixtures/records/order-line'
import { productRecords } from '../fixtures/records/product'
import { supplierRecords } from '../fixtures/records/supplier'
import { auditRecords } from '../fixtures/records/audits'

const BASE = '/qqq/v1'

// ─── In-memory store ──────────────────────────────────────────────────────────

/**
 * Deep-clones a value via JSON serialization so mutations do not contaminate the originals.
 *
 * @param data - The value to clone.
 * @returns A deep clone of `data`.
 */
function deepClone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T
}

const store: Record<string, QRecord[]> = {
  person: deepClone(personRecords),
  company: deepClone(companyRecords),
  order: deepClone(orderRecords),
  orderLine: deepClone(orderLineRecords),
  product: deepClone(productRecords),
  supplier: deepClone(supplierRecords),
}

// Auto-increment counters per table
const nextId: Record<string, number> = {
  person: 26,
  company: 11,
  order: 21,
  orderLine: 21,
  product: 16,
  supplier: 9,
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

interface FilterCriteria {
  fieldName: string
  operator: string
  values: unknown[]
}

interface QueryFilter {
  criteria?: FilterCriteria[]
  booleanOperator?: 'AND' | 'OR'
  skip?: number
  limit?: number
  orderBys?: Array<{ fieldName: string; isAscending: boolean }>
}

/**
 * Tests whether a record satisfies a single filter criterion.
 *
 * Coerces field values and filter values to lowercase strings for comparison.
 * Numeric operators (`LESS_THAN`, etc.) compare as numbers.
 *
 * @param record - The record to test.
 * @param criteria - The filter criterion to apply.
 * @returns `true` if the record's field value satisfies the criterion.
 */
function matchesCriteria(record: QRecord, criteria: FilterCriteria): boolean {
  const rawValue = record.values[criteria.fieldName]
  const value = rawValue !== undefined && rawValue !== null ? String(rawValue).toLowerCase() : ''
  const filterValues = criteria.values.map((v) => String(v).toLowerCase())
  const first = filterValues[0] ?? ''

  switch (criteria.operator) {
    case 'EQUALS':
      return value === first
    case 'NOT_EQUALS':
      return value !== first
    case 'CONTAINS':
      return value.includes(first)
    case 'NOT_CONTAINS':
      return !value.includes(first)
    case 'STARTS_WITH':
      return value.startsWith(first)
    case 'ENDS_WITH':
      return value.endsWith(first)
    case 'IN':
      return filterValues.includes(value)
    case 'NOT_IN':
      return !filterValues.includes(value)
    case 'IS_BLANK':
      return rawValue === null || rawValue === undefined || rawValue === ''
    case 'IS_NOT_BLANK':
      return rawValue !== null && rawValue !== undefined && rawValue !== ''
    case 'LESS_THAN':
      return Number(rawValue) < Number(filterValues[0])
    case 'LESS_THAN_OR_EQUALS':
      return Number(rawValue) <= Number(filterValues[0])
    case 'GREATER_THAN':
      return Number(rawValue) > Number(filterValues[0])
    case 'GREATER_THAN_OR_EQUALS':
      return Number(rawValue) >= Number(filterValues[0])
    default:
      return true
  }
}

/**
 * Applies filter criteria and sort order to a list of records.
 *
 * Criteria are combined with the `booleanOperator` from the filter (defaults to `AND`).
 * Sort is stable and locale-aware, with numeric sensitivity.
 *
 * @param records - The full list of records to filter and sort.
 * @param filter - The query filter containing criteria and sort order.
 * @returns A new array containing only the records that match the filter, in sort order.
 */
function applyFilter(records: QRecord[], filter: QueryFilter): QRecord[] {
  let result = [...records]

  if (filter.criteria && filter.criteria.length > 0) {
    const op = filter.booleanOperator ?? 'AND'
    result = result.filter((record) => {
      const matches = filter.criteria!.map((c) => matchesCriteria(record, c))
      return op === 'AND' ? matches.every(Boolean) : matches.some(Boolean)
    })
  }

  if (filter.orderBys && filter.orderBys.length > 0) {
    result.sort((a, b) => {
      for (const orderBy of filter.orderBys!) {
        const aVal = a.values[orderBy.fieldName]
        const bVal = b.values[orderBy.fieldName]
        const aStr = aVal !== null && aVal !== undefined ? String(aVal) : ''
        const bStr = bVal !== null && bVal !== undefined ? String(bVal) : ''
        const cmp = aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' })
        if (cmp !== 0) return orderBy.isAscending ? cmp : -cmp
      }
      return 0
    })
  }

  return result
}

// ─── Primary key lookup ───────────────────────────────────────────────────────

const primaryKeyFields: Record<string, string> = {
  person: 'id',
  company: 'id',
  order: 'id',
  orderLine: 'id',
  product: 'id',
  supplier: 'id',
}

/**
 * Returns the primary key field name for a given table, defaulting to `'id'`.
 *
 * @param tableName - The table name to look up.
 * @returns The primary key field name for that table.
 */
function getPkField(tableName: string): string {
  return primaryKeyFields[tableName] ?? 'id'
}

// ─── Auto-generate order number ───────────────────────────────────────────────

/**
 * Generates the next sequential order number in `ORD-YYYY-NNNN` format.
 *
 * @returns A new order number string based on the current year and auto-increment counter.
 */
function generateOrderNumber(): string {
  const year = new Date().getFullYear()
  const seq = String((nextId['order'] ?? 1)).padStart(4, '0')
  return `ORD-${year}-${seq}`
}

// ─── Record label generators ──────────────────────────────────────────────────

/**
 * Builds a human-readable record label from a record's field values.
 *
 * The label format is table-specific (e.g. full name for `person`, order number for `order`).
 *
 * @param tableName - The table the record belongs to.
 * @param values - The record's raw field values.
 * @returns A computed label string for display in search results and record views.
 */
function buildRecordLabel(tableName: string, values: Record<string, unknown>): string {
  switch (tableName) {
    case 'person':
      return `${values['firstName'] ?? ''} ${values['lastName'] ?? ''}`.trim()
    case 'company':
    case 'supplier':
      return String(values['name'] ?? '')
    case 'order':
      return String(values['orderNumber'] ?? '')
    case 'product':
      return String(values['name'] ?? '')
    case 'orderLine':
      return `Line ${values['id'] ?? ''} — ${values['productName'] ?? ''}`
    default:
      return String(values['id'] ?? '')
  }
}

// ─── Request body parsing ─────────────────────────────────────────────────────

/**
 * Parses an incoming MSW request body as a key/value map.
 *
 * Handles JSON and form-encoded content types. Numeric string values are
 * coerced to numbers; `"true"`/`"false"` are coerced to booleans. Falls
 * back to an empty object if the body cannot be parsed.
 *
 * @param request - The incoming MSW request object.
 * @returns The parsed body as a `Record<string, unknown>`.
 */
async function parseRequestBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return (await request.json()) as Record<string, unknown>
  }

  if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData()
    const values: Record<string, unknown> = {}
    formData.forEach((value, key) => {
      const str = String(value)
      // Attempt numeric coercion for known numeric-looking values
      if (str === '') {
        values[key] = null
      } else if (/^-?\d+(\.\d+)?$/.test(str)) {
        values[key] = Number(str)
      } else if (str === 'true') {
        values[key] = true
      } else if (str === 'false') {
        values[key] = false
      } else {
        values[key] = str
      }
    })
    return values
  }

  // Fallback — try JSON
  try {
    return (await request.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

// ─── Table labels for search ──────────────────────────────────────────────────

const tableLabels: Record<string, string> = {
  person: 'People',
  company: 'Companies',
  order: 'Orders',
  orderLine: 'Order Lines',
  product: 'Products',
  supplier: 'Suppliers',
}

// ─── Handlers ────────────────────────────────────────────────────────────────

export const tableHandlers = [

  // POST /search — global search across all tables
  http.post(`${BASE}/search`, async ({ request }) => {
    const body = await request.json() as { searchTerm?: string }
    const term = (body?.searchTerm ?? '').toLowerCase().trim()
    if (!term || term.length < 2) {
      return HttpResponse.json([])
    }
    // Magic term for error testing
    if (term === '__error__') {
      return HttpResponse.json({ error: 'Simulated server error' }, { status: 500 })
    }
    const results: Array<{ tableName: string; tableLabel: string; recordId: string; recordLabel: string }> = []
    for (const [tableName, records] of Object.entries(store)) {
      for (const record of records) {
        const label = buildRecordLabel(tableName, record.values as Record<string, unknown>)
        const pkField = getPkField(tableName)
        if (
          label.toLowerCase().includes(term) ||
          Object.values(record.values as Record<string, unknown>).some(
            (v) => String(v ?? '').toLowerCase().includes(term)
          )
        ) {
          results.push({
            tableName,
            tableLabel: tableLabels[tableName] ?? tableName,
            recordId: String((record.values as Record<string, unknown>)[pkField]),
            recordLabel: label,
          })
        }
      }
    }
    return HttpResponse.json(results.slice(0, 20))
  }),

  // POST /table/:tableName/query
  http.post(`${BASE}/table/:tableName/query`, async ({ params, request }) => {
    const { tableName } = params as { tableName: string }
    const records = store[tableName]

    if (!records) {
      return HttpResponse.json({ error: `Table '${tableName}' not found` }, { status: 404 })
    }

    let body: { filter?: QueryFilter } = {}
    try {
      body = (await request.json()) as { filter?: QueryFilter }
    } catch {
      body = {}
    }

    const filter = body.filter ?? {}
    const filtered = applyFilter(records, filter)

    const skip = filter.skip ?? 0
    const limit = filter.limit ?? 50
    const page = filtered.slice(skip, skip + limit)

    return HttpResponse.json({ records: page })
  }),

  // POST /table/:tableName/count
  http.post(`${BASE}/table/:tableName/count`, async ({ params, request }) => {
    const { tableName } = params as { tableName: string }
    const records = store[tableName]

    if (!records) {
      return HttpResponse.json({ error: `Table '${tableName}' not found` }, { status: 404 })
    }

    let body: { filter?: QueryFilter } = {}
    try {
      body = (await request.json()) as { filter?: QueryFilter }
    } catch {
      body = {}
    }

    const filter = body.filter ?? {}
    const filtered = applyFilter(records, filter)

    return HttpResponse.json({ count: filtered.length, distinctCount: filtered.length })
  }),

  // GET /table/:tableName/:primaryKey/audits
  http.get(`${BASE}/table/:tableName/:primaryKey/audits`, ({ params }) => {
    const { tableName, primaryKey } = params as { tableName: string; primaryKey: string }
    const key = `${tableName}:${primaryKey}`
    const records = auditRecords[key] ?? []
    return HttpResponse.json({ records })
  }),

  // v1 GET /table/:tableName/:primaryKey — { record }
  http.get(`${BASE}/table/:tableName/:primaryKey`, ({ params, request }) => {
    const { tableName, primaryKey } = params as { tableName: string; primaryKey: string }
    const records = store[tableName]

    if (!records) {
      return HttpResponse.json({ error: `Table '${tableName}' not found` }, { status: 404 })
    }

    const pkField = getPkField(tableName)
    const record = records.find((r) => String(r.values[pkField]) === primaryKey)

    if (!record) {
      return HttpResponse.json(
        { error: `Record '${primaryKey}' not found in table '${tableName}'` },
        { status: 404 }
      )
    }

    // If includeAssociations is requested, attach child records
    const url = new URL(request.url)
    const includeAssociations = url.searchParams.get('includeAssociations')

    if (includeAssociations === 'true') {
      const associatedRecords: Record<string, QRecord[]> = {}

      // Look up child records based on known relationships
      if (tableName === 'order') {
        const orderLines = store['orderLine']?.filter(
          (r) => String(r.values['orderId']) === primaryKey
        ) ?? []
        if (orderLines.length > 0) {
          associatedRecords['orderLine'] = orderLines
        }
      }

      if (tableName === 'person') {
        const orders = store['order']?.filter(
          (r) => String(r.values['personId']) === primaryKey
        ) ?? []
        if (orders.length > 0) {
          associatedRecords['order'] = orders
        }
      }

      if (tableName === 'company') {
        const orders = store['order']?.filter(
          (r) => String(r.values['companyId']) === primaryKey
        ) ?? []
        if (orders.length > 0) {
          associatedRecords['order'] = orders
        }
        const people = store['person']?.filter(
          (r) => String(r.values['companyId']) === primaryKey
        ) ?? []
        if (people.length > 0) {
          associatedRecords['person'] = people
        }
      }

      if (Object.keys(associatedRecords).length > 0) {
        return HttpResponse.json({ record: { ...record, associatedRecords } })
      }
    }

    return HttpResponse.json({ record })
  }),

  // v1 POST /table/:tableName — insert, { record }
  http.post(`${BASE}/table/:tableName`, async ({ params, request }) => {
    const { tableName } = params as { tableName: string }
    const records = store[tableName]

    if (!records) {
      return HttpResponse.json({ error: `Table '${tableName}' not found` }, { status: 404 })
    }

    const body = await parseRequestBody(request)

    const newId = nextId[tableName] ?? (records.length + 1)
    nextId[tableName] = newId + 1

    const values: Record<string, unknown> = {
      ...body,
      id: newId,
    }

    // Auto-generate order number for orders
    if (tableName === 'order' && !values['orderNumber']) {
      values['orderNumber'] = generateOrderNumber()
    }

    const newRecord: QRecord = {
      tableName,
      recordLabel: buildRecordLabel(tableName, values),
      values,
      displayValues: {
        id: String(newId),
      },
    }

    records.push(newRecord)

    return HttpResponse.json({ record: newRecord })
  }),

  // v1 PATCH /table/:tableName/:primaryKey — update, { record }
  http.patch(`${BASE}/table/:tableName/:primaryKey`, async ({ params, request }) => {
    const { tableName, primaryKey } = params as { tableName: string; primaryKey: string }
    const records = store[tableName]

    if (!records) {
      return HttpResponse.json({ error: `Table '${tableName}' not found` }, { status: 404 })
    }

    const pkField = getPkField(tableName)
    const idx = records.findIndex((r) => String(r.values[pkField]) === primaryKey)

    if (idx === -1) {
      return HttpResponse.json(
        { error: `Record '${primaryKey}' not found in table '${tableName}'` },
        { status: 404 }
      )
    }

    const body = await parseRequestBody(request)

    const existing = records[idx]
    const updatedValues: Record<string, unknown> = {
      ...existing.values,
      ...body,
      [pkField]: existing.values[pkField], // PK is immutable
    }

    const updated: QRecord = {
      ...existing,
      values: updatedValues,
      recordLabel: buildRecordLabel(tableName, updatedValues),
    }

    records[idx] = updated

    return HttpResponse.json({ record: updated })
  }),

  // v1 DELETE /table/:tableName/:primaryKey
  http.delete(`${BASE}/table/:tableName/:primaryKey`, ({ params }) => {
    const { tableName, primaryKey } = params as { tableName: string; primaryKey: string }
    const records = store[tableName]

    if (!records) {
      return HttpResponse.json({ error: `Table '${tableName}' not found` }, { status: 404 })
    }

    const pkField = getPkField(tableName)
    const idx = records.findIndex((r) => String(r.values[pkField]) === primaryKey)

    if (idx === -1) {
      return HttpResponse.json(
        { error: `Record '${primaryKey}' not found in table '${tableName}'` },
        { status: 404 }
      )
    }

    records.splice(idx, 1)

    return HttpResponse.json({ deletedRecordCount: 1 })
  }),
]
