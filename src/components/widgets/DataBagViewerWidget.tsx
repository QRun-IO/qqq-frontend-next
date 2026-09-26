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
 * @file DataBagViewerWidget — record-view widget with a data bag's versions: the selected
 * version's JSON ("Raw Data") or its expandable tree ("Data Preview"), and the editor that
 * saves a new version.
 *
 * Parity with Material's `DataBagViewer`: the widget type is bound to the `dataBag` and
 * `dataBagVersion` tables and the application's `storeDataBagVersion` process; the payload
 * (`DefaultWidgetRenderer`) carries the hosting record id in `queryParams.id`. The newest
 * version is the current one.
 */
'use client'

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { QRecord } from '@/types'
import { getRecord, queryRecords } from '@/lib/api/tables'
import { toast } from '@/lib/hooks/use-toast'
import { useMetaData } from '@/lib/hooks/use-metadata'
import { cn } from '@/lib/utils/cn'
import { DataBagEditorDialog } from '@/components/databags/DataBagEditorDialog'
import { JsonPreview } from '@/components/databags/JsonPreview'
import { CodeBlock } from '@/components/scripts/HighlightedCode'
import { BUTTON_CLASS } from '@/components/scripts/ScriptPanels'
import { domId } from '@/components/scripts/script-utils'
import { displayText, equalsFilter, formatWidgetDateTime, getRecordOrNull } from './record-lookup-utils'
import type { WidgetComponentProps } from './widget-types'
import { WidgetEmpty } from './WidgetNotice'

/** Table holding data bags (the widget type's backend contract). */
const DATA_BAG_TABLE = 'dataBag'
/** Table holding data bag versions (the widget type's backend contract). */
const DATA_BAG_VERSION_TABLE = 'dataBagVersion'
/** The application process that stores a data bag version (Material's editor contract). */
const STORE_DATA_BAG_VERSION_PROCESS = 'storeDataBagVersion'

type TabKey = 'raw' | 'preview'

/** Payload returned by `DefaultWidgetRenderer` for a dataBagViewer widget. */
export interface DataBagViewerPayload {
  type?: string
  queryParams?: { id?: string; tableName?: string }
}

/**
 * Pretty-prints JSON contents; leaves non-JSON text unchanged.
 *
 * @param value - Raw version contents.
 * @returns Display text.
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
 * Renders the versions of a data bag, the selected version's contents, and the editor.
 *
 * @param props - Widget props; `data.queryParams.id` (or the record context) identifies the data bag.
 * @returns The data bag viewer.
 */
