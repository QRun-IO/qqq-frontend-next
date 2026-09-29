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
 *
 * As in Material (whose ReportRun is a ProcessRun of the report's process), a report
 * with a process runs through the generic process screens: the report's input fields
 * (`inputFieldList`) in the full dynamic form (possible values, booleans, dates...),
 * any other screen the report process shows, and finally its file (by server path or
 * by storage reference). The output format is chosen from the backend's report formats
 * before the run, unless the report's process asks for it on a screen.
 */

'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Download, FileBarChart } from 'lucide-react'

import type { QProcessMetaData, QReportMetaData } from '@/types'
import {
  DEFAULT_REPORT_FORMAT, REPORT_FORMAT_FIELD, isDownloadStep, loadReportFormats, processDeclaresReportFormat, reportFile, reportFileUrl,
} from '@/lib/api/reports'
import type { ReportFile, ReportFormat } from '@/lib/api/reports'
import { loadMetaData } from '@/lib/api/metadata'
import { useProcessMetaData } from '@/lib/hooks/use-metadata'
import { useProcess } from '@/lib/hooks/use-process'
import { queryKeys } from '@/lib/query-client'

import { ProcessStepScreen, inputListFields } from '@/components/process/ProcessStepScreen'

/**
 * Props for the {@link ReportRun} component.
 */
export interface ReportRunProps {
  /** Backend-registered name of the report to execute. */
  reportName: string
  /** Metadata describing the report (label, permission, process). */
  reportMetaData: QReportMetaData
}

/**
 * The finished report: a status line and the download link.
 *
 * @param props - Report name and the file.
 * @returns The result panel.
 */
function ReportResult({ reportName, file }: { reportName: string; file: ReportFile }) {
  return (
    <div data-qqq-id={`report-result-${reportName}`} className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div role="status" className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
        Report complete
      </div>
      <a
        href={file.url}
        download={file.fileName}
        data-qqq-id={`report-download-link-${reportName}`}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring pointer-coarse:min-h-11"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Download {file.fileName}
      </a>
    </div>
  )
}

/**
 * A report error.
 *
 * @param props - Report name and message.
 * @returns The alert.
 */
function ReportError({ reportName, message }: { reportName: string; message: string }) {
  return (
    <div role="alert" data-qqq-id={`report-error-${reportName}`} className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

/** Props of {@link ReportProcessRun}. */
interface ReportProcessRunProps {
  reportName: string
  processName: string
  processMetaData: QProcessMetaData
  /** Init values: the report name and, when chosen here, its format. */
  values: Record<string, unknown>
  /** Ends the run (Cancel or Return on a screen). */
  onEnd: () => void
}

/**
 * One run of the report's process: its screens, progress, errors and file.
 *
 * @param props - {@link ReportProcessRunProps}
 * @returns The run's current state.
 */
function ReportProcessRun({ reportName, processName, processMetaData, values, onEnd }: ReportProcessRunProps) {
  const request = useMemo(() => ({ values }), [values])
  const { state, start, submit, back, cancel } = useProcess(processName, processMetaData, request)
  const { data: instance } = useQuery({ queryKey: queryKeys.metadataAll(), queryFn: loadMetaData, staleTime: 1000 * 60 * 30 })
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    start()
  }, [start])

  if (state.phase === 'error') return <ReportError reportName={reportName} message={state.error?.message || 'The report could not be run.'} />
  if (state.phase === 'cancelled') return <p role="status" className="text-sm text-muted-foreground" data-qqq-id={`report-cancelled-${reportName}`}>Report cancelled.</p>
  if (state.phase === 'complete') {
    const file = reportFile(state.values)
    return file ? <ReportResult reportName={reportName} file={file} /> : <ReportError reportName={reportName} message="The report did not produce a file." />
  }
  if (state.phase === 'step' && state.currentStep) {
    const file = isDownloadStep(state.currentStep) ? reportFile(state.values) : null
    if (file) return <ReportResult reportName={reportName} file={file} />
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card" data-qqq-id={`report-screen-${reportName}`}>
        <ProcessStepScreen
          key={state.screenInstance}
          processName={processName}
          processMetaData={processMetaData}
          processUUID={state.processUUID}
          step={state.currentStep}
          steps={state.steps}
          values={state.values}
          backStep={state.backStep}
          isWorking={false}
          compactReportInputs={state.steps.length === 2
            && state.steps[0].name === state.currentStep.name
            && isDownloadStep(state.steps[1])
            && state.currentStep.components?.length === 1
            && state.currentStep.components[0].type === 'EDIT_FORM'
            && !state.currentStep.components[0].values?.sectionLabel
            && !state.currentStep.formFields?.length
            && inputListFields(state.currentStep, state.values).length > 0}
          instance={instance}
          onSubmit={submit}
          onBack={back}
          onCancel={() => { void cancel().then(onEnd) }}
          onReturn={onEnd}
        />
      </div>
    )
  }
  return (
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground" data-qqq-id={`report-running-${reportName}`}>
      {state.progress?.message && state.progress.message !== 'Working...' ? state.progress.message : 'Generating report…'}
    </p>
  )
}

