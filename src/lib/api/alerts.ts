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
 * @file Alerts API — the Alerts qbit's bell (`/alerts/inbox/*`) and record panel
 * (`/alerts/record-panel*`). The inbox summary doubles as the feature probe: 403 and 404 (or
 * a body that is not a summary, e.g. a root SPA's not-found page) mean the qbit is absent or
 * not for this user, so the bell and panel stay hidden.
 */

import type { AlertsInboxSummary, AlertsRecordPanel } from '@/types/alerts'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import apiClient from './client'

/**
 * Loads the bell: unread count, highest unread severity and the latest items.
 *
 * @returns The summary, or `null` when Alerts is not available to this user.
 * @throws The request error for any other failure.
 */
export async function getAlertsInboxSummary(): Promise<AlertsInboxSummary | null> {
  let data: unknown
  try {
    data = await apiClient.get<unknown>('/alerts/inbox/summary')
  } catch (error) {
    const status = getErrorStatusCode(error)
    if (status === 403 || status === 404) return null
    throw error
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const summary = data as Partial<AlertsInboxSummary>
  if (typeof summary.unreadCount !== 'number' || !Array.isArray(summary.items)) return null
  return {
    unreadCount: summary.unreadCount,
    highestUnreadSeverity: summary.highestUnreadSeverity ?? null,
    items: summary.items,
    alertsHref: typeof summary.alertsHref === 'string' ? summary.alertsHref : '/app/alerts',
    pollSeconds: summary.pollSeconds,
  }
}

/**
 * Marks one alert's inbox item read, or all of the user's.
 *
 * @param target - `{ alertId }` for one item, or `{ all: true }`.
 * @returns How many items were marked read.
 */
export async function markAlertsRead(target: { alertId: number } | { all: true }): Promise<number> {
  const data = await apiClient.post<{ updated?: number }>('/alerts/inbox/read', target)
  return typeof data?.updated === 'number' ? data.updated : 0
}

/**
 * Loads the "Open alerts" panel for a record.
 *
 * @param tableName - The record's table.
 * @param recordId - The record's primary key.
 * @returns The panel, or `null` when Alerts is not available (or not for this table).
 * @throws The request error for any other failure.
 */
export async function getAlertsRecordPanel(tableName: string, recordId: string | number): Promise<AlertsRecordPanel | null> {
  let data: unknown
  try {
    data = await apiClient.get<unknown>('/alerts/record-panel', { params: { tableName, recordId: String(recordId) } })
  } catch (error) {
    const status = getErrorStatusCode(error)
    if (status === 400 || status === 403 || status === 404) return null
    throw error
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof (data as { visible?: unknown }).visible !== 'boolean') return null
  return data as AlertsRecordPanel
}

/**
 * "Watch alerts for this record": subscribes the user to the record's alerts.
 *
 * @param tableName - The record's table.
 * @param recordId - The record's primary key.
 * @returns Whether a new subscription was created (false when already watching).
 */
export async function watchAlertsRecord(tableName: string, recordId: string | number): Promise<boolean> {
  const data = await apiClient.post<{ created?: boolean }>('/alerts/record-panel/watch', { tableName, recordId })
  return data?.created === true
}
