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

/** @file Small record-entry gates; feature UI and hooks live outside the initial route chunks. */
'use client'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { QTableMetaData } from '@/types'
import { useCollaborationAvailable } from '@/lib/hooks/use-collaboration-core'

const Panel = dynamic(
  () => import('./RecordCollaborationPanel').then((m) => m.RecordCollaborationPanel),
  {
    ssr: false,
    loading: () => (
      <aside
        className="min-h-40 animate-pulse rounded-xl border border-border bg-muted xl:w-[360px]"
        aria-label="Loading collaboration"
      />
    ),
  }
)
const Tags = dynamic(() => import('./TagChips').then((m) => m.TagChips), {
  ssr: false,
  loading: () => <div className="mt-2 h-7 w-32 animate-pulse rounded bg-muted" />,
})
const Follow = dynamic(() => import('./FollowBell').then((m) => m.FollowBell), {
  ssr: false,
  loading: () => <span className="inline-block h-11 w-14 animate-pulse rounded bg-muted" />,
})
/** Shared entry props contain only metadata and identity. */
interface Props {
  table: QTableMetaData
  pk: string
}
/** Lays out the record and lazy panel, keeping one DOM copy across breakpoints.
 * @param props - Record sections and table metadata.
 * @returns Responsive record layout.
 */
export function LazyRecordCollaborationLayout({
  table,
  pk,
  children,
}: Props & { children: ReactNode }) {
  const enabled = table.recordFeatures?.features?.some((feature) =>
    ['COMMENTS', 'ATTACHMENTS', 'TIMELINE'].includes(feature)
  )
  const available = useCollaborationAvailable(enabled)
  const show = enabled && available.data === true
  return (
    <div
      className={
        show ? 'grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_auto]' : 'min-w-0'
      }
    >
      <div className="min-w-0 space-y-5">{children}</div>
      {show && (
        <Panel
          key={`${table.name}/${pk}`}
          record={{ table: table.name, pk }}
          features={table.recordFeatures!}
          fieldLabels={Object.fromEntries(
            Object.values(table.fields).map((field) => [field.name, field.label])
          )}
        />
      )}
    </div>
  )
}
/** Loads tag controls only for opted-in tables and installed collaboration.
 * @param props - Metadata and identity.
 * @returns Tags or nothing.
 */
export function LazyRecordTags({ table, pk }: Props) {
  const enabled = table.recordFeatures?.features?.includes('TAGS')
  const available = useCollaborationAvailable(enabled)
  return enabled && available.data ? (
    <Tags
      key={`${table.name}/${pk}`}
      record={{ table: table.name, pk }}
      features={table.recordFeatures!}
    />
  ) : null
}
/** Loads the follow bell only for opted-in tables.
 * @param props - Metadata and identity.
 * @returns Bell or nothing.
 */
export function LazyRecordFollow({ table, pk }: Props) {
  const enabled = table.recordFeatures?.features?.includes('FOLLOW')
  const available = useCollaborationAvailable(enabled)
  return enabled && available.data ? (
    <Follow key={`${table.name}/${pk}`} record={{ table: table.name, pk }} />
  ) : null
}
