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

// Tests for the optimistic inbox updates and the notification helpers.

import { describe, expect, it } from 'vitest'

import type { AlertsInboxSummary, InboxItem } from '@/types/alerts'
import { linkKind, relativeTime } from '@/components/alerts/NotificationParts'
import { applyToItems, applyToPage, applyToSummary, targets } from './use-inbox-actions'

const item = (id: number, unread: boolean, extra: Partial<InboxItem> = {}): InboxItem => ({ key: `n${id}`, id, title: `T${id}`, severity: 'INFO', unread, ...extra })

const SUMMARY: AlertsInboxSummary = {
  unreadCount: 5,
  highestUnreadSeverity: 'ERROR',
  items: [item(1, true), item(2, true), item(3, false)],
  banners: [item(2, true, { sticky: true })],
  notificationsHref: '/app/notifications',
}

describe('targets', () => {
  it('matches by id, ids, all, or alert id', () => {
    expect(targets(item(1, true), { id: 1 })).toBe(true)
    expect(targets(item(1, true), { ids: [2, 1] })).toBe(true)
    expect(targets({ key: 'a', title: 'x', severity: 'INFO', unread: true }, { ids: [1] })).toBe(false)
    expect(targets(item(1, true), { all: true })).toBe(true)
    expect(targets(item(1, true, { alertId: 9 }), { alertId: 9 })).toBe(true)
    expect(targets(item(1, true), { id: 2 })).toBe(false)
  })
})

describe('applyToItems', () => {
  it('reads, unreads and dismisses, counting unread changes', () => {
    expect(applyToItems(SUMMARY.items, { action: 'read', target: { id: 1 } }).unreadDelta).toBe(-1)
    expect(applyToItems(SUMMARY.items, { action: 'read', target: { id: 3 } }).unreadDelta).toBe(0)
    expect(applyToItems(SUMMARY.items, { action: 'unread', target: { id: 3 } }).unreadDelta).toBe(1)
    const dismissed = applyToItems(SUMMARY.items, { action: 'dismiss', target: { ids: [2, 3] } })
    expect(dismissed.items.map((each) => each.id)).toEqual([1])
    expect(dismissed.unreadDelta).toBe(-1)
  })
})

describe('applyToSummary', () => {
  it('adjusts the unread count from the server total, not the visible items', () => {
    expect(applyToSummary(SUMMARY, { action: 'read', target: { id: 1 } })).toMatchObject({ unreadCount: 4, highestUnreadSeverity: 'ERROR' })
    expect(applyToSummary(SUMMARY, { action: 'read', target: { all: true } })).toMatchObject({ unreadCount: 0, highestUnreadSeverity: null })
    const dismissed = applyToSummary(SUMMARY, { action: 'dismiss', target: { id: 2 } })
    expect(dismissed.banners).toEqual([])
    expect(dismissed.unreadCount).toBe(4)
    expect(applyToSummary(SUMMARY, { action: 'read', target: { id: 2 } }).banners).toBe(SUMMARY.banners)
  })
})

describe('applyToPage', () => {
  it('drops dismissed items from the page and its total', () => {
    expect(applyToPage({ items: SUMMARY.items, total: 30, offset: 0, limit: 25 }, { action: 'dismiss', target: { id: 1 } })).toMatchObject({ total: 29, items: [{ id: 2 }, { id: 3 }] })
    expect(applyToPage({ items: SUMMARY.items, total: 3, offset: 0, limit: 25 }, { action: 'read', target: { all: true } }).items.every((each) => !each.unread)).toBe(true)
  })
})

describe('relativeTime and linkKind', () => {
  it('prefers the server age, else computes from the delivery time', () => {
    const now = Date.parse('2026-10-13T12:00:00Z')
    expect(relativeTime({ age: '3 h' })).toBe('3 h ago')
    expect(relativeTime({ age: 'just now' })).toBe('just now')
    expect(relativeTime({ deliveredAt: '2026-10-13T11:59:50Z' }, now)).toBe('just now')
    expect(relativeTime({ deliveredAt: '2026-10-13T11:45:00Z' }, now)).toBe('15 min ago')
    expect(relativeTime({ deliveredAt: '2026-10-13T09:00:00Z' }, now)).toBe('3 h ago')
    expect(relativeTime({ deliveredAt: '2026-10-10T12:00:00Z' }, now)).toBe('3 d ago')
    expect(relativeTime({ deliveredAt: 'nope' }, now)).toBe('')
    expect(relativeTime({}, now)).toBe('')
  })

  it('links only same-origin app paths and https, refusing open redirects', () => {
    expect(linkKind('/app/x')).toBe('app')
    expect(linkKind('https://qrun.io/releases')).toBe('external')
    expect(linkKind('//evil.com')).toBeNull()
    expect(linkKind('/\\evil.com')).toBeNull()
    expect(linkKind('\\\\evil.com')).toBeNull()
    expect(linkKind('/app/x\\y')).toBeNull()
    expect(linkKind('/app/ x')).toBeNull()
    expect(linkKind('/app/\tx')).toBeNull()
    expect(linkKind('javascript:alert(1)')).toBeNull()
    expect(linkKind('data:text/html,x')).toBeNull()
    expect(linkKind('http://x')).toBeNull()
    expect(linkKind('https://')).toBeNull()
    expect(linkKind(null)).toBeNull()
  })
})
