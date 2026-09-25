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
 * @file ScriptViewerWidget — record-view widget listing a script's revisions and files.
 *
 * Parity with Material's `ScriptViewer` (read-only): the widget type is bound to the
 * QQQ scripts tables (`script`, `scriptRevision`, `scriptRevisionFile`); the payload
 * (`DefaultWidgetRenderer`) carries the hosting script id in `queryParams.id`.
 */
'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { QRecord } from '@/types'
import { queryRecords } from '@/lib/api/tables'
import { cn } from '@/lib/utils/cn'
import { displayText, equalsFilter, formatWidgetDateTime, getRecordOrNull } from './record-lookup-utils'
import type { WidgetComponentProps } from './widget-types'
import { WidgetEmpty } from './WidgetNotice'

/** Tables that make up the scripts model (the widget type's backend contract). */
const SCRIPT_TABLE = 'script'
const SCRIPT_REVISION_TABLE = 'scriptRevision'
const SCRIPT_REVISION_FILE_TABLE = 'scriptRevisionFile'

/** Payload returned by `DefaultWidgetRenderer` for a scriptViewer widget. */
export interface ScriptViewerPayload {
  type?: string
  queryParams?: { id?: string; tableName?: string }
}

/**
 * Renders a script's revision history and the selected revision's files.
 *
 * @param props - Widget props; `data.queryParams.id` (or the record context) identifies the script.
 * @returns The script viewer.
 */
export function ScriptViewerWidget({ widgetMetaData, data, recordContext }: WidgetComponentProps<ScriptViewerPayload>) {
  const widgetName = widgetMetaData.name
  const scriptId = data?.queryParams?.id ?? recordContext?.recordId
  const [selectedId, setSelectedId] = useState<unknown>(undefined)

  const scriptQuery = useQuery({
    queryKey: ['widget', 'scriptViewer', 'script', scriptId],
    queryFn: () => getRecordOrNull(SCRIPT_TABLE, scriptId as string),
    enabled: Boolean(scriptId),
    retry: false,
  })
  const revisionsQuery = useQuery({
    queryKey: ['widget', 'scriptViewer', 'revisions', scriptId],
    queryFn: () => queryRecords(SCRIPT_REVISION_TABLE, { filter: equalsFilter('scriptId', scriptId as string, 'sequenceNo', false, 100) }),
    enabled: Boolean(scriptId) && scriptQuery.isSuccess && scriptQuery.data !== null,
    retry: false,
  })

  const revisions: QRecord[] = revisionsQuery.data?.records ?? []
  const currentId = scriptQuery.data?.values.currentScriptRevisionId
  const current = revisions.find((revision) => revision.values.id === currentId)
  const selected = revisions.find((revision) => revision.values.id === selectedId) ?? current ?? revisions[0]
  const selectedRevisionId = selected?.values.id as string | number | undefined

  const filesQuery = useQuery({
    queryKey: ['widget', 'scriptViewer', 'files', selectedRevisionId],
    queryFn: () => queryRecords(SCRIPT_REVISION_FILE_TABLE, { filter: equalsFilter('scriptRevisionId', selectedRevisionId as string | number, 'fileName', true, 100) }),
    enabled: selectedRevisionId !== undefined && selectedRevisionId !== null,
    retry: false,
  })

  let body: React.ReactNode
  if (!scriptId) {
    body = <WidgetEmpty widgetName={widgetName}>No script was specified.</WidgetEmpty>
  } else if (scriptQuery.isPending || (scriptQuery.data && revisionsQuery.isPending)) {
    body = <p className="text-sm text-muted-foreground" aria-busy="true">Loading script…</p>
  } else if (scriptQuery.data === null) {
    body = <p role="alert" className="text-sm text-muted-foreground">Script could not be found.</p>
  } else if (scriptQuery.isError || revisionsQuery.isError) {
    body = <p role="alert" className="text-sm text-destructive">Error loading script revisions.</p>
  } else if (revisions.length === 0) {
    body = <WidgetEmpty widgetName={widgetName}>There are not any versions of this script.</WidgetEmpty>
  } else {
    const files: QRecord[] = filesQuery.data?.records ?? []
    body = (
      <div className="grid gap-4 md:grid-cols-[minmax(12rem,1fr)_2fr]">
        <ul className="space-y-1" aria-label={`Versions of ${displayText(scriptQuery.data?.values.name) || 'script'}`}>
          {revisions.map((revision) => {
            const isSelected = revision === selected
            return (
              <li key={displayText(revision.values.id)}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(revision.values.id)}
                  className={cn(
                    'w-full rounded-md border px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                    isSelected ? 'border-primary bg-accent' : 'border-border hover:bg-accent',
                  )}
                  data-qqq-id={`script-revision-${displayText(revision.values.id)}`}
                >
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <span>Version {displayText(revision.values.sequenceNo)}</span>
                    {revision === current && (
                      <span className="rounded border border-green-600 px-1 text-xs text-green-700 dark:text-green-400">CURRENT</span>
                    )}
                  </span>
                  <span className="block text-foreground">{displayText(revision.values.commitMessage)}</span>
                  <span className="block text-xs text-muted-foreground">
                    <time dateTime={displayText(revision.values.createDate)}>{formatWidgetDateTime(revision.values.createDate)}</time>
                    {revision.values.author ? ` · ${displayText(revision.values.author)}` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <section aria-label={`Files of version ${displayText(selected?.values.sequenceNo)}`}>
          <h4 className="mb-2 text-sm font-semibold text-foreground">
            {displayText(scriptQuery.data?.values.name)} — Version {displayText(selected?.values.sequenceNo)}
          </h4>
          {filesQuery.isPending ? (
            <p className="text-sm text-muted-foreground" aria-busy="true">Loading files…</p>
          ) : filesQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">Error loading script files.</p>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">This version has no files.</p>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <figure key={displayText(file.values.id)} data-qqq-id={`script-file-${displayText(file.values.id)}`}>
                  <figcaption className="mb-1 font-mono text-xs font-semibold text-foreground">{displayText(file.values.fileName)}</figcaption>
                  <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
                    {displayText(file.values.contents)}
                  </pre>
                </figure>
              ))}
            </div>
          )}
        </section>
      </div>
    )
  }

  return (
    <div data-qqq-id={`widget-scriptViewer-${widgetName}`}>
      {body}
    </div>
  )
}
