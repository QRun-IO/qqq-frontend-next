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
 * @file SaveWarningBanner — the warning of the save that led to this record view (the saved
 * record's first warning, or a "warning..." save error), shown once as a dismissible alert,
 * as the Material dashboard's record view does after a create or an edit.
 */

'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

import { takeSaveWarning } from '@/lib/utils/save-warning'

/** Props for {@link SaveWarningBanner}. */
export interface SaveWarningBannerProps {
  /** Backend table name of the viewed record. */
  tableName: string
  /** Primary key of the viewed record. */
  primaryKey: string | number
}

/**
 * Shows the save warning remembered for this record, once.
 *
 * @param props - See {@link SaveWarningBannerProps}.
 * @returns The warning alert, or `null` when there is none.
 */
export function SaveWarningBanner({ tableName, primaryKey }: SaveWarningBannerProps) {
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    // session storage is read after mount (it is unavailable while prerendering); the warning is
    // taken once, so a repeated effect (development strict mode) keeps the one already shown
    const taken = takeSaveWarning(tableName, primaryKey)
    if (taken !== null) setWarning(taken)
  }, [tableName, primaryKey])

  if (!warning) return null
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
      data-qqq-id="record-save-warning"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 break-words">{warning}</p>
      <button
        type="button"
        onClick={() => setWarning(null)}
        aria-label="Dismiss warning"
        className="rounded p-0.5 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-ring pointer-coarse:min-h-11 pointer-coarse:min-w-11 dark:hover:bg-yellow-900/40"
        data-qqq-id="button-dismiss-save-warning"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
