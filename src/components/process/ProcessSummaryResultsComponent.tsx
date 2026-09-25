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
 * @file ProcessSummaryResultsComponent — renders a PROCESS_SUMMARY_RESULTS
 * process component: the processed-record count and the backend's
 * `processResults` summary lines.
 */

'use client'

import React, { useId } from 'react'

import { cn } from '@/lib/utils/cn'

import { useProcessStep } from './ProcessStepContext'
import { ProcessSummaryLines, readSummaryLines } from './ProcessSummaryLines'

/** Props for {@link ProcessSummaryResultsComponent}. */
export interface ProcessSummaryResultsComponentProps {
  index: number
}

/**
 * Render a PROCESS_SUMMARY_RESULTS component.
 * @param props - {@link ProcessSummaryResultsComponentProps}
 * @returns The process summary panel.
 */
export function ProcessSummaryResultsComponent({ index }: ProcessSummaryResultsComponentProps) {
  const { values, sourceTableMetaData } = useProcessStep()
  const headingId = useId()
  const recordCount = typeof values.recordCount === 'number' ? values.recordCount : undefined
  const isError = values.status === 'ERROR'
  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-border p-4" data-qqq-id={`process-summary-results-${index}`}>
      <h4 id={headingId} className={cn('mb-3 inline-block rounded-md px-2 py-1 text-sm font-semibold text-white', isError ? 'bg-destructive' : 'bg-green-700')}>
        Process Summary
      </h4>
      {recordCount !== undefined && sourceTableMetaData && (
        <p className="mb-3 text-sm" data-qqq-id="process-summary-record-count">
          {`${recordCount.toLocaleString('en-US')} ${sourceTableMetaData.label} ${recordCount === 1 ? 'record was' : 'records were'} processed.`}
        </p>
      )}
      <ProcessSummaryLines lines={readSummaryLines(values.processResults)} table={sourceTableMetaData} isResultScreen />
    </section>
  )
}
