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

/** @file Published release history, loaded only on the What's new route. */

'use client'

import React, { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'

import { getReleaseNotes, markReleaseNotesSeen } from '@/lib/api/release-notes'
import { UI_API_EXTENSION, useUiApiExtensionInstalled } from '@/lib/api/ui-api-extensions'
import { useQContext } from '@/lib/context/q-context'
import { queryKeys } from '@/lib/query-client'
import { linkKind, relativeTime } from '@/components/alerts/NotificationParts'
import { BUTTON_CLASS } from '@/components/ui/controls'

/** Renders release history when the server announces the extension.
 * @returns The page or unavailable state.
 */
export function WhatsNewPage() {
  const installed = useUiApiExtensionInstalled(UI_API_EXTENSION.releaseNotes)
  const { setPageHeader } = useQContext()
  useEffect(() => setPageHeader("What's new"), [setPageHeader])
  return <main className="mx-auto w-full min-w-0 max-w-3xl space-y-6 break-words" data-qqq-id="whats-new-page">
    <h1 className="text-2xl font-semibold">What&apos;s new</h1>
    {installed ? <ReleaseHistory /> : <p>What&apos;s new isn&apos;t available on this server.</p>}
  </main>
}

/** Loads and appends release pages, preserving their initial new flags for this visit.
 * @returns The history content.
 */
function ReleaseHistory() {
  const client = useQueryClient()
  const router = useRouter()
  const releaseId = useSearchParams()?.get('release')
  const seen = useRef(false)
  const scrolled = useRef<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const query = useInfiniteQuery({
    queryKey: queryKeys.releaseNotesPages(),
    queryFn: ({ pageParam }) => getReleaseNotes(10, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages, offset) => last.releases.length > 0 && offset + 10 < last.total ? offset + 10 : undefined,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })
  useEffect(() => {
    if (!query.data || seen.current) return
    seen.current = true
    void markReleaseNotesSeen().then(() => client.invalidateQueries({ queryKey: queryKeys.releaseNotesSummary() })).catch(() => {
      // A failed seen write must not hide the successfully loaded history or clear the badge.
    })
  }, [query.data, client])
  useEffect(() => {
    if (!releaseId || scrolled.current === releaseId) return
    const target = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-release-id]') ?? []).find((element) => element.dataset.releaseId === releaseId)
    if (target) {
      target.scrollIntoView?.({ block: 'center' })
      scrolled.current = releaseId
    }
  }, [releaseId, query.data])
  const releases = query.data?.pages.flatMap((page) => page.releases) ?? []
  return <div ref={root} className="space-y-6">
    {query.isPending && <p role="status">Loading release notes…</p>}
    {query.isError && <div role="alert" className="space-y-2">
      <p>Could not load release notes.</p>
      <button type="button" className={BUTTON_CLASS} data-qqq-id="whats-new-retry" onClick={() => void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())}>Retry</button>
    </div>}
    {query.isSuccess && releases.length === 0 && <p>No release notes yet. When a new version is published, it will appear here.</p>}
    {releases.map((release) => <section key={release.id} data-release-id={release.id} data-qqq-id={`release-${release.id}`}
      aria-label={release.title}
      className={`min-w-0 space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6 ${String(release.id) === releaseId ? 'ring-2 ring-ring ring-offset-2' : ''}`}>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{release.title}</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{release.version}</span>
          {release.publishedAt && <time dateTime={release.publishedAt} title={new Date(release.publishedAt).toLocaleString()}>
            {relativeTime({ deliveredAt: release.publishedAt })} · {new Date(release.publishedAt).toLocaleDateString()}
          </time>}
          {release.isNew && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground" data-qqq-id={`release-new-${release.id}`}>New</span>}
        </div>
      </div>
      {release.summary && <p className="whitespace-pre-wrap">{release.summary}</p>}
      {Array.from(new Set(release.items.map((item) => item.category))).map((category) => {
        const items = release.items.filter((item) => item.category === category)
        return <div key={category} className="space-y-2">
          <h3 className="text-sm font-semibold">{items[0].categoryLabel}</h3>
          <ul className="list-disc space-y-3 pl-5">
            {items.map((item, index) => {
              const kind = linkKind(item.linkUrl)
              return <li key={index} className="min-w-0 whitespace-pre-wrap">
                {kind ? <a href={item.linkUrl!} target={kind === 'external' ? '_blank' : undefined}
                  rel={kind === 'external' ? 'noopener noreferrer' : undefined}
                  data-qqq-id={`release-link-${release.id}-${category}-${index}`}
                  className="text-primary underline underline-offset-2"
                  onClick={(event) => { if (kind === 'app') { event.preventDefault(); router.push(item.linkUrl!) } }}>{item.text}</a> : item.text}
                {linkKind(item.screenshotUrl) && <>
                  {/* Native images accept server-provided URLs without an optimizer or fixed dimensions. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.screenshotUrl!} alt={item.text} loading="lazy" className="mt-3 h-auto max-w-full rounded-md" />
                </>}
              </li>
            })}
          </ul>
        </div>
      })}
    </section>)}
    {query.hasNextPage && <button type="button" className={BUTTON_CLASS} disabled={query.isFetchingNextPage}
      data-qqq-id="whats-new-load-more" onClick={() => void query.fetchNextPage()}>
      {query.isFetchingNextPage ? 'Loading older releases…' : 'Show older releases'}
    </button>}
  </div>
}
