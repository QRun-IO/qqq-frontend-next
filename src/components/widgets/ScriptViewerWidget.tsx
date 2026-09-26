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
 * @file ScriptViewerWidget — record-view widget with a script's versions, code, logs, test
 * runner, docs and editor.
 *
 * Parity with Material's `ScriptViewer` widget: the widget type is bound to the QQQ scripts
 * tables (`script`, `scriptType`, `scriptRevision`, `scriptRevisionFile`, `scriptLog`); the
 * payload (`DefaultWidgetRenderer`) carries the hosting script id in `queryParams.id`.
 */
'use client'

import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { SCRIPT_LOG_TABLE, queryScriptLogs } from '@/lib/api/developer'
import { useMetaData } from '@/lib/hooks/use-metadata'
import { queryKeys } from '@/lib/query-client'
import { ScriptViewer } from '@/components/scripts/ScriptViewer'
import { scriptLogsQueryHref } from '@/components/scripts/script-utils'
import { getRecordOrNull } from './record-lookup-utils'
import type { WidgetComponentProps } from './widget-types'
import { WidgetEmpty } from './WidgetNotice'

/** Tables of the scripts model the widget reads (the widget type's backend contract). */
const SCRIPT_TABLE = 'script'
const SCRIPT_TYPE_TABLE = 'scriptType'

/** Payload returned by `DefaultWidgetRenderer` for a scriptViewer widget. */
export interface ScriptViewerPayload {
  type?: string
  queryParams?: { id?: string; tableName?: string }
}

/**
 * Renders the script viewer for the script the widget is bound to.
 *
 * @param props - Widget props; `data.queryParams.id` (or the record context) identifies the script.
 * @returns The script viewer.
 */
export function ScriptViewerWidget({ widgetMetaData, data, recordContext }: WidgetComponentProps<ScriptViewerPayload>) {
  const widgetName = widgetMetaData.name
  const scriptId = data?.queryParams?.id ?? recordContext?.recordId
  const queryClient = useQueryClient()
  const { data: instance } = useMetaData()

  const scriptQuery = useQuery({
    queryKey: ['widget', 'scriptViewer', 'script', scriptId],
    queryFn: () => getRecordOrNull(SCRIPT_TABLE, scriptId as string),
    enabled: Boolean(scriptId),
    retry: false,
  })
  const scriptTypeId = scriptQuery.data?.values.scriptTypeId
  const hasScriptType = typeof scriptTypeId === 'string' || typeof scriptTypeId === 'number'
  const scriptTypeQuery = useQuery({
    queryKey: ['widget', 'scriptViewer', 'scriptType', scriptTypeId],
    queryFn: () => getRecordOrNull(SCRIPT_TYPE_TABLE, scriptTypeId as string | number),
    enabled: hasScriptType,
    retry: false,
  })

  let body: React.ReactNode
  if (!scriptId) {
    body = <WidgetEmpty widgetName={widgetName}>No script was specified.</WidgetEmpty>
  } else if (scriptQuery.isPending || (hasScriptType && scriptTypeQuery.isPending)) {
    body = <p className="text-sm text-muted-foreground" aria-busy="true">Loading script…</p>
  } else if (scriptQuery.data === null) {
    body = <p role="alert" className="text-sm text-muted-foreground">Script could not be found.</p>
  } else if (scriptQuery.isError) {
    body = <p role="alert" className="text-sm text-destructive">Error loading script.</p>
  } else {
    body = (
      <ScriptViewer
        idKey={widgetName}
        label={String(scriptQuery.data.values.name ?? widgetMetaData.label ?? 'Script')}
        scriptId={scriptId}
        script={scriptQuery.data}
        scriptType={scriptTypeQuery.data ?? undefined}
        canEdit={Boolean(instance?.processes?.storeScriptRevision)}
        canTest={Boolean(instance?.processes?.testScript)}
        logs={{
          queryKey: queryKeys.scriptLogs,
          load: queryScriptLogs,
          viewAllHref: instance?.tables?.[SCRIPT_LOG_TABLE] ? scriptLogsQueryHref : undefined,
        }}
        versionIdPrefix="script-revision-"
        onChanged={() => queryClient.invalidateQueries({ queryKey: ['widget', 'scriptViewer', 'script', scriptId] })}
      />
    )
  }

  return (
    <div data-qqq-id={`widget-scriptViewer-${widgetName}`}>
      {body}
    </div>
  )
}
