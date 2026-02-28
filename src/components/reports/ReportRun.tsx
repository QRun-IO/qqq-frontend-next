'use client'

/**
 * ReportRun — page component for executing a QQQ backend report.
 *
 * Allows the user to select an output format, run the report, and either
 * download the generated file or view inline results. Async jobs are polled
 * until completion.
 */

import React, { useState, useEffect, useRef } from 'react'
import { Download, FileBarChart, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'

import type { QReportMetaData } from '@/types'
import { runReport, getReportStatus } from '@/lib/api/reports'
import type { RunReportResponse } from '@/lib/api/reports'
import { cn } from '@/lib/utils/cn'

/**
 * Props for the {@link ReportRun} component.
 */
export interface ReportRunProps {
  /** Backend-registered name of the report to execute. */
  reportName: string
  /** Metadata describing the report (label, permissions). */
  reportMetaData: QReportMetaData
}

/** Output format options presented in the format selector. */
const FORMAT_OPTIONS: Array<{ value: 'CSV' | 'EXCEL' | 'JSON'; label: string }> = [
  { value: 'CSV', label: 'CSV' },
  { value: 'EXCEL', label: 'Excel' },
  { value: 'JSON', label: 'JSON' },
]

/** Interval in milliseconds between async job status polls. */
const POLL_INTERVAL_MS = 2000

/** Maximum number of status polls before giving up. */
const MAX_POLLS = 60

/**
 * Renders the report execution UI for a single QQQ report.
 *
 * Features:
 * - Format selector (CSV / Excel / JSON)
 * - "Run Report" button that triggers the backend run
 * - Loading spinner while the report is running (sync or async)
 * - Download link when the result includes a `downloadUrl`
 * - Inline success / error message
 * - Async polling for jobs that don't resolve immediately
 *
 * @param props - {@link ReportRunProps}
 */
export function ReportRun({ reportName, reportMetaData }: ReportRunProps) {
  const [format, setFormat] = useState<'CSV' | 'EXCEL' | 'JSON'>('CSV')
  const [result, setResult] = useState<RunReportResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const pollCountRef = useRef(0)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear any pending poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current !== null) {
        clearTimeout(pollTimerRef.current)
      }
    }
  }, [])

  /**
   * Polls the async job status until the job completes, errors out, or the
   * maximum poll count is reached.
   *
   * @param jobUUID - The async job UUID returned by the initial run call.
   */
  function startPolling(jobUUID: string) {
    setIsPolling(true)
    pollCountRef.current = 0

    function poll() {
      pollCountRef.current += 1

      getReportStatus(jobUUID)
        .then((statusResponse) => {
          if (statusResponse.status === 'ERROR') {
            setIsPolling(false)
            setErrorMessage(statusResponse.error ?? 'Report failed.')
            mutation.reset()
          } else if (
            statusResponse.status !== 'RUNNING' ||
            pollCountRef.current >= MAX_POLLS
          ) {
            setIsPolling(false)
            setResult(statusResponse)
            mutation.reset()
          } else {
            pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
          }
        })
        .catch((err: unknown) => {
          setIsPolling(false)
          const msg =
            err instanceof Error ? err.message : 'Failed to get report status.'
          setErrorMessage(msg)
          mutation.reset()
        })
    }

    pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
  }

  const mutation = useMutation({
    mutationFn: () => runReport(reportName, { reportFormat: format }),
    onSuccess: (response) => {
      setErrorMessage(null)
      if (response.jobUUID && response.status === 'RUNNING') {
        // Async path — start polling
        startPolling(response.jobUUID)
      } else if (response.status === 'ERROR') {
        setErrorMessage(response.error ?? 'Report failed.')
      } else {
        // Synchronous path — result is ready
        setResult(response)
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to run report.'
      setErrorMessage(msg)
    },
  })

  const isRunning = mutation.isPending || isPolling

  function handleRun() {
    setResult(null)
    setErrorMessage(null)
    mutation.mutate()
  }

  return (
    <div
      className="space-y-6"
      data-qqq-id={`report-run-${reportName}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileBarChart className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-2xl font-semibold text-foreground">
          {reportMetaData.label}
        </h2>
      </div>

      {/* Run controls */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {/* Format selector */}
          <div className="space-y-1">
            <label
              htmlFor={`report-format-${reportName}`}
              className="block text-sm font-medium text-foreground"
            >
              Output format
            </label>
            <select
              id={`report-format-${reportName}`}
              value={format}
              onChange={(e) => setFormat(e.target.value as 'CSV' | 'EXCEL' | 'JSON')}
              disabled={isRunning}
              aria-label="Report output format"
              data-qqq-id={`report-format-select-${reportName}`}
              className={cn(
                'rounded-md border border-input bg-background px-3 py-2 text-sm',
                'text-foreground shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Run button */}
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning || !reportMetaData.hasPermission}
            aria-label={`Run report: ${reportMetaData.label}`}
            data-qqq-id={`button-run-report-${reportName}`}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium',
              'text-primary-foreground bg-primary hover:bg-primary/90',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-colors duration-150'
            )}
          >
            {isRunning ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
                  aria-hidden="true"
                />
                Running&hellip;
              </>
            ) : (
              'Run Report'
            )}
          </button>
        </div>

        {!reportMetaData.hasPermission && (
          <p className="mt-3 text-sm text-muted-foreground">
            You do not have permission to run this report.
          </p>
        )}
      </div>

      {/* Error state */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          data-qqq-id={`report-error-${reportName}`}
          className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success state */}
      {result && !errorMessage && (
        <div
          data-qqq-id={`report-result-${reportName}`}
          className="rounded-xl border border-border bg-card p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
            Report complete
          </div>

          {result.downloadUrl && (
            <a
              href={result.downloadUrl}
              download={result.downloadFileName ?? `${reportName}.${format.toLowerCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Download ${result.downloadFileName ?? reportName}`}
              data-qqq-id={`report-download-link-${reportName}`}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                'text-primary-foreground bg-primary hover:bg-primary/90',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'transition-colors duration-150'
              )}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {result.downloadFileName ? `Download ${result.downloadFileName}` : 'Download report'}
            </a>
          )}

          {!result.downloadUrl && result.records && result.records.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {result.records.length} record{result.records.length !== 1 ? 's' : ''} returned.
            </p>
          )}

          {!result.downloadUrl && (!result.records || result.records.length === 0) && (
            <p className="text-sm text-muted-foreground">
              The report completed with no downloadable output.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
