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

/** @file Maps realtime hints to existing query-key factories without manufacturing data. */
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import type { RealtimeEvent } from './client'
/** Invalidates only affected cache families; a replay miss refreshes active QQQ queries.
 * @param client - Session cache.
 * @param message - Realtime hint.
 */
export function invalidateRealtime(client: QueryClient, { event, data }: RealtimeEvent) {
  const invalidate = (queryKey: QueryKey) => {
    void client.invalidateQueries({ queryKey })
  }
  if (event === 'resync') {
    invalidate(queryKeys.all())
    return
  }
  if (event === 'notification.created') {
    invalidate(queryKeys.alerts())
    invalidate(queryKeys.collaborationMyWork())
    return
  }
  if (event === 'metadata.changed') {
    invalidate(queryKeys.metadata())
    return
  }
  if (event === 'task.changed') invalidate(queryKeys.collaborationMyWork())
  if (typeof data.table !== 'string') return
  if (event === 'record.changed' || event === 'record.deleted' || event === 'table.changed')
    invalidate(queryKeys.tableRecords(data.table))
  if (data.pk === undefined || data.pk === null) return
  const pk = String(data.pk)
  if (event === 'record.changed' || event === 'record.deleted') {
    invalidate(queryKeys.tableRecord(data.table, pk))
    invalidate(queryKeys.collaborationRecord(data.table, pk))
    return
  }
  const resource = event.startsWith('comment.')
    ? 'comments'
    : (
        {
          'attachment.changed': 'attachments',
          'tags.changed': 'tags',
          'task.changed': 'tasks',
          'presence.changed': 'presence',
        } as Record<string, string>
      )[event]
  if (resource) {
    invalidate(queryKeys.collaborationResource(data.table, pk, resource))
    invalidate(queryKeys.collaborationResource(data.table, pk, 'features'))
    if (resource !== 'presence')
      invalidate(queryKeys.collaborationResource(data.table, pk, 'timeline'))
  }
}
