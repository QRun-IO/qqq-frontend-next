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
 * @file Alerts API — the Alerts qbit's notification center (`/alerts/inbox*`) and record panel
 * (`/alerts/record-panel*`). Callers only request these when the instance metadata lists the
 * qbit's `alerts` app (see `isAlertsInstalled`). As a fallback, 403 and 404 from the inbox
 * summary (or a body that is not a summary, e.g. a root SPA's not-found page) still mean Alerts
 * is not for this user, so the bell and panel stay hidden. Items are normalized so older
 * backends (qbit-alerts 0.1.0-RC.1: `alertId`, `group`, no `id`) still render.
 */

import type { AlertsInboxSummary, AlertsRecordPanel, InboxFilter, InboxItem, InboxPage, InboxTarget, NotificationSeverity } from '@/types/alerts'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import apiClient from './client'

/** The notifications page, unless the backend names another app path. */
export const NOTIFICATIONS_PATH = '/app/notifications'

const SEVERITIES = ['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'CRITICAL']

/**
 * A finite number, or undefined.
 *
 * @param value - Any value.
 * @returns The number, or undefined.
 */
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

/**
 * A non-empty string, or null.
 *
 * @param value - Any value.
 * @returns The string, or null.
 */
const str = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null)

/**
 * Normalizes one item of either backend shape; null when it has no title.
 *
 * @param raw - The item as sent.
 * @param index - Its position (the fallback key).
 * @returns The item, or null.
 */
export function normalizeInboxItem(raw: unknown, index: number): InboxItem | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const title = str(item.title)
  if (!title) return null
  const id = num(item.id)
  const alertId = num(item.alertId)
  const severity = SEVERITIES.includes(item.severity as string) ? (item.severity as NotificationSeverity) : 'INFO'
  return {
    key: id !== undefined ? `n${id}` : alertId !== undefined ? `a${alertId}` : `i${index}`,
    id,
    notificationId: num(item.notificationId),
    alertId,
    title,
    body: str(item.body),
    severity,
    category: str(item.category),
    source: str(item.source) ?? str(item.group),
    href: str(item.href),
    linkLabel: str(item.linkLabel),
    deliveredAt: str(item.deliveredAt) ?? str(item.raisedAt),
    age: str(item.age),
    unread: item.unread === true,
    sticky: item.sticky === true,
  }
}

/**
 * Normalizes a list of items, dropping any without a title.
 *
 * @param raw - The list as sent.
 * @returns The items.
 */
function normalizeItems(raw: unknown): InboxItem[] {
  return Array.isArray(raw) ? raw.map(normalizeInboxItem).filter((item): item is InboxItem => item !== null) : []
}

/**
 * Loads the bell: unread count, highest unread severity, the latest items and the banners.
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
  const summary = data as Record<string, unknown>
  if (typeof summary.unreadCount !== 'number' || !Array.isArray(summary.items)) return null
  const href = str(summary.notificationsHref)
  return {
    unreadCount: summary.unreadCount,
    highestUnreadSeverity: SEVERITIES.includes(summary.highestUnreadSeverity as string) ? (summary.highestUnreadSeverity as NotificationSeverity) : null,
    items: normalizeItems(summary.items),
    banners: normalizeItems(summary.banners),
    notificationsHref: href && href.startsWith('/app/') ? href : NOTIFICATIONS_PATH,
    preferencesSection: str(summary.preferencesSection),
    pollSeconds: num(summary.pollSeconds),
  }
}

/**
 * Loads one page of the inbox.
 *
 * @param filter - Status, category, severity and paging.
 * @returns The page (an empty page for a body that is not one).
 */
export async function getAlertsInbox(filter: InboxFilter): Promise<InboxPage> {
  const params: Record<string, string> = { status: filter.status, offset: String(filter.offset), limit: String(filter.limit) }
  if (filter.category) params.category = filter.category
  if (filter.severity) params.severity = filter.severity
  const data = await apiClient.get<Record<string, unknown> | null>('/alerts/inbox', { params })
  const items = normalizeItems(data?.items)
  return { items, total: num(data?.total) ?? items.length, offset: num(data?.offset) ?? filter.offset, limit: num(data?.limit) ?? filter.limit }
}

/**
 * Posts an inbox action.
 *
 * @param action - `read`, `unread` or `dismiss`.
 * @param target - `{id}`, `{ids}`, `{all: true}`, or (read only, older backends) `{alertId}`.
 * @returns How many items changed.
 */
export async function postInboxAction(action: 'read' | 'unread' | 'dismiss', target: InboxTarget): Promise<number> {
  // One literal path per action, so each call matches its operation in the alerts extension document.
  let data: { updated?: number } | undefined
  if (action === 'read') data = await apiClient.post<{ updated?: number }>('/alerts/inbox/read', target)
  else if (action === 'unread') data = await apiClient.post<{ updated?: number }>('/alerts/inbox/unread', target)
  else data = await apiClient.post<{ updated?: number }>('/alerts/inbox/dismiss', target)
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

