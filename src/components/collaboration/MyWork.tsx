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

/** @file Personal tasks, assigned record links and unread mentions. */
'use client'
import Link from 'next/link'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { useMetaData, useTableMetaData } from '@/lib/hooks/use-metadata'
import { useCollaborationAvailable } from '@/lib/hooks/use-collaboration-core'
import { useRealtimeChannel } from '@/lib/hooks/use-realtime-channel'
import { getMyWork, listMyTasks } from '@/lib/api/collaboration'
import { queryRecords } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'
import { collaborationButton } from './CollaborationDialog'
import { builtInViewHref } from '@/lib/utils/built-in-views'
/** Loads visible assignment rows through the metadata-supplied view.
 * @param props - Table count and display label.
 * @returns Record links plus the full table view.
 */
function AssignedTable({ name, label, count }: { name: string; label: string; count: number }) {
  const metadata = useTableMetaData(name)
  const view = metadata.data?.builtInViews?.find((view) =>
    view.filter.criteria?.some((criterion) =>
      criterion.values.some((value) => typeof value === 'object' && value.type === 'CurrentUser')
    )
  )
  const rows = useQuery({
    queryKey: [...queryKeys.collaborationMyWork(), 'records', name, view?.filter],
    queryFn: () => queryRecords(name, { filter: { ...view!.filter, skip: 0, limit: 10 } }),
    enabled: !!view,
  })
  return (
    <section className="space-y-2">
      <h3 className="font-medium">
        <Link
          href={view ? builtInViewHref(name, view.filter) : `/app/${encodeURIComponent(name)}`}
          className="underline"
          data-qqq-id={`work-table-${name}`}
        >
          {label} ({count})
        </Link>
      </h3>
      {rows.isError && <p role="alert">Could not load assigned records.</p>}
      <ul className="space-y-2 text-sm">
        {rows.data?.records.map((record) => {
          const pk = record.values[metadata.data!.primaryKeyField]
          return (
            <li key={String(pk)}>
              <Link
                className="break-words underline"
                href={`/app/${encodeURIComponent(name)}/${encodeURIComponent(String(pk))}`}
                data-qqq-id="work-record"
              >
                {record.recordLabel || String(pk)}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
/** On-demand My work surface.
 * @returns Work page.
 */
export function MyWork() {
  const available = useCollaborationAvailable()
  const metadata = useMetaData()
  const work = useQuery({
    queryKey: queryKeys.collaborationMyWork(),
    queryFn: getMyWork,
    enabled: available.data === true,
  })
  const tasks = useInfiniteQuery({
    queryKey: [...queryKeys.collaborationMyWork(), 'tasks'],
    queryFn: ({ pageParam }) => listMyTasks(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last, _pages, _param, params) =>
      last.nextCursor && !params.includes(last.nextCursor) ? last.nextCursor : undefined,
    enabled: available.data === true,
  })
  const openTasks = tasks.data?.pages.flatMap((page) => page.items) ?? work.data?.tasks ?? []
  useRealtimeChannel('user:me', undefined, available.data === true)
  return (
    <main className="mx-auto min-w-0 max-w-5xl space-y-5 py-4 sm:px-4" data-qqq-id="my-work">
      <h1 className="text-2xl font-semibold">My work</h1>
      {available.data === false && <p>My work is unavailable.</p>}
      {available.isError || work.isError ? (
        <p role="alert">Could not load My work.</p>
      ) : available.data !== false && work.isPending ? (
        <p role="status">Loading My work…</p>
      ) : null}
      {work.data && (
        <>
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">Open tasks ({work.data.openTaskCount ?? 0})</h2>
            {!openTasks.length && <p className="text-sm text-muted-foreground">No open tasks.</p>}
            <ul className="space-y-3">
              {openTasks
                ?.filter((task) => task.status === 'OPEN')
                .map((task) => (
                  <li key={task.id} className="min-w-0 rounded-lg border border-border p-3">
                    <Link
                      className="break-words font-medium underline"
                      href={`/app/${encodeURIComponent(task.tableName ?? '')}/${encodeURIComponent(task.recordId ?? '')}`}
                      data-qqq-id={`work-task-${task.id}`}
                    >
                      {task.title}
                    </Link>
                    {task.dueAt && (
                      <p className="mt-1 text-sm">
                        {Date.parse(task.dueAt) < Date.now() ? 'Overdue' : 'Due'}:{' '}
                        {new Date(task.dueAt).toLocaleString()}
                      </p>
                    )}
                  </li>
                ))}
            </ul>
            {tasks.isError && <p role="alert">Could not load all tasks.</p>}
            {tasks.hasNextPage && (
              <button
                className={collaborationButton}
                disabled={tasks.isFetchingNextPage}
                onClick={() => tasks.fetchNextPage()}
                data-qqq-id="work-tasks-more"
              >
                Load more tasks
              </button>
            )}
          </section>
          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">Assigned records</h2>
            {Object.entries(work.data.assignedRecordsByTable ?? {}).map(([name, count]) => (
              <AssignedTable
                key={name}
                name={name}
                label={metadata.data?.tables[name]?.label ?? name}
                count={count}
              />
            ))}
            {!Object.keys(work.data.assignedRecordsByTable ?? {}).length && (
              <p className="text-sm text-muted-foreground">No assigned records.</p>
            )}
          </section>
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">Unread mentions</h2>
            <Link
              href="/app/notifications?status=unread"
              className="text-sm underline"
              data-qqq-id="work-mentions"
            >
              {work.data.unreadMentionCount ?? 0} unread mentions
            </Link>
          </section>
        </>
      )}
    </main>
  )
}
