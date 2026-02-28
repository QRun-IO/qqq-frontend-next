/** use-process — TanStack Query hook for managing the full QQQ process lifecycle including init, step submission, async job polling, and cancellation */

'use client'

// use-process — TanStack Query hook for managing full process lifecycle
// Handles init, step submission, async polling, and cancellation

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import type {
  QProcessMetaData,
  QFrontendStepMetaData,
  QFieldMetaData,
  QJobStarted,
  QJobRunning,
  QJobComplete,
  QJobError,
  QJobResponse,
} from '@/types'
import {
  processInit,
  processStep,
  processStatus,
  processCancel,
  type ProcessInitRequest,
  type ProcessStepRequest,
} from '@/lib/api/processes'
import { queryKeys } from '@/lib/query-client'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Lifecycle status of a running process.
 *
 * - `idle` — hook mounted, `initProcess` not yet called.
 * - `initializing` — `processInit` API call in flight.
 * - `running` — process has started and is waiting on user input for the current step.
 * - `polling` — an async job was returned by the server; the hook is polling for completion.
 * - `complete` — the backend returned no `nextStep`; the process finished successfully.
 * - `error` — a network error or a `QJobError` response was received.
 * - `cancelled` — the user cancelled and the hook sent a `processCancel` request.
 */
export type ProcessStatus =
  | 'idle'
  | 'initializing'
  | 'running'        // on a step
  | 'polling'        // waiting for async job
  | 'complete'
  | 'error'
  | 'cancelled'

/**
 * Full mutable state managed by `useProcess`.
 *
 * Kept in a single `useState` object so that all transitions are atomic — no
 * risk of the UI observing a half-updated state across multiple `setState` calls.
 */
export interface ProcessState {
  /** Server-assigned UUID for the active process session, `null` before init. */
  processUUID: string | null
  /** Metadata for the step currently being rendered, `null` when idle or complete. */
  currentStep: QFrontendStepMetaData | null
  /** Accumulated form values from all steps submitted so far. */
  stepValues: Record<string, unknown>
  /** Current lifecycle status. */
  status: ProcessStatus
  /** UUID of the async job currently being polled, `null` when not polling. */
  jobUUID: string | null
  /** Human-readable error message surfaced to the user, `null` when no error. */
  errorMessage: string | null
  /** `true` when `currentStep` is the last step in the process's step list. */
  isLastStep: boolean
  /** Process metadata passed into the hook; updated via `processMetaDataAdjustment`. */
  processMetaData: QProcessMetaData | null
  /** Values returned from the last completed job */
  resultValues: Record<string, unknown>
  /**
   * Accumulated field metadata overrides from `processMetaDataAdjustment.modifiedFields`.
   *
   * Keyed by field name; values are partial `QFieldMetaData` objects to merge into
   * the step's `formFields`, `viewFields`, and `recordListFields` before rendering.
   * Applied in `ProcessRun` via `applyModifiedFields`.
   */
  modifiedFields: Record<string, Partial<QFieldMetaData>>
}

/**
 * Return type of `useProcess`, exposing process state and action callbacks.
 */
export interface UseProcessReturn {
  /** Current process state snapshot. */
  state: ProcessState
  /**
   * `true` while the hook is initializing, submitting a step, or polling for an async job.
   *
   * Consumers should disable form submit buttons and show a loading indicator while this is `true`.
   */
  isLoading: boolean
  /** Start the process (call init) */
  initProcess: (request?: ProcessInitRequest) => Promise<void>
  /** Submit the current step */
  submitStep: (values: Record<string, unknown>, file?: File) => Promise<void>
  /** Go back to the previous step (submits `_goBack` to the server when initialised) */
  goBack: () => Promise<void>
  /** Cancel the process and navigate away */
  cancel: () => Promise<void>
}

// ─── Type guards ──────────────────────────────────────────────────────────────

