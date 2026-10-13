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
 * @file RelatedPickerActions — Browse/Change and View under a foreign-key field whose table declares
 * a SINGLE related-record picker for it (`relatedRecordPickers`). Browse opens the lazily loaded
 * {@link RelatedRecordPickerDialog}; renders nothing when the table has no picker for the field.
 */

'use client'

import React, { lazy, Suspense, useState } from 'react'

import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { pickerRecordPath } from '@/lib/utils/record-picker'
import { singlePickerFor } from '@/lib/utils/related-record-picker'
import { buttonClass } from '@/components/ui/controls'

const RelatedRecordPickerDialog = lazy(() => import('./RelatedRecordPickerDialog'))

/** Props for {@link RelatedPickerActions}. */
export interface RelatedPickerActionsProps {
  /** The table whose form hosts the field. */
  tableName: string
  /** The foreign-key field. */
  fieldName: string
  /** The field's current value ('' when empty). */
  heldValue: string
  /** The field is read-only. */
  disabled?: boolean
  /** The form's current values (for the picker's `${input.x}` variables). */
  formValues?: Record<string, unknown>
  /** The field's `data-qqq-id`. */
  dataQqqId?: string
  /** Called with the chosen record's key and label. */
  onPicked: (id: string | number, label: string) => void
}

/**
 * The related-record picker actions of a foreign-key field.
 *
 * @param props - See {@link RelatedPickerActionsProps}.
 * @returns The actions and, when open, the dialog; or nothing.
 */
export function RelatedPickerActions({ tableName, fieldName, heldValue, disabled = false, formValues, dataQqqId, onPicked }: RelatedPickerActionsProps) {
  const { data: table } = useTableMetaData(tableName)
  const picker = singlePickerFor(table, fieldName)
  const [browsing, setBrowsing] = useState(false)
  if (!picker || disabled) return null
  return (
    <>
      <div className="mt-1 flex flex-wrap gap-1" data-qqq-id={dataQqqId ? `related-picker-actions-${dataQqqId}` : 'related-picker-actions'}>
        <button type="button" onClick={() => setBrowsing(true)} className={buttonClass('secondary', 'sm')} data-qqq-id="related-picker-browse">
          {heldValue ? 'Change…' : 'Browse…'}
        </button>
        {heldValue && (
          <a href={pickerRecordPath(picker.targetTableName, heldValue)} target="_blank" rel="noopener noreferrer" className={buttonClass('ghost', 'sm')} data-qqq-id="related-picker-view">View</a>
        )}
      </div>
      {browsing && (
        <Suspense fallback={null}>
          <RelatedRecordPickerDialog
            tableName={tableName}
            picker={picker}
            formValues={formValues}
            selectedId={heldValue || null}
            onSelect={(record, id) => {
              setBrowsing(false)
              onPicked(id, record.recordLabel ?? String(id))
            }}
            onClose={() => setBrowsing(false)}
          />
        </Suspense>
      )}
    </>
  )
}
