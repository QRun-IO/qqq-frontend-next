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
 * @file Metadata API — Endpoints that return QQQ instance, table, and process metadata.
 */

import type { QInstance, QTableMetaData, QProcessMetaData } from '@/types'
import apiClient from './client'
import { QInstanceMinimalSchema } from './schemas'

/**
 * Fetches the top-level QQQ instance metadata from `GET /metaData`.
 *
 * The response describes the full application structure: registered apps, tables,
 * processes, and navigation. The `frontendName` and `frontendVersion` query params
 * are forwarded so the server can tailor the response to this frontend's capabilities.
 *
 * @returns The `QInstance` object containing all top-level application metadata,
 *   including: `apps` (sidebar navigation sources), `appTree` (navigation tree),
 *   `tables` (drives every record page), `processes` (drives process wizard pages),
 *   `widgets` (registered dashboard widgets), and `branding` (company/app name).
 */
export async function loadMetaData(): Promise<QInstance> {
  const result = await apiClient.get<QInstance>('/metaData', {
    params: {
      frontendName: 'qqq-frontend-next',
      frontendVersion: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
    },
  })
  const parsed = QInstanceMinimalSchema.safeParse(result)
  if (!parsed.success) {
    console.warn('[API] QInstance metadata response failed schema validation:', parsed.error.flatten())
  }
  // V1 supplies light widget metadata. Resolve permission/presentation fields
  // through the registered full metadata route instead of assuming access.
  if (Object.values(result.widgets ?? {}).some((widget) => typeof widget.hasPermission !== 'boolean')) {
    const full = await apiClient.get<QInstance>('/metaData', {
      baseURL: apiClient.getInstance().defaults.baseURL?.replace(/\/qqq\/v1\/?$/, ''),
      params: {
        frontendName: 'qqq-frontend-next',
        frontendVersion: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
      },
    })
    if (!full || !full.widgets || typeof full.widgets !== 'object' || Array.isArray(full.widgets)) {
      throw new Error('Invalid widget metadata response')
    }
    // V1 has no reports map; the full route carries each report's permission and process.
    const reports = full.reports && typeof full.reports === 'object' && !Array.isArray(full.reports) ? full.reports : result.reports
    return { ...result, widgets: full.widgets, reports: reports ?? {} }
  }
  return result
}

/**
 * Fetches metadata for a single table from `GET /metaData/table/{tableName}`.
 *
 * The returned object describes every field, section, capability, and association
 * that the table exposes. Used to drive dynamic rendering of record query, view,
 * and edit pages.
 *
 * @param tableName - Exact backend identifier of the table (e.g. `"person"`);
 *   case-sensitive, must match the backend declaration exactly, and is used as
 *   a URL path segment. Sourced from `QInstance.tables` keys — never hardcoded.
 * @returns Table metadata including: `fields` (name, type, label, PVS config),
 *   `sections` (layout groups for record view/edit), `capabilities` (which CRUD
 *   operations are permitted), and `associations` (child table relationships).
 */
export async function loadTableMetaData(tableName: string): Promise<QTableMetaData> {
  return apiClient.get<QTableMetaData>(`/metaData/table/${encodeURIComponent(tableName)}`)
}

/**
 * Fetches metadata for a single process from `GET /metaData/process/{processName}`.
 *
 * The returned object describes each step, its input/output fields, and the
 * overall process configuration. Used to drive the step-wizard UI.
 *
 * @param processName - Exact backend identifier of the process (e.g. `"bulkInsert"`);
 *   case-sensitive, must match the backend declaration exactly, and is used as a
 *   URL path segment. Sourced from `QInstance.processes` keys — never hardcoded.
 * @returns Process metadata including: `steps` (ordered list of step definitions),
 *   each step's `fields` (input/output fields with types and validation rules),
 *   and overall process configuration such as the process label and step components.
 */
export async function loadProcessMetaData(processName: string): Promise<QProcessMetaData> {
  return apiClient.get<QProcessMetaData>(`/metaData/process/${encodeURIComponent(processName)}`)
}