/**
 * Narrows `r` to `QJobStarted` — the server accepted the request and returned an
 * async `jobUUID` that must be polled for a result.
 *
 * @param r - Raw job response from the API.
 * @returns `true` when `r` is a `QJobStarted` response.
 */
function isJobStarted(r: QJobResponse): r is QJobStarted {
  return 'jobUUID' in r && !('values' in r) && !('error' in r) && !('message' in r)
}

/**
 * Narrows `r` to `QJobRunning` — the async job is still executing; poll again later.
 *
 * @param r - Raw job response from the API.
 * @returns `true` when `r` is a `QJobRunning` response.
 */
function isJobRunning(r: QJobResponse): r is QJobRunning {
  return 'message' in r && !('jobUUID' in r) && !('values' in r) && !('error' in r)
}

/**
 * Narrows `r` to `QJobComplete` — the job finished successfully and `values` contains
 * the result payload (including an optional `nextStep` name).
 *
 * @param r - Raw job response from the API.
 * @returns `true` when `r` is a `QJobComplete` response.
 */
function isJobComplete(r: QJobResponse): r is QJobComplete {
  return 'values' in r && !('error' in r)
}

/**
 * Narrows `r` to `QJobError` — the job failed with a server-side error.
 *
 * @param r - Raw job response from the API.
 * @returns `true` when `r` is a `QJobError` response.
 */
