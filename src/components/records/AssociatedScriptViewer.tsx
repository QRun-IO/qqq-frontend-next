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
 * @file AssociatedScriptViewer — one associated script of a record in the record
 * developer view: create the script, or browse its versions and code, edit it (store a new
 * revision), read its run logs, test it, and read its script type's documentation.
 *
 * Parity with Material's `RecordDeveloperView` + `ScriptViewer`.
 */

'use client'

import React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { getAssociatedScriptLogs, storeRecordAssociatedScript, type AssociatedScriptData } from '@/lib/api/developer'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { cn } from '@/lib/utils/cn'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { ScriptViewer } from '@/components/scripts/ScriptViewer'
import { ALERT_CLASS, BUTTON_CLASS } from '@/components/scripts/ScriptPanels'
import { domId } from '@/components/scripts/script-utils'

export { domId } from '@/components/scripts/script-utils'

/** Code and commit message Material stores when a script is first created. */
const NEW_SCRIPT_CONTENTS = '// Edit this new script to define its code.'
const NEW_SCRIPT_COMMIT_MESSAGE = 'Initial version'

/** Props for {@link AssociatedScriptViewer}. */
export interface AssociatedScriptViewerProps {
  /** Exact backend table identifier of the record. */
  tableName: string
  /** Primary key of the record. */
  recordId: string | number
  /** Label of the associated-script field (the card heading). */
  fieldLabel: string
  /** Developer data of this associated script. */
  data: AssociatedScriptData
  /** The script id the record's field holds, if any. */
  scriptId: string | number | null | undefined
  /** Whether the session may create the script (table edit permission). */
  canCreate: boolean
  /** Whether the session may store revisions (the `storeScriptRevision` process is available). */
  canEdit: boolean
  /** Whether the session may test scripts (the `testScript` process is available). */
  canTest: boolean
  /**
   * The "View All" link to the script log table filtered to one revision, when the session can read it.
   * @param scriptRevisionId - Revision id.
   * @returns The link, or `undefined`.
   */
  logsViewAllHref?: (scriptRevisionId: string | number) => string | undefined
  /** Reloads the record's developer data after the script changed. */
  onChanged: () => Promise<unknown>
}

/**
 * Renders one associated script of a record: the create prompt when the field is empty,
 * otherwise the script viewer.
 *
 * @param props - {@link AssociatedScriptViewerProps}
 * @returns The associated script card.
 */
export function AssociatedScriptViewer(props: AssociatedScriptViewerProps) {
  const { tableName, recordId, fieldLabel, data, scriptId, canCreate, canEdit, canTest, logsViewAllHref, onChanged } = props
  const fieldName = data.associatedScript.fieldName
  const headingId = `associated-script-${domId(fieldName)}-heading`
  const hasScript = scriptId !== null && scriptId !== undefined && scriptId !== ''

  return (
    <section
      className="rounded-xl border border-border bg-card"
      aria-labelledby={headingId}
      data-qqq-id={`associated-script-${fieldName}`}
    >
      <h3 id={headingId} className="px-4 pt-4 text-lg font-semibold text-foreground">{fieldLabel}</h3>
      <div className="p-4">
        {!hasScript ? (
          <CreateScript tableName={tableName} recordId={recordId} fieldName={fieldName} canCreate={canCreate} onChanged={onChanged} />
        ) : data.script ? (
          <ScriptViewer
            idKey={fieldName}
            label={fieldLabel}
            scriptId={scriptId}
            script={data.script}
            scriptType={data.scriptType}
            canEdit={canEdit}
            canTest={canTest}
            testFields={{ inputFields: data.testInputFields ?? [], outputFields: data.testOutputFields ?? [] }}
            logs={{
              queryKey: (scriptRevisionId) => queryKeys.associatedScriptLogs(tableName, recordId, fieldName, scriptRevisionId),
              load: (scriptRevisionId) => getAssociatedScriptLogs(tableName, recordId, fieldName, scriptRevisionId),
              viewAllHref: logsViewAllHref,
            }}
            onChanged={onChanged}
          />
        ) : (
          <p role="alert" className="text-sm text-muted-foreground">Script code could not be found.</p>
        )}
      </div>
    </section>
  )
}

/**
 * The empty-field prompt with the "Create Script" action.
 *
 * @param props - Component props.
 * @param props.tableName - Table of the record.
 * @param props.recordId - Record id.
 * @param props.fieldName - Associated-script field.
 * @param props.canCreate - Whether the create action is offered.
 * @param props.onChanged - Reloads developer data once created.
 * @returns The prompt.
 */
function CreateScript({ tableName, recordId, fieldName, canCreate, onChanged }: {
  tableName: string
  recordId: string | number
  fieldName: string
  canCreate: boolean
  onChanged: () => Promise<unknown>
}) {
  const create = useMutation({
    mutationFn: () => storeRecordAssociatedScript(tableName, recordId, fieldName, NEW_SCRIPT_CONTENTS, NEW_SCRIPT_COMMIT_MESSAGE),
    meta: HANDLES_OWN_ERRORS,
    onSuccess: () => onChanged(),
  })
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-foreground">No script has been created in this field for this record at this time.</p>
      {canCreate && (
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={create.isPending}
          onClick={() => create.mutate()}
          data-qqq-id={`button-create-script-${fieldName}`}
        >
          {create.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Create Script
        </button>
      )}
      {create.error && <p role="alert" className={cn(ALERT_CLASS, 'w-full')}>{getErrorMessage(create.error)}</p>}
    </div>
  )
}
