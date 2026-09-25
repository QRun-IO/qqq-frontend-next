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
 * @file ProcessRun — top-level process orchestrator component.
 *
 * Starts the run (after checking min/max input records it can count), shows the
 * working panel with job progress, the current screen (every declared component
 * in order), the error screen with Retry, or the completion screen, and returns
 * the user to the process's table or app when they cancel or finish.
 */
'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import type { QAppTreeNode, QInstance, QProcessMetaData } from '@/types'
import type { ProcessInitRequest } from '@/lib/api/processes'
import { loadMetaData } from '@/lib/api/metadata'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { useProcess } from '@/lib/hooks/use-process'
import { queryKeys } from '@/lib/query-client'
import { cn } from '@/lib/utils/cn'

import { StepWizard } from './StepWizard'
import { ProcessCancelDialog } from './ProcessCancelDialog'
import { ProcessErrorState } from './ProcessErrorState'
import { ProcessResultStep } from './ProcessResultStep'
import { ProcessStepScreen } from './ProcessStepScreen'

/**
 * Props for the {@link ProcessRun} component.
 */
export interface ProcessRunProps {
  /** Technical name of the process as declared in backend metadata. */
  processName: string
  /** Full process metadata including step definitions and input record constraints. */
  processMetaData: QProcessMetaData
  /** Default input values for the run (e.g. from `defaultProcessValues`). */
  initialValues?: Record<string, unknown>
  /** Record selection and other supported process initialization parameters. */
  initialRequest?: ProcessInitRequest
  /** Additional CSS class names applied to the root container. */
  className?: string
}

/**
 * Count the records a request selects, when the selection is an explicit id list.
 * @param request - Init request.
 * @returns The count, or `null` when a filter selects the records.
 */
function selectedRecordCount(request: ProcessInitRequest): number | null {
  if (request.recordsParam === 'filterJSON') return null
  if (request.recordsParam === 'recordIds') return (request.recordIds ?? '').split(',').filter((id) => id.trim() !== '').length
  return 0
}

/**
 * Client-side check of the process's input record bounds (the backend enforces them too).
 * @param process - Process metadata.
 * @param request - Init request.
 * @returns A message when the selection is out of bounds, else `null`.
 */
export function inputRecordBoundsMessage(process: QProcessMetaData, request: ProcessInitRequest): string | null {
  const count = selectedRecordCount(request)
  if (count === null || !process.tableName) return null
  const min = process.minInputRecords ?? 0
  const max = process.maxInputRecords
  if (min > 0 && count < min) {
    return `This process requires at least ${min} record${min === 1 ? '' : 's'} to be selected, but ${count === 0 ? 'none were' : `only ${count} ${count === 1 ? 'was' : 'were'}`} selected.`
  }
  if (max !== undefined && max !== null && count > max) {
    return `This process allows at most ${max} record${max === 1 ? '' : 's'} to be selected, but ${count} were selected.`
  }
  return null
}

/**
 * The app that lists a process, searching the navigation tree.
 * @param nodes - App tree nodes.
 * @param processName - Process to find.
 * @returns The app name, or `null`.
 */
function appContaining(nodes: QAppTreeNode[] | undefined, processName: string): string | null {
  for (const node of nodes ?? []) {
    if (node.type !== 'APP') continue
    if ((node.children ?? []).some((child) => child.type === 'PROCESS' && child.name === processName)) return node.name
    const nested = appContaining(node.children, processName)
    if (nested) return nested
  }
  return null
}

/**
 * Where the user returns to after a run: the process's table, else the app listing it.
 * @param process - Process metadata.
 * @param instance - Instance metadata.
 * @returns The route.
 */
export function processReturnPath(process: QProcessMetaData, instance: QInstance | undefined): string {
  if (process.tableName) return `/app/${encodeURIComponent(process.tableName)}`
  const app = appContaining(instance?.appTree, process.name)
  return app ? `/app/${encodeURIComponent(app)}` : '/app'
}

/**
 * Renders the complete process execution UI for a given process.
 *
 * @param props - {@link ProcessRunProps}
 * @returns The process run container in its current phase.
 */