function isJobError(r: QJobResponse): r is QJobError {
  return 'error' in r
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages the full lifecycle of a QQQ process execution.
 *
 * Responsibilities:
 * - Calls `processInit` to start the process and receive the first step.
 * - Calls `processStep` on each user form submission.
 * - Polls `processStatus` with exponential backoff when the server returns an async job UUID.
 * - Applies `processMetaDataAdjustment` (dynamic step additions / removals) from job responses.
 * - Accumulates step values across all submissions so earlier answers remain available.
 * - Exposes a `goBack` action that moves the UI back one step (client-side only).
 * - Calls `processCancel` and navigates away when the user cancels.
 *
 * @param processName - Backend process name used for all API calls.
 * @param processMetaData - Pre-fetched process metadata (may be `null` before metadata loads).
 * @returns `UseProcessReturn` — the current `state`, an `isLoading` flag, and action callbacks.
 */
export function useProcess(
  processName: string,
  processMetaData: QProcessMetaData | null
): UseProcessReturn {
  const router = useRouter()

  const [state, setState] = useState<ProcessState>({
    processUUID: null,
    currentStep: null,
    stepValues: {},
    status: 'idle',
    jobUUID: null,
    errorMessage: null,
    isLastStep: false,
    processMetaData,
    resultValues: {},
    modifiedFields: {},
  })

  // Keep a ref to current state for use in async callbacks
  const stateRef = useRef(state)
  stateRef.current = state

  // Track poll count for exponential backoff
  const pollCountRef = useRef(0)

  // Keep a ref to processMetaData steps (may change via processMetaDataAdjustment)
  const stepsRef = useRef<QFrontendStepMetaData[]>(processMetaData?.frontendSteps ?? [])

  // ─── Step resolution ────────────────────────────────────────────────────────

  /**
   * Look up a step's metadata by name from the (potentially adjusted) steps list.
   *
   * Uses `stepsRef` so it always reflects the latest step list even after a
   * `processMetaDataAdjustment` has been applied without a re-render.
   *
   * @param stepName - The `name` field of the target step.
   * @returns The matching `QFrontendStepMetaData`, or `null` if not found.
   */
  const resolveStep = useCallback(
    (stepName: string): QFrontendStepMetaData | null => {
      return stepsRef.current.find((s) => s.name === stepName) ?? null
    },
    []
  )

  /**
   * Determine whether a step is the last step in the current steps list.
   *
   * Used to set `isLastStep` on state transitions so the UI can render a
   * "Finish" button instead of "Next" on the final step.
   *
   * @param stepName - The `name` field of the step to check.
   * @returns `true` when `stepName` matches the last entry in `stepsRef.current`.
   */
  const isLastStepCheck = useCallback((stepName: string): boolean => {
    const steps = stepsRef.current
    if (steps.length === 0) return false
    return steps[steps.length - 1]?.name === stepName
  }, [])

  // ─── Handle job response ────────────────────────────────────────────────────

  /**
   * Central dispatcher for all `QJobResponse` variants returned by the API.
   *
   * Applies the appropriate state transition for each response type:
   * - `QJobError` → sets `status: 'error'` with the user-facing message.
   * - `QJobStarted` → sets `status: 'polling'` and records the `jobUUID`.
   * - `QJobRunning` → leaves status as `'polling'` (poll again on next interval).
   * - `QJobComplete` → applies any `processMetaDataAdjustment`, merges result values,
   *   and either advances to the `nextStep` or marks the process `complete`.
   * - Unrecognized shape → sets `status: 'error'` (HIGH-4 catch-all).
   *
   * @param response - The raw job response from `processInit`, `processStep`, or `processStatus`.
   * @param processUUID - The server-assigned session UUID; required to update state atomically.
   */
  const handleJobResponse = useCallback(
    (response: QJobResponse, processUUID: string) => {
      if (isJobError(response)) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: response.userFacingError ?? response.error,
        }))
        return
      }

      if (isJobStarted(response)) {
        // Async job — need to poll; reset backoff counter
        pollCountRef.current = 0
        setState((prev) => ({
          ...prev,
          processUUID,
          jobUUID: response.jobUUID,
          status: 'polling',
        }))
        return
      }

      if (isJobRunning(response)) {
        // Still running (shouldn't normally hit this from init/step directly)
        setState((prev) => ({
          ...prev,
          status: 'polling',
        }))
        return
      }

      if (isJobComplete(response)) {
        // Apply any processMetaDataAdjustment (MED-20: accumulate modifiedFields)
        let nextModifiedFields = { ...stateRef.current.modifiedFields }
        if (response.processMetaDataAdjustment) {
          const { addedSteps, removedSteps, modifiedFields } = response.processMetaDataAdjustment
          let updatedSteps = [...stepsRef.current]
          if (removedSteps) {
            updatedSteps = updatedSteps.filter((s) => !removedSteps.includes(s.name))
          }
          if (addedSteps) {
            updatedSteps = [...updatedSteps, ...addedSteps]
          }
          stepsRef.current = updatedSteps

          // Accumulate modifiedFields overrides — later adjustments win on conflict
          if (modifiedFields) {
            nextModifiedFields = { ...nextModifiedFields, ...modifiedFields }
          }
        }

        // Merge result values into running step values
        const mergedValues = { ...stateRef.current.stepValues, ...response.values }

        if (response.nextStep) {
          const nextStepMeta = resolveStep(response.nextStep)
          if (!nextStepMeta) {
            setState((prev) => ({
              ...prev,
              status: 'error',
              errorMessage: `Unknown step: ${response.nextStep}`,
            }))
            return
          }

          setState((prev) => ({
            ...prev,
            processUUID,
            currentStep: nextStepMeta,
            stepValues: mergedValues,
            status: 'running',
            jobUUID: null,
            isLastStep: isLastStepCheck(response.nextStep!),
            resultValues: response.values,
            modifiedFields: nextModifiedFields,
          }))
        } else {
          // No next step → process complete
          setState((prev) => ({
            ...prev,
            processUUID,
            stepValues: mergedValues,
            currentStep: null,
            status: 'complete',
            jobUUID: null,
            resultValues: response.values,
            modifiedFields: nextModifiedFields,
          }))
        }
        return
      }

      // HIGH-4: catch-all — none of the type guards matched, freeze-proof the state
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'Received an unrecognized response from the server.',
      }))
    },
    [resolveStep, isLastStepCheck]
  )

  // ─── Polling ─────────────────────────────────────────────────────────────────

  /**
   * `true` only while the process is in `'polling'` status with both UUIDs available.
   *
   * Passed to `useQuery`'s `enabled` option so the poll query is entirely inactive
   * outside the polling window, avoiding spurious network requests.
   */
  const pollingEnabled = state.status === 'polling' && !!state.processUUID && !!state.jobUUID

  /**
   * TanStack Query used to poll `processStatus` during async job execution.
   *
   * Uses exponential backoff via `refetchInterval`: starts at 1.5 s, grows 1.5× per
   * poll (tracked by `pollCountRef`), and caps at 12 s. Polling stops automatically
   * when the response is `QJobComplete` or `QJobError`. `gcTime: 0` prevents stale
   * status data from being served on future polls for a different job UUID.
   */
  const statusQuery = useQuery({
    queryKey: queryKeys.processStatus(
      processName,
      state.processUUID ?? '',
      state.jobUUID ?? ''
    ),
    queryFn: () =>
      processStatus(processName, state.processUUID!, state.jobUUID!),
    enabled: pollingEnabled,
    refetchInterval: (query) => {
      // Exponential backoff: 1.5s initial, 1.5x multiplier, 12s max
      const data = query.state.data as QJobResponse | undefined
      if (!data) return 1500
      if (isJobComplete(data) || isJobError(data)) {
        pollCountRef.current = 0
        return false
      }
      const interval = Math.min(1500 * Math.pow(1.5, pollCountRef.current), 12000)
      pollCountRef.current += 1
      return interval
    },
    staleTime: 0,
    gcTime: 0,
  })

  // Forward completed poll results to handleJobResponse.
  // Using useEffect on statusQuery.data is simpler than subscribing to the query cache
  // and avoids the need to compare query keys manually.
  useEffect(() => {
    const data = statusQuery.data
    if (!data || !state.processUUID) return
    if (isJobRunning(data)) return
    handleJobResponse(data, state.processUUID)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusQuery.data])

  // ─── Init ─────────────────────────────────────────────────────────────────

  /**
   * TanStack mutation that calls `processInit` to start the process on the server.
   *
   * On success, the raw `QJobResponse` is forwarded to `handleJobResponse` which
   * advances state to the first step (or kicks off polling for an async init).
   * On error, state transitions to `'error'` with the thrown message.
   */
  const initMutation = useMutation({
    mutationFn: (request: ProcessInitRequest) => processInit(processName, request),
    onSuccess: (response) => {
      // All QJobResponse subtypes carry processUUID — no cast needed (HIGH-3)
      handleJobResponse(response, response.processUUID)
    },
    onError: (err) => {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Failed to start process',
      }))
    },
  })

  /**
   * Start the process by calling the init API.
   *
   * Sets `status: 'initializing'` before the network call so the UI can show a
   * spinner immediately. Awaits the mutation so callers can chain `.then()` or use
   * `try/catch` if needed; errors are handled internally via `onError`.
   *
   * @param request - Optional init payload (e.g. pre-selected record IDs).
   */
  const initProcess = useCallback(
    async (request: ProcessInitRequest = {}) => {
      setState((prev) => ({ ...prev, status: 'initializing', errorMessage: null }))
      await initMutation.mutateAsync(request)
    },
    [initMutation]
  )

  // ─── Submit Step ──────────────────────────────────────────────────────────

  /**
   * TanStack mutation that calls `processStep` to submit a step's form values.
   *
   * Uses `stateRef` (not `state`) to read the current `processUUID` so the mutation
   * function always sees the latest value even if the component re-renders between
   * the `submitStep` call and the mutation execution.
   */
  const stepMutation = useMutation({
    mutationFn: ({
      stepName,
      request,
    }: {
      stepName: string
      request: ProcessStepRequest
    }) =>
      processStep(processName, stateRef.current.processUUID!, stepName, request),
    onSuccess: (response) => {
      handleJobResponse(response, stateRef.current.processUUID!)
    },
    onError: (err) => {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Step submission failed',
      }))
    },
  })

  /**
   * Submit the current step's form values to the server.
   *
   * Merges `values` into the accumulated `stepValues` before calling the API so
   * that the merged payload is immediately visible in state (optimistic update).
   * A no-op when there is no `currentStep` (guards against double-submission).
   *
   * @param values - Key/value pairs from the current step's form.
   * @param file - Optional file upload (e.g. bulk-load CSV).
   */
  const submitStep = useCallback(
    async (values: Record<string, unknown>, file?: File) => {
      const stepName = stateRef.current.currentStep?.name
      if (!stepName) return

      // Merge values into state before submission
      setState((prev) => ({
        ...prev,
        stepValues: { ...prev.stepValues, ...values },
        status: 'running',
      }))

      await stepMutation.mutateAsync({
        stepName,
        request: { values, file },
      })
    },
    [stepMutation]
  )

  // ─── Go Back ──────────────────────────────────────────────────────────────

  /**
   * Navigate back to the previous process step.
   *
   * When a `processUUID` exists (the process has been initialised on the server),
   * submits the reserved `_goBack` step name so the server can roll back its own
   * state and return the correct previous-step metadata. The response is routed
   * through `handleJobResponse` exactly like any other step submission.
   *
   * Falls back to pure client-side navigation when `processUUID` is null (i.e.
   * the process was never initialised, which can happen in test scenarios). In
   * that case the client rewinds the step list locally without contacting the
   * server. A no-op when already on the first step (`currentIdx <= 0`).
   */
  const goBack = useCallback(async () => {
    const steps = stepsRef.current
    const currentIdx = steps.findIndex((s) => s.name === stateRef.current.currentStep?.name)
    if (currentIdx <= 0) return

    if (stateRef.current.processUUID) {
      // MED-8: submit _goBack to the server so it can roll back server-side state
      // and return the correct previous-step metadata.
      setState((prev) => ({ ...prev, status: 'running' }))
      await stepMutation.mutateAsync({
        stepName: '_goBack',
        request: { values: {} },
      })
    } else {
      // Fallback: process not yet initialised — navigate client-side only.
      const prevStep = steps[currentIdx - 1]
      setState((prev) => ({
        ...prev,
        currentStep: prevStep,
        status: 'running',
        isLastStep: isLastStepCheck(prevStep.name),
      }))
    }
  }, [isLastStepCheck, stepMutation])

  // ─── Cancel ───────────────────────────────────────────────────────────────

  /**
   * TanStack mutation that calls `processCancel` to notify the server.
   *
   * A no-op mutation (resolves immediately) when `processUUID` is `null`, covering
   * the edge case where the user cancels before init completes. Cancel errors are
   * swallowed by `cancel` because the user's intent to leave is already fulfilled.
   */
  const cancelMutation = useMutation({
    mutationFn: () => {
      if (stateRef.current.processUUID) {
        return processCancel(processName, stateRef.current.processUUID)
      }
      return Promise.resolve(true)
    },
  })

  /**
   * Cancel the in-progress process and navigate back to the previous page.
   *
   * Sets `status: 'cancelled'` immediately (optimistic) before sending the cancel
   * request so the UI reflects the user's intent without waiting for the network.
   * Cancel API errors are silently ignored — the navigation still proceeds.
   */
  const cancel = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'cancelled' }))
    try {
      await cancelMutation.mutateAsync()
    } catch {
      // Ignore cancel errors
    }
    router.back()
  }, [cancelMutation, router])

  // ─── Loading state ────────────────────────────────────────────────────────

  /**
   * Composite loading flag — `true` while any network activity is in flight.
   *
   * Covers: initial process start (`initializing`), async job polling (`polling`),
   * the init mutation being pending, and the step mutation being pending.
   */
  const isLoading =
    state.status === 'initializing' ||
    state.status === 'polling' ||
    initMutation.isPending ||
    stepMutation.isPending

  return {
    state,
    isLoading,
    initProcess,
    submitStep,
    goBack,
    cancel,
  }
}
