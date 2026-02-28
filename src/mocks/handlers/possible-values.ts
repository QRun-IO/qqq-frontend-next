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

// MSW handlers for possible-values endpoints

import { http, HttpResponse } from 'msw'
import type { QPossibleValue } from '@/types'

const BASE = '/qqq/v1'

// ─── Static possible value sources ───────────────────────────────────────────

const possibleValueSources: Record<string, QPossibleValue[]> = {
  personStatus: [
    { id: 'Active', label: 'Active' },
    { id: 'Inactive', label: 'Inactive' },
    { id: 'Lead', label: 'Lead' },
  ],
  companyIndustry: [
    { id: 'Technology', label: 'Technology' },
    { id: 'Healthcare', label: 'Healthcare' },
    { id: 'Finance', label: 'Finance' },
    { id: 'Retail', label: 'Retail' },
    { id: 'Manufacturing', label: 'Manufacturing' },
    { id: 'Education', label: 'Education' },
    { id: 'Other', label: 'Other' },
  ],
  orderStatus: [
    { id: 'Pending', label: 'Pending' },
    { id: 'Processing', label: 'Processing' },
    { id: 'Shipped', label: 'Shipped' },
    { id: 'Delivered', label: 'Delivered' },
    { id: 'Cancelled', label: 'Cancelled' },
  ],
  productCategory: [
    { id: 'Electronics', label: 'Electronics' },
    { id: 'Clothing', label: 'Clothing' },
    { id: 'Food', label: 'Food' },
    { id: 'Tools', label: 'Tools' },
    { id: 'Office', label: 'Office' },
    { id: 'Other', label: 'Other' },
  ],
}

// ─── Dynamic (record-based) possible value sources ────────────────────────────
// These import fixture data to allow searching by label across the table records.
// Lazy import so we avoid circular deps with the store module.

async function getDynamicPossibleValues(
  sourceName: string,
  searchTerm: string,
  ids: string[]
): Promise<QPossibleValue[] | null> {
  switch (sourceName) {
    case 'person': {
      const { personRecords } = await import('../fixtures/records/person')
      let items = personRecords.map((r) => ({
        id: r.values['id'] as number,
        label: r.recordLabel,
      }))
      if (ids.length > 0) {
        items = items.filter((item) => ids.includes(String(item.id)))
      } else if (searchTerm) {
        items = items.filter((item) =>
          item.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }
      return items
    }
    case 'company': {
      const { companyRecords } = await import('../fixtures/records/company')
      let items = companyRecords.map((r) => ({
        id: r.values['id'] as number,
        label: r.recordLabel,
      }))
      if (ids.length > 0) {
        items = items.filter((item) => ids.includes(String(item.id)))
      } else if (searchTerm) {
        items = items.filter((item) =>
          item.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }
      return items
    }
    case 'supplier': {
      const { supplierRecords } = await import('../fixtures/records/supplier')
      let items = supplierRecords.map((r) => ({
        id: r.values['id'] as number,
        label: r.recordLabel,
      }))
      if (ids.length > 0) {
        items = items.filter((item) => ids.includes(String(item.id)))
      } else if (searchTerm) {
        items = items.filter((item) =>
          item.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }
      return items
    }
    default:
      return null
  }
}

// ─── Request body parser ──────────────────────────────────────────────────────

interface PossibleValuesRequest {
  searchTerm?: string
  ids?: string
  labels?: string
  values?: string
  useCase?: string
}

async function parseBody(request: Request): Promise<PossibleValuesRequest> {
  const contentType = request.headers.get('content-type') ?? ''
  try {
    if (contentType.includes('application/json')) {
      return (await request.json()) as PossibleValuesRequest
    }
    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const fd = await request.formData()
      const result: PossibleValuesRequest = {}
      fd.forEach((v, k) => {
        (result as Record<string, string>)[k] = String(v)
      })
      return result
    }
    return (await request.json()) as PossibleValuesRequest
  } catch {
    return {}
  }
}

// ─── Handler factory ──────────────────────────────────────────────────────────

function makePossibleValuesHandler(urlPattern: string) {
  return http.post(urlPattern, async ({ params, request }) => {
    const fieldName = (params as Record<string, string>)['fieldName'] ?? ''
    const body = await parseBody(request)

    const searchTerm = body.searchTerm ?? ''
    const idsRaw = body.ids ?? ''
    const ids = idsRaw ? idsRaw.split(',').map((s) => s.trim()).filter(Boolean) : []

    // Check static sources first
    const staticSource = possibleValueSources[fieldName]
    if (staticSource) {
      let results = staticSource
      if (ids.length > 0) {
        results = results.filter((item) => ids.includes(String(item.id)))
      } else if (searchTerm) {
        results = results.filter((item) =>
          item.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }
      return HttpResponse.json(results)
    }

    // Try dynamic (record-based) sources
    const dynamic = await getDynamicPossibleValues(fieldName, searchTerm, ids)
    if (dynamic !== null) {
      return HttpResponse.json(dynamic)
    }

    // Unknown source — return empty
    return HttpResponse.json([])
  })
}

export const possibleValuesHandlers = [
  // POST /table/:tableName/possibleValues/:fieldName
  makePossibleValuesHandler(`${BASE}/table/:tableName/possibleValues/:fieldName`),

  // POST /processes/:processName/possibleValues/:fieldName
  makePossibleValuesHandler(`${BASE}/processes/:processName/possibleValues/:fieldName`),

  // POST /possibleValues/:fieldName
  makePossibleValuesHandler(`${BASE}/possibleValues/:fieldName`),
]