export function ProcessRun({
  processName,
  processMetaData,
  initialValues,
  initialRequest,
  className,
}: ProcessRunProps) {
  const router = useRouter()
  const { data: instance } = useQuery({ queryKey: queryKeys.metadataAll(), queryFn: loadMetaData, staleTime: 1000 * 60 * 30 })
  const request = useMemo<ProcessInitRequest>(() => ({
    ...(initialRequest ?? {}),
    ...(processMetaData.tableName ? { tableName: processMetaData.tableName } : {}),
    ...(initialValues ? { values: { ...(initialRequest?.values ?? {}), ...initialValues } } : {}),
  }), [initialRequest, initialValues, processMetaData.tableName])
  const boundsMessage = useMemo(() => inputRecordBoundsMessage(processMetaData, request), [processMetaData, request])

  const { state, start, submit, back, cancel } = useProcess(processName, processMetaData, request)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const startedRef = useRef(false)

  const { data: tableMetaData } = useTableMetaData(processMetaData.tableName || undefined)
  const sourceTableName = typeof state.values.sourceTable === 'string' ? state.values.sourceTable : undefined
  const { data: sourceTableMetaData } = useTableMetaData(sourceTableName)
  const previewTableName = typeof state.values.formatPreviewRecordUsingTableLayout === 'string' ? state.values.formatPreviewRecordUsingTableLayout : undefined
  const { data: previewTableMetaData } = useTableMetaData(previewTableName)

  useEffect(() => {
    if (startedRef.current || boundsMessage) return
    startedRef.current = true
    start()
  }, [boundsMessage, start])

  //////////////////////////////////////////////////////////////////
  // move focus to the new screen's heading (WCAG 2.4.3), not on  //
  // the first screen                                             //
  //////////////////////////////////////////////////////////////////
  useEffect(() => {
    if (state.phase !== 'step' || state.screenInstance <= 1) return
    document.querySelector<HTMLElement>('[data-qqq-id="process-step-heading"]')?.focus()
  }, [state.phase, state.screenInstance])

  const leave = () => router.push(processReturnPath(processMetaData, instance))
  const cancelAndLeave = async () => {
    await cancel()
    leave()
  }

  const container = (children: React.ReactNode) => (
    <div className={cn('mx-auto max-w-3xl', className)} data-qqq-id={`process-run-${processName}`} data-process-phase={boundsMessage ? 'error' : state.phase}>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">{children}</div>
      <ProcessCancelDialog open={confirmCancel} onOpenChange={setConfirmCancel} onConfirm={() => { void cancelAndLeave() }} />
    </div>
  )

  if (boundsMessage) {
    return container(
      <ProcessErrorState error={boundsMessage} isUserFacing processName={processName} processLabel={processMetaData.label} onClose={leave} />
    )
  }

  const steps = state.steps
  const showWizard = (processMetaData.stepFlow ?? 'LINEAR') === 'LINEAR' && steps.length > 1

  if (state.phase === 'error') {
    return container(
      <ProcessErrorState
        error={state.error?.message ?? null}
        isUserFacing={state.error?.isUserFacing ?? false}
        processName={processName}
        processLabel={processMetaData.label}
        onRetry={start}
        onClose={leave}
      />
    )
  }

  if (state.phase === 'complete') {
    return container(
      <>
        {showWizard && (
          <div className="border-b border-border px-6 pt-6 pb-4">
            <StepWizard steps={steps} currentStepName={null} isComplete />
          </div>
        )}
        <div className="p-8">
          <ProcessResultStep processMetaData={processMetaData} resultValues={state.values} />
        </div>
      </>
    )
  }

  if (state.phase === 'cancelled') {
    return container(<p role="status" className="p-8 text-center text-sm text-muted-foreground">Process cancelled.</p>)
  }

  const progress = state.progress
  const hasCounts = progress?.current !== undefined && progress?.total !== undefined && progress.total > 0
  const working = (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center" role="status" aria-live="polite" data-qqq-id="process-working">
      <h3 className="text-lg font-semibold text-foreground">Working</h3>
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-foreground" data-qqq-id="process-working-message">{progress?.message ?? 'Working...'}</p>
      {hasCounts && (
        <div className="w-72">
          <p className="text-sm text-foreground" data-qqq-id="process-working-counts">{`${progress!.current!.toLocaleString('en-US')} of ${progress!.total!.toLocaleString('en-US')}`}</p>
          <div
            role="progressbar"
            aria-label="Process progress"
            aria-valuemin={0}
            aria-valuemax={progress!.total}
            aria-valuenow={progress!.current}
            className="mt-1 h-2 rounded-full bg-muted"
            data-qqq-id="process-progress-bar"
          >
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${Math.min(100, (100 * progress!.current!) / progress!.total!)}%` }} />
          </div>
        </div>
      )}
      {progress?.updatedAt && state.jobUUID && (
        <p className="text-xs italic text-muted-foreground" data-qqq-id="process-working-updated">{`Updated at ${progress.updatedAt.toLocaleTimeString()}`}</p>
      )}
      {state.processUUID && state.jobUUID && (
        <button
          type="button"
          onClick={() => setConfirmCancel(true)}
          className="mt-2 inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          data-qqq-id="button-cancel-working"
        >
          Cancel
        </button>
      )}
    </div>
  )

  if (state.phase !== 'step' || !state.currentStep) {
    return container(
      <>
        {showWizard && state.currentStep && (
          <div className="border-b border-border px-6 pt-6 pb-4">
            <StepWizard steps={steps} currentStepName={state.currentStep.name} />
          </div>
        )}
        {working}
      </>
    )
  }

  return container(
    <>
      {showWizard && (
        <div className="border-b border-border px-6 pt-6 pb-4">
          <StepWizard steps={steps} currentStepName={state.currentStep.name} />
        </div>
      )}
      <ProcessStepScreen
        key={state.screenInstance}
        processName={processName}
        processMetaData={processMetaData}
        processUUID={state.processUUID}
        step={state.currentStep}
        steps={steps}
        values={state.values}
        backStep={state.backStep}
        isWorking={false}
        tableMetaData={tableMetaData}
        sourceTableMetaData={sourceTableMetaData}
        previewTableMetaData={previewTableMetaData}
        instance={instance}
        onSubmit={submit}
        onBack={back}
        onCancel={() => setConfirmCancel(true)}
        onReturn={leave}
      />
    </>
  )
}
