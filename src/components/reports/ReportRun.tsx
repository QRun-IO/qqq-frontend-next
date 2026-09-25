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
 * @file ReportRun — page component for running a QQQ report and downloading its file.
 */

'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, FileBarChart } from 'lucide-react'

import type { QFieldMetaData, QReportMetaData } from '@/types'
import { legacyReportUrl, pollReport, startReport, submitReportInputs } from '@/lib/api/reports'
import type { ReportFormat, ReportRunState } from '@/lib/api/reports'
import { cn } from '@/lib/utils/cn'

/**
 * Props for the {@link ReportRun} component.
 */
export interface ReportRunProps {
  /** Backend-registered name of the report to execute. */
  reportName: string
  /** Metadata describing the report (label, permission, process). */
  reportMetaData: QReportMetaData
}

/** Output format options presented in the format selector. */
const FORMAT_OPTIONS: Array<{ value: ReportFormat; label: string }> = [
  { value: 'CSV', label: 'CSV' },
  { value: 'XLSX', label: 'Excel (.xlsx)' },
  { value: 'JSON', label: 'JSON' },
]

/** Interval between status polls for asynchronous report jobs. */
const POLL_INTERVAL_MS = 1000

/**
 * HTML input type for a report input field.
 *
 * @param field - Input field metadata.
 * @returns The input type.
 */
function inputType(field: QFieldMetaData): string {
  switch (field.type) {
    case 'INTEGER':
    case 'DECIMAL':
    case 'LONG':
      return 'number'
    case 'DATE':
      return 'date'
    case 'DATE_TIME':
      return 'datetime-local'
    default:
      return 'text'
  }
}

/**
 * Converts form text to the value sent for a report input.
 *
 * @param field - Input field metadata.
 * @param text - Entered text.
 * @returns The value to submit.
 */
function inputValue(field: QFieldMetaData, text: string): unknown {
  if (text === '') return null
  if (field.type === 'INTEGER' || field.type === 'LONG') return Number.parseInt(text, 10)
  if (field.type === 'DECIMAL') return Number(text)
  return text
}

/**
 * Renders the report runner for one QQQ report.
 *
 * - Format selector (CSV / Excel / JSON) and a Run Report button.
 * - When the report declares input fields, a form for them (required fields validated).
 * - While the report generates, a running indicator (asynchronous jobs are polled).
 * - When done, a download link for the generated file.
 * - Backend errors (including permission denials) are shown inline.
 *
 * @param props - See {@link ReportRunProps}.
 * @returns The report execution UI container.
 */