/**
 * Renders the report runner for one QQQ report.
 *
 * - An output format selector (the backend's report formats) and a Run Report button.
 * - The report process's screens (inputs, any other screens) as generic process screens.
 * - While the report generates, a running indicator (asynchronous jobs are polled).
 * - When done, a download link for the generated file.
 * - Backend errors (including permission denials) are shown inline.
 *
 * @param props - See {@link ReportRunProps}.
 * @returns The report execution UI container.
 */
export function ReportRun({ reportName, reportMetaData }: ReportRunProps) {
  const processName = reportMetaData.processName || undefined
  const permitted = reportMetaData.hasPermission !== false
  const { data: processMetaData, isError: processError } = useProcessMetaData(permitted ? processName : undefined)
  const formatOnScreen = processDeclaresReportFormat(processMetaData)
  const formatsQuery = useQuery({
    queryKey: ['qqq', 'reportFormats'],
    queryFn: loadReportFormats,
    enabled: permitted && !formatOnScreen && (!processName || Boolean(processMetaData)),
    staleTime: 1000 * 60 * 30,
    retry: false,
  })
  const formats = formatOnScreen ? [] : formatsQuery.data ?? []
  const [chosenFormat, setChosenFormat] = useState<ReportFormat | null>(null)
  const format = chosenFormat ?? formats[0]?.id?.toString() ?? null
  // each run keeps the values it started with (the format chosen when Run Report was clicked)
  const [run, setRun] = useState<{ id: number; values: Record<string, unknown> } | null>(null)
  const runCount = useRef(0)
  const [streamed, setStreamed] = useState<ReportFile | null>(null)
  const loadingProcess = Boolean(processName) && !processMetaData && !processError

  /** Starts the report in the selected format (or builds the streaming link without a process). */
  function handleRun() {
    if (!processName) {
      const chosen = format ?? DEFAULT_REPORT_FORMAT
      setStreamed({ fileName: `${reportMetaData.label}.${chosen.toLowerCase()}`, url: reportFileUrl(reportName, chosen) })
      return
    }
    runCount.current += 1
    setRun({ id: runCount.current, values: { reportName, ...(format && !formatOnScreen ? { [REPORT_FORMAT_FIELD]: format } : {}) } })
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
            {formats.length > 0 && (
              <div className="space-y-1">
                <label htmlFor={`report-format-${reportName}`} className="block text-sm font-medium text-foreground">Output format</label>
                <select
                  id={`report-format-${reportName}`}
                  value={format ?? ''}
                  onChange={(event) => { setChosenFormat(event.target.value); setStreamed(null) }}
                  data-qqq-id={`report-format-select-${reportName}`}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:h-11"
                >
                  {formats.map((option) => <option key={String(option.id)} value={String(option.id)}>{option.label}</option>)}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={handleRun}
              disabled={loadingProcess || (!formatOnScreen && formatsQuery.isPending && formatsQuery.fetchStatus !== 'idle')}
              data-qqq-id={`button-run-report-${reportName}`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              Run Report
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-qqq-id={`report-no-permission-${reportName}`}>You do not have permission to run this report.</p>
        )}
      </div>

      {processError && <ReportError reportName={reportName} message="The report's process could not be loaded." />}

      {streamed && <ReportResult reportName={reportName} file={streamed} />}

      {run && processName && processMetaData && (
        <ReportProcessRun
          key={run.id}
          reportName={reportName}
          processName={processName}
          processMetaData={processMetaData}
          values={run.values}
          onEnd={() => setRun(null)}
        />
      )}
    </div>
  )
}
