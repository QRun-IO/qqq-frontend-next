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
 * @file DataBagViewerWidget — record-view widget listing a data bag's versions and contents.
 *
 * Parity with Material's `DataBagViewer`: the widget type is bound to the `dataBag`
 * and `dataBagVersion` tables; the payload (`DefaultWidgetRenderer`) carries the
 * hosting record id in `queryParams.id`.
 */
'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { QRecord } from '@/types'
import { getRecord, queryRecords } from '@/lib/api/tables'
import { cn } from '@/lib/utils/cn'
import { displayText, equalsFilter, formatWidgetDateTime, getRecordOrNull } from './record-lookup-utils'
import type { WidgetComponentProps } from './widget-types'
import { WidgetEmpty } from './WidgetNotice'

/** Table holding data bags (the widget type's backend contract). */
const DATA_BAG_TABLE = 'dataBag'
/** Table holding data bag versions (the widget type's backend contract). */
const DATA_BAG_VERSION_TABLE = 'dataBagVersion'

/** Payload returned by `DefaultWidgetRenderer` for a dataBagViewer widget. */
export interface DataBagViewerPayload {
  type?: string
  queryParams?: { id?: string; tableName?: string }
}

/**
 * Pretty-prints JSON contents; leaves non-JSON text unchanged.
 *
 * @param value - Raw version contents.
 * @returns Display text for the `<pre>`.
 */
function prettyContents(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const text = displayText(value)
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

/**
 * Renders the versions of a data bag and the selected version's contents.
 *
 * @param props - Widget props; `data.queryParams.id` (or the record context) identifies the data bag.
 * @returns The data bag viewer.
 */
export function DataBagViewerWidget({ widgetMetaData, data, recordContext }: WidgetComponentProps<DataBagViewerPayload>) {
  const widgetName = widgetMetaData.name
  const dataBagId = data?.queryParams?.id ?? recordContext?.recordId
  const [selectedId, setSelectedId] = useState<unknown>(undefined)

  const bagQuery = useQuery({
    queryKey: ['widget', 'dataBagViewer', 'bag', dataBagId],
    queryFn: () => getRecordOrNull(DATA_BAG_TABLE, dataBagId as string),
    enabled: Boolean(dataBagId),
    retry: false,
  })
  const versionsQuery = useQuery({
    queryKey: ['widget', 'dataBagViewer', 'versions', dataBagId],
    queryFn: () => queryRecords(DATA_BAG_VERSION_TABLE, { filter: equalsFilter('dataBagId', dataBagId as string, 'sequenceNo', false, 25) }),
    enabled: Boolean(dataBagId) && bagQuery.data !== null && bagQuery.isSuccess,
    retry: false,
  })

  const versions: QRecord[] = versionsQuery.data?.records ?? []
  const newest = versions[0]
  const selected = versions.find((version) => version.values.id === selectedId) ?? newest
  const needsFullVersion = Boolean(selected) && !Object.prototype.hasOwnProperty.call(selected?.values ?? {}, 'data')

  const fullVersionQuery = useQuery({
    queryKey: ['widget', 'dataBagViewer', 'version', selected?.values.id],
    queryFn: () => getRecord(DATA_BAG_VERSION_TABLE, selected?.values.id as string | number),
    enabled: needsFullVersion,
    retry: false,
  })

  let body: React.ReactNode
  if (!dataBagId) {
    body = <WidgetEmpty widgetName={widgetName}>No data bag was specified.</WidgetEmpty>
  } else if (bagQuery.isPending || (bagQuery.data && versionsQuery.isPending)) {
    body = <p className="text-sm text-muted-foreground" aria-busy="true">Loading data bag…</p>
  } else if (bagQuery.data === null) {
    body = <p role="alert" className="text-sm text-muted-foreground">Data bag data could not be found.</p>
  } else if (bagQuery.isError || versionsQuery.isError) {
    body = <p role="alert" className="text-sm text-destructive">Error loading data bag data.</p>
  } else if (versions.length === 0) {
    body = <WidgetEmpty widgetName={widgetName}>There are not any versions of this data bag.</WidgetEmpty>
  } else {
    const contents = needsFullVersion ? fullVersionQuery.data?.values.data : selected?.values.data
    body = (
      <div className="grid gap-4 md:grid-cols-[minmax(12rem,1fr)_2fr]">
        <ul className="space-y-1" aria-label={`Versions of ${displayText(bagQuery.data?.values.name) || 'data bag'}`}>
          {versions.map((version) => {
            const isSelected = version === selected
            return (
              <li key={displayText(version.values.id)}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(version.values.id)}
                  className={cn(
                    'w-full rounded-md border px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                    isSelected ? 'border-primary bg-accent' : 'border-border hover:bg-accent',
                  )}
                  data-qqq-id={`data-bag-version-${displayText(version.values.id)}`}
                >
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <span>Version {displayText(version.values.sequenceNo)}</span>
                    {version === newest && (
                      <span className="rounded border border-green-600 px-1 text-xs text-green-700 dark:text-green-400">CURRENT</span>
                    )}
                  </span>
                  <span className="block text-foreground">{displayText(version.values.commitMessage)}</span>
                  <span className="block text-xs text-muted-foreground">
                    <time dateTime={displayText(version.values.createDate)}>{formatWidgetDateTime(version.values.createDate)}</time>
                    {version.values.author ? ` · ${displayText(version.values.author)}` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <section aria-label={`Contents of version ${displayText(selected?.values.sequenceNo)}`}>
          <h4 className="mb-2 text-sm font-semibold text-foreground">
            {displayText(bagQuery.data?.values.name)} — Version {displayText(selected?.values.sequenceNo)}
          </h4>
          {needsFullVersion && fullVersionQuery.isPending ? (
            <p className="text-sm text-muted-foreground" aria-busy="true">Loading version…</p>
          ) : needsFullVersion && fullVersionQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">Error loading this version.</p>
          ) : prettyContents(contents) ? (
            <pre
              className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground"
              data-qqq-id={`data-bag-contents-${widgetName}`}
            >
              {prettyContents(contents)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">This version has no contents.</p>
          )}
        </section>
      </div>
    )
  }

  return (
    <div data-qqq-id={`widget-dataBagViewer-${widgetName}`}>
      {body}
    </div>
  )
}
