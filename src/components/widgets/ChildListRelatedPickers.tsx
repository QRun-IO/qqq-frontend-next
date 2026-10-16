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
 * @file ChildListRelatedPickers — the buttons a child record list shows for the hosting record's
 * MULTI_CHILD and LINK related-record pickers (e.g. "Add SKUs" on an order's lines), each opening
 * the lazily loaded {@link RelatedRecordPickerDialog}. After a change the list reloads and a status
 * line says what changed.
 */

'use client'

import React, { lazy, Suspense, useState } from 'react'

import type { QRelatedRecordPicker } from '@/types'

const RelatedRecordPickerDialog = lazy(() => import('@/components/forms/RelatedRecordPickerDialog'))

/** Props for {@link ChildListRelatedPickers}. */
export interface ChildListRelatedPickersProps {
  /** The pickers (from the hosting table's metadata). */
  pickers: QRelatedRecordPicker[]
  /** The hosting table. */
  tableName: string
  /** The hosting record. */
  primaryKey: string
  /** The list widget's name (for `data-qqq-id`s). */
  widgetName: string
  /** Called after rows were added or removed. */
  onChanged?: () => void
}

/**
 * The picker buttons of a child record list, and the open picker.
 *
 * @param props - See {@link ChildListRelatedPickersProps}.
 * @returns The buttons, the dialog when open, and a status line.
 */
export function ChildListRelatedPickers({ pickers, tableName, primaryKey, widgetName, onChanged }: ChildListRelatedPickersProps) {
  const [open, setOpen] = useState<QRelatedRecordPicker | null>(null)
  const [status, setStatus] = useState('')
  return (
    <>
      <span className="sr-only" role="status" data-qqq-id={`child-record-picker-status-${widgetName}`}>{status}</span>
      {pickers.map((picker) => (
        <button
          key={picker.name}
          type="button"
          onClick={() => { setStatus(''); setOpen(picker) }}
          className="text-sm font-medium text-link underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
          data-qqq-id={`child-record-picker-${widgetName}-${picker.name}`}
        >
          {picker.label}
        </button>
      ))}
      {open && (
        <Suspense fallback={null}>
          <RelatedRecordPickerDialog
            tableName={tableName}
            picker={open}
            primaryKey={primaryKey}
            onDone={({ added, removed }) => {
              setOpen(null)
              setStatus([added ? `${added} added` : '', removed ? `${removed} removed` : ''].filter(Boolean).join(', ') || 'No changes')
              onChanged?.()
            }}
            onClose={() => setOpen(null)}
          />
        </Suspense>
      )}
    </>
  )
}