export function DataBagViewerWidget({ widgetMetaData, data, recordContext }: WidgetComponentProps<DataBagViewerPayload>) {
  const widgetName = widgetMetaData.name
  const dataBagId = data?.queryParams?.id ?? recordContext?.recordId
  const [selectedId, setSelectedId] = useState<unknown>(undefined)
  const [tab, setTab] = useState<TabKey>('raw')
  const [editing, setEditing] = useState(false)
  const queryClient = useQueryClient()
  const { data: instance } = useMetaData()
  const canEdit = Boolean(instance?.processes?.[STORE_DATA_BAG_VERSION_PROCESS])

  const versionsKey = ['widget', 'dataBagViewer', 'versions', dataBagId]
  const bagQuery = useQuery({
    queryKey: ['widget', 'dataBagViewer', 'bag', dataBagId],
    queryFn: () => getRecordOrNull(DATA_BAG_TABLE, dataBagId as string),
    enabled: Boolean(dataBagId),
    retry: false,
  })
  const versionsQuery = useQuery({
    queryKey: versionsKey,
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
  const rawContents = needsFullVersion ? fullVersionQuery.data?.values.data : selected?.values.data
  const contentsText = rawContents === null || rawContents === undefined ? '' : displayText(rawContents)
  const bagName = displayText(bagQuery.data?.values.name)

  let editText = 'Create New Version'
  let editTitle: string | undefined
  if (selected) {
    if (selected === newest) {
      editText = 'Edit'
      editTitle = 'If you make any changes to this data bag, a new version will be created when you hit Save.'
    } else {
      editText = 'Edit and Activate'
      editTitle = 'If you want to make this previous Version active, bring up the Edit window, make any changes to the old Version if they are needed, then click Save. A new Version will be created, and set as Current.'
    }
  }
  const editButton = canEdit && (
    <button
      type="button"
      className={BUTTON_CLASS}
      title={editTitle}
      disabled={Boolean(selected) && needsFullVersion && fullVersionQuery.isPending}
      onClick={() => setEditing(true)}
      data-qqq-id={`button-edit-data-bag-${widgetName}`}
    >
      {editText}
    </button>
  )

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'raw', label: 'Raw Data' },
    { key: 'preview', label: 'Data Preview' },
  ]
  const tabDomId = (key: TabKey) => `data-bag-tab-${domId(widgetName)}-${key}`
  const panelDomId = `data-bag-panel-${domId(widgetName)}`

  /**
   * Moves between the two tabs with the arrow, Home and End keys.
   * @param event - Key event on a tab.
   * @param index - Index of the focused tab.
   */
  function handleTabKey(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | undefined
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    if (next === undefined) return
    event.preventDefault()
    setTab(tabs[next].key)
    document.getElementById(tabDomId(tabs[next].key))?.focus()
  }

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
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <WidgetEmpty widgetName={widgetName}>There are not any versions of this data bag.</WidgetEmpty>
        {editButton}
      </div>
    )
  } else {
    const versionsList = (
      <ul className="max-h-96 space-y-1 overflow-auto" aria-label={`Versions of ${bagName || 'data bag'}`}>
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
                <span className="block break-words text-foreground">{displayText(version.values.commitMessage)}</span>
                <span className="block text-xs text-muted-foreground">
                  <time dateTime={displayText(version.values.createDate)}>{formatWidgetDateTime(version.values.createDate)}</time>
                  {version.values.author ? ` · ${displayText(version.values.author)}` : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    )
    const loadingVersion = needsFullVersion && fullVersionQuery.isPending
    const versionError = needsFullVersion && fullVersionQuery.isError
    body = (
      <div>
        <div role="tablist" aria-label={`${bagName || 'Data bag'} contents`} className="mb-4 flex gap-1 border-b border-border">
          {tabs.map((item, index) => (
            <button
              key={item.key}
              id={tabDomId(item.key)}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              aria-controls={panelDomId}
              tabIndex={tab === item.key ? 0 : -1}
              onClick={() => setTab(item.key)}
              onKeyDown={(event) => handleTabKey(event, index)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring',
                tab === item.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              data-qqq-id={`data-bag-tab-${widgetName}-${item.key}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={panelDomId} aria-labelledby={tabDomId(tab)} className="grid gap-4 md:grid-cols-[minmax(12rem,1fr)_2fr]">
          <div className="min-w-0">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Versions</h4>
            {versionsList}
          </div>
          <section className="min-w-0" aria-label={`Contents of version ${displayText(selected?.values.sequenceNo)}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground" data-qqq-id={`data-bag-version-heading-${widgetName}`}>
                {tab === 'preview'
                  ? `Data Preview (Version ${displayText(selected?.values.sequenceNo)})`
                  : `${bagName} — Version ${displayText(selected?.values.sequenceNo)}${selected === newest ? ' (Current)' : ''}`}
              </h4>
              {tab === 'raw' && editButton}
            </div>
            {loadingVersion ? (
              <p className="text-sm text-muted-foreground" aria-busy="true">Loading version…</p>
            ) : versionError ? (
              <p role="alert" className="text-sm text-destructive">Error loading this version.</p>
            ) : !contentsText ? (
              <p className="text-sm text-muted-foreground">This version has no contents.</p>
            ) : tab === 'raw' ? (
              <CodeBlock
                code={prettyContents(contentsText)}
                language="json"
                className="max-h-96"
                dataQqqId={`data-bag-contents-${widgetName}`}
              />
            ) : (
              <div className="max-h-96 overflow-auto rounded-md border border-border p-2">
                <JsonPreview json={contentsText} idKey={widgetName} />
              </div>
            )}
          </section>
        </div>
      </div>
    )
  }

  return (
    <div data-qqq-id={`widget-dataBagViewer-${widgetName}`}>
      {body}
      {editing && dataBagId && (
        <DataBagEditorDialog
          idKey={widgetName}
          title={`${contentsText ? 'Editing' : 'Initializing'} Contents of Data Bag: ${bagName}`}
          dataBagId={dataBagId}
          initialData={contentsText}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false)
            setSelectedId(undefined)
            toast.success('Saved New Data Bag Version')
            await queryClient.invalidateQueries({ queryKey: versionsKey })
          }}
        />
      )}
    </div>
  )
}