export function ReportRun({ reportName, reportMetaData }: ReportRunProps) {
  const [format, setFormat] = useState<ReportFormat>('CSV')
  const [state, setState] = useState<ReportRunState | null>(null)
  const [busy, setBusy] = useState(false)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [missing, setMissing] = useState<string[]>([])
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const processName = reportMetaData.processName
  const permitted = reportMetaData.hasPermission !== false

  useEffect(() => () => { if (pollTimer.current) clearTimeout(pollTimer.current) }, [])

  /**
   * Applies a run state, polling while a job runs.
   *
   * @param next - The new state.
   * @param jobUUID - Job being polled, carried across status responses.
   */
  function apply(next: ReportRunState, jobUUID?: string) {
    if (next.kind === 'running' && processName) {
      const job = next.jobUUID || jobUUID || ''
      setState(next)
      setBusy(true)
      pollTimer.current = setTimeout(async () => apply(await pollReport(processName, next.processUUID, job), job), POLL_INTERVAL_MS)
      return
    }
    setBusy(false)
    setState(next)
  }

  /** Starts the report in the selected format (or builds the streaming link without a process). */
  async function handleRun() {
    setMissing([])
    if (!processName) {
      setState({ kind: 'done', processUUID: '', fileName: `${reportMetaData.label}.${format.toLowerCase()}`, downloadUrl: legacyReportUrl(reportName, format) })
      return
    }
    setBusy(true)
    setState(null)
    setInputs({})
    apply(await startReport(processName, reportName, format))
  }

  /**
   * Validates and submits the report's input values.
   *
   * @param event - Form submit event.
   * @param fields - Input fields.
   * @param processUUID - Run's process UUID.
   */
  async function handleSubmitInputs(event: React.FormEvent, fields: QFieldMetaData[], processUUID: string) {
    event.preventDefault()
    const absent = fields.filter((field) => field.isRequired && !inputs[field.name]).map((field) => field.name)
    setMissing(absent)
    if (absent.length > 0 || !processName) return
    const values: Record<string, unknown> = { reportName, reportFormat: format }
    for (const field of fields) values[field.name] = inputValue(field, inputs[field.name] ?? '')
    setBusy(true)
    apply(await submitReportInputs(processName, processUUID, values))
  }

  return (
    <div className="space-y-6" data-qqq-id={`report-run-${reportName}`}>
      <div className="flex items-center gap-3">
        <FileBarChart className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-2xl font-semibold text-foreground">{reportMetaData.label}</h2>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        {permitted ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <label htmlFor={`report-format-${reportName}`} className="block text-sm font-medium text-foreground">Output format</label>
              <select
                id={`report-format-${reportName}`}
                value={format}
                onChange={(event) => { setFormat(event.target.value as ReportFormat); setState(null) }}
                disabled={busy}
                data-qqq-id={`report-format-select-${reportName}`}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {FORMAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <button
              type="button"
              onClick={handleRun}
              disabled={busy}
              data-qqq-id={`button-run-report-${reportName}`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" aria-hidden="true" />
                  Running&hellip;
                </>
              ) : 'Run Report'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-qqq-id={`report-no-permission-${reportName}`}>You do not have permission to run this report.</p>
        )}
      </div>

      {state?.kind === 'input' && (
        <form
          className="space-y-4 rounded-xl border border-border bg-card p-6"
          onSubmit={(event) => handleSubmitInputs(event, state.inputFields, state.processUUID)}
          noValidate
          aria-label={`${reportMetaData.label} inputs`}
          data-qqq-id={`report-inputs-${reportName}`}
        >
          {state.inputFields.map((field) => {
            const invalid = missing.includes(field.name)
            return (
              <div key={field.name} className="space-y-1">
                <label htmlFor={`report-input-${field.name}`} className="block text-sm font-medium text-foreground">
                  {field.label ?? field.name}{field.isRequired ? ' *' : ''}
                </label>
                <input
                  id={`report-input-${field.name}`}
                  name={field.name}
                  type={inputType(field)}
                  value={inputs[field.name] ?? ''}
                  onChange={(event) => setInputs((current) => ({ ...current, [field.name]: event.target.value }))}
                  aria-required={field.isRequired || undefined}
                  aria-invalid={invalid || undefined}
                  aria-describedby={invalid ? `report-input-error-${field.name}` : undefined}
                  className={cn('w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm', invalid ? 'border-destructive' : 'border-input')}
                  data-qqq-id={`report-input-${field.name}`}
                />
                {invalid && <p id={`report-input-error-${field.name}`} className="text-xs text-destructive">{field.label ?? field.name} is required.</p>}
              </div>
            )
          })}
          <button
            type="submit"
            disabled={busy}
            data-qqq-id={`button-submit-report-inputs-${reportName}`}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            Generate Report
          </button>
        </form>
      )}

      {state?.kind === 'running' && (
        <p role="status" className="text-sm text-muted-foreground" data-qqq-id={`report-running-${reportName}`}>{state.message ?? 'Generating report…'}</p>
      )}

      {state?.kind === 'error' && (
        <div role="alert" data-qqq-id={`report-error-${reportName}`} className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      )}

      {state?.kind === 'done' && (
        <div data-qqq-id={`report-result-${reportName}`} className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div role="status" className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
            Report complete
          </div>
          <a
            href={state.downloadUrl}
            download={state.fileName}
            data-qqq-id={`report-download-link-${reportName}`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download {state.fileName}
          </a>
        </div>
      )}
    </div>
  )
}
