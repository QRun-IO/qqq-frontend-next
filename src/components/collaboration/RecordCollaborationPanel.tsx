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

/** @file Responsive record collaboration panel; page scrolling remains the sole vertical scroll. */
'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CollaborationRecord, RecordFeaturesV1 } from '@/types/collaboration'
import { useComments, useAttachments, useTimeline } from '@/lib/hooks/use-collaboration-record'
const loading = () => (
  <p role="status" className="p-4 text-sm text-muted-foreground">
    Loading collaboration…
  </p>
)
const Comments = dynamic(() => import('./CommentsTab').then((m) => m.CommentsTab), { loading })
const Files = dynamic(() => import('./FilesTab').then((m) => m.FilesTab), { loading })
const Activity = dynamic(() => import('./ActivityTab').then((m) => m.ActivityTab), { loading })
const STORAGE_KEY = 'qqq-collaboration-panel-collapsed'

/** Metadata-driven tabs with stable counts, lazy content and remembered desktop collapse.
 * @param props - Parent identity and features.
 * @returns Panel alongside or beneath the record sections.
 */
export function RecordCollaborationPanel({
  record,
  features,
  fieldLabels,
}: {
  record: CollaborationRecord
  features: RecordFeaturesV1
  fieldLabels?: Record<string, string>
}) {
  const enabled = features.features ?? []
  const tabs = [
    { id: 'COMMENTS', label: 'Comments' },
    { id: 'ATTACHMENTS', label: 'Files' },
    { id: 'TIMELINE', label: 'Activity' },
  ].filter((tab) => enabled.includes(tab.id as NonNullable<RecordFeaturesV1['features']>[number]))
  const [selected, setSelected] = useState(tabs[0]?.id)
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === 'true')
    } catch {
      /* Storage may be disabled. */
    }
  }, [])
  const comments = useComments(record, enabled.includes('COMMENTS'))
  const files = useAttachments(record, enabled.includes('ATTACHMENTS'))
  const activity = useTimeline(record, enabled.includes('TIMELINE'))
  const counts: Record<string, string> = {
    COMMENTS: comments.data
      ? `${comments.data.pages.reduce((n, page) => n + page.threads.length, 0)}${comments.hasNextPage ? '+' : ''}`
      : '…',
    ATTACHMENTS: files.data
      ? `${files.data.pages.reduce((n, page) => n + page.items.length, 0)}${files.hasNextPage ? '+' : ''}`
      : '…',
    TIMELINE: activity.data
      ? `${activity.data.pages.reduce((n, page) => n + page.items.length, 0)}${activity.hasNextPage ? '+' : ''}`
      : '…',
  }
  const active = tabs.some((tab) => tab.id === selected) ? selected : tabs[0]?.id
  return (
    <aside
      aria-label="Collaboration"
      className={`min-w-0 self-start rounded-xl border border-border bg-card ${collapsed ? 'xl:w-12' : 'xl:w-[360px]'}`}
      data-qqq-id="record-collaboration-panel"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
        <h2 className={`text-sm font-semibold ${collapsed ? 'xl:hidden' : ''}`}>Collaboration</h2>
        <button
          type="button"
          aria-label={collapsed ? 'Expand collaboration' : 'Collapse collaboration'}
          aria-expanded={!collapsed}
          className="hidden rounded p-1 hover:bg-accent xl:inline-flex"
          data-qqq-id="collaboration-collapse"
          onClick={() => {
            const next = !collapsed
            setCollapsed(next)
            try {
              localStorage.setItem(STORAGE_KEY, String(next))
            } catch {
              /* Keep in-memory preference. */
            }
          }}
        >
          {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
      <div className={collapsed ? 'xl:hidden' : ''}>
        <div
          role="tablist"
          aria-label="Collaboration tabs"
          className="z-10 flex gap-1 border-b border-border bg-card p-2 xl:sticky xl:top-0"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              role="tab"
              id={`collab-tab-${tab.id}`}
              aria-selected={active === tab.id}
              aria-controls={`collab-content-${tab.id}`}
              tabIndex={active === tab.id ? 0 : -1}
              className="min-w-0 flex-1 rounded-md px-1 py-2 text-xs font-medium aria-selected:bg-primary aria-selected:text-primary-foreground"
              data-qqq-id={`collaboration-tab-${tab.label.toLowerCase()}`}
              onClick={() => setSelected(tab.id)}
              onKeyDown={(event) => {
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % tabs.length
                    : event.key === 'ArrowLeft'
                      ? (index + tabs.length - 1) % tabs.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? tabs.length - 1
                          : -1
                if (next >= 0) {
                  event.preventDefault()
                  setSelected(tabs[next].id)
                  document.getElementById(`collab-tab-${tabs[next].id}`)?.focus()
                }
              }}
            >
              {tab.label} <span className="opacity-75">{counts[tab.id]}</span>
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`collab-content-${active}`}
          aria-labelledby={`collab-tab-${active}`}
          className="p-3"
        >
          {active === 'COMMENTS' && (
            <Comments record={record} features={features} fieldLabels={fieldLabels} />
          )}
          {active === 'ATTACHMENTS' && <Files record={record} features={features} />}
          {active === 'TIMELINE' && <Activity record={record} />}
        </div>
      </div>
    </aside>
  )
}
