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
 * @file ValidationReviewComponent — renders a VALIDATION_REVIEW_SCREEN process
 * component (streamed ETL review): the input count, the choice to validate
 * every record first or process immediately, the validation summary lines once
 * validated, and a record-by-record preview from the process state.
 */

'use client'

import React, { useEffect, useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import type { QFieldMetaData, QRecord, QTableMetaData } from '@/types'
import { processRecords } from '@/lib/api/processes'

import { useProcessStep } from './ProcessStepContext'
import { ProcessSummaryLines, readSummaryLines } from './ProcessSummaryLines'
import { recordCellText } from './RecordListComponent'

const PREVIEW_LIMIT = 10

/** Props for {@link ValidationReviewComponent}. */
export interface ValidationReviewComponentProps {
  index: number
}

/**
 * Pluralized "N {table} record(s)" text.
 * @param count - Record count.
 * @param table - The source table.
 * @returns The phrase.
 */
function recordPhrase(count: number, table: QTableMetaData): string {
  return `${count.toLocaleString('en-US')} ${table.label} record${count === 1 ? '' : 's'}`
}

/**
 * One previewed record: either the step's record-list fields, or the fields of
 * the table named by `formatPreviewRecordUsingTableLayout`, grouped by section.
 * @param props - The record, the fields and the optional table layout.
 * @returns The preview body.
 */
function PreviewRecord({ record, fields, layoutTable }: { record: QRecord; fields: QFieldMetaData[]; layoutTable?: QTableMetaData }) {
  if (layoutTable) {
    return (
      <div className="space-y-3">
        {layoutTable.sections.filter((section) => !section.isHidden && section.fieldNames?.length).map((section) => {
          const sectionFields = section.fieldNames.map((name) => layoutTable.fields[name]).filter((field): field is QFieldMetaData => Boolean(field))
          return (
            <div key={section.name}>
              <h5 className="text-sm font-semibold text-foreground">{section.label}</h5>
              <div className="ml-3">
                {sectionFields.map((field) => (
                  <div key={field.name} className="text-sm" data-qqq-id={`process-preview-field-${field.name}`}>
                    <span className="font-medium">{field.label}:</span> {recordCellText(record, field)}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {fields.map((field) => (
        <div key={field.name} className="text-sm" data-qqq-id={`process-preview-field-${field.name}`}>
          <span className="font-semibold">{field.label}:</span> {recordCellText(record, field)}
        </div>
      ))}
    </div>
  )
}

/**
 * Render a VALIDATION_REVIEW_SCREEN component.
 * @param props - {@link ValidationReviewComponentProps}
 * @returns The review panel.
 */
export function ValidationReviewComponent({ index }: ValidationReviewComponentProps) {
  const { step, values, form, processName, processUUID, sourceTableMetaData, previewTableMetaData, setOverrideOnLastStep, tableVariant } = useProcessStep()
  const [previewIndex, setPreviewIndex] = useState(0)
  const radioName = useId()
  const validationSummary = readSummaryLines(values.validationSummary)
  const hasValidated = Array.isArray(values.validationSummary)
  const supportsFullValidation = values.supportsFullValidation === true || values.supportsFullValidation === 'true'
  const recordCount = typeof values.recordCount === 'number' ? values.recordCount : undefined
  const doFullValidation = form.watch('doFullValidation')

  ////////////////////////////////////////////////////////////////////////////
  // before validation, the default choice (validate) makes this not the     //
  // last step; choosing to skip validation makes Next read Submit           //
  ////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    if (!hasValidated && supportsFullValidation) setOverrideOnLastStep(doFullValidation !== 'true')
    return () => setOverrideOnLastStep(null)
  }, [doFullValidation, hasValidated, setOverrideOnLastStep, supportsFullValidation])

  const previewQuery = useQuery({
    queryKey: ['qqq', 'processPreviewRecords', processName, processUUID, step.name],
    queryFn: () => processRecords(processName, processUUID!, 0, PREVIEW_LIMIT, tableVariant),
    enabled: Boolean(processUUID) && Boolean(step.recordListFields?.length),
    retry: false,
  })
  const previewRecords = previewQuery.data?.records ?? []
  const previewRecord = previewRecords[previewIndex]
  const previewMessage = typeof values.previewMessage === 'string' ? values.previewMessage : ''
  const layoutTable = typeof values.formatPreviewRecordUsingTableLayout === 'string' ? previewTableMetaData : undefined

  return (
    <div className="grid gap-6 lg:grid-cols-2" data-qqq-id={`process-validation-review-${index}`}>
      <div className="space-y-4 text-sm">
        {hasValidated ? (
          <>
            {recordCount !== undefined && sourceTableMetaData && (
              <p data-qqq-id="process-validation-complete">{`Validation complete on ${recordPhrase(recordCount, sourceTableMetaData)}.`}</p>
            )}
            <ProcessSummaryLines lines={validationSummary} table={sourceTableMetaData} />
          </>
        ) : (
          <>
            {recordCount !== undefined && sourceTableMetaData && (
              <p data-qqq-id="process-validation-input">{`Input: ${recordPhrase(recordCount, sourceTableMetaData)}.`}</p>
            )}
            {supportsFullValidation && (
              <fieldset className="space-y-3" data-qqq-id="process-validation-choice">
                <legend className="mb-2 font-medium text-foreground">How would you like to proceed?</legend>
                <label className="flex items-start gap-2">
                  <input type="radio" value="true" {...form.register('doFullValidation')} aria-describedby={`${radioName}-validate`} className="mt-1" />
                  <span>
                    Perform Validation on all records before processing.
                    <span id={`${radioName}-validate`} className="block text-xs text-muted-foreground">
                      A validation step runs on every input record first, and reports how many can be processed and how many have issues. It may take several minutes.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="radio" value="false" {...form.register('doFullValidation')} aria-describedby={`${radioName}-skip`} className="mt-1" />
                  <span>
                    Skip Validation. Submit the records for immediate processing.
                    <span id={`${radioName}-skip`} className="block text-xs text-muted-foreground">
                      The records are processed now; you will be told which ones had issues afterwards.
                    </span>
                  </span>
                </label>
              </fieldset>
            )}
          </>
        )}
      </div>

      {Boolean(step.recordListFields?.length) && (
        <section aria-label="Preview" className="rounded-xl border border-border p-4" data-qqq-id="process-validation-preview">
          <h4 className="mb-2 text-sm font-semibold text-foreground">Preview</h4>
          <p className="mb-3 text-sm italic text-muted-foreground">
            {previewQuery.isPending ? 'Loading...'
              : previewMessage && previewRecords.length > 0 ? previewMessage
                : 'No record previews are available at this time.'}
          </p>
          {previewRecord && (
            <>
              <PreviewRecord record={previewRecord} fields={step.recordListFields ?? []} layoutTable={layoutTable} />
              <div className="mt-4 flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setPreviewIndex((value) => Math.max(0, value - 1))}
                  disabled={previewIndex <= 0}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-primary hover:bg-accent disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Previous preview record"
                  data-qqq-id="button-preview-previous"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
                </button>
                <span data-qqq-id="process-preview-position">{`Preview ${previewIndex + 1} of ${previewRecords.length}`}</span>
                <button
                  type="button"
                  onClick={() => setPreviewIndex((value) => Math.min(previewRecords.length - 1, value + 1))}
                  disabled={previewIndex >= previewRecords.length - 1}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-primary hover:bg-accent disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Next preview record"
                  data-qqq-id="button-preview-next"
                >
                  Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
