'use client'

// use-process — TanStack Query hook for managing full process lifecycle
// Handles init, step submission, async polling, and cancellation

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import type {
  QProcessMetaData,
  QFrontendStepMetaData,
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

export type ProcessStatus =
  | 'idle'
  | 'initializing'
  | 'running'        // on a step
  | 'polling'        // waiting for async job
  | 'complete'
  | 'error'
  | 'cancelled'

export interface ProcessState {
  processUUID: string | null
  currentStep: QFrontendStepMetaData | null
  stepValues: Record<string, unknown>
  status: ProcessStatus
  jobUUID: string | null
  errorMessage: string | null
  isLastStep: boolean
  processMetaData: QProcessMetaData | null
  /** Values returned from the last completed job */
  resultValues: Record<string, unknown>
}

export interface UseProcessReturn {
  state: ProcessState
  isLoading: boolean
  /** Start the process (call init) */
  initProcess: (request?: ProcessInitRequest) => Promise<void>
  /** Submit the current step */
  submitStep: (values: Record<string, unknown>, file?: File) => Promise<void>
  /** Go back to the previous step */
  goBack: () => void
  /** Cancel the process and navigate away */
  cancel: () => Promise<void>
}

// ─── Type guards ──────────────────────────────────────────────────────────────

function isJobStarted(r: QJobResponse): r is QJobStarted {
  return 'jobUUID' in r && !('values' in r) && !('error' in r) && !('message' in r)
}

function isJobRunning(r: QJobResponse): r is QJobRunning {
  return 'message' in r && !('jobUUID' in r) && !('values' in r) && !('error' in r)
}

function isJobComplete(r: QJobResponse): r is QJobComplete {
  return 'values' in r && !('error' in r)
}

function isJobError(r: QJobResponse): r is QJobError {
  return 'error' in r
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

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
  })

  // Keep a ref to current state for use in async callbacks
  const stateRef = useRef(state)
  stateRef.current = state

  // Track poll count for exponential backoff
  const pollCountRef = useRef(0)

  // Keep a ref to processMetaData steps (may change via processMetaDataAdjustment)
  const stepsRef = useRef<QFrontendStepMetaData[]>(processMetaData?.frontendSteps ?? [])

  // ─── Step resolution ────────────────────────────────────────────────────────

  const resolveStep = useCallback(
    (stepName: string): QFrontendStepMetaData | null => {
      return stepsRef.current.find((s) => s.name === stepName) ?? null
    },
    []
  )

  const isLastStepCheck = useCallback((stepName: string): boolean => {
    const steps = stepsRef.current
    if (steps.length === 0) return false
    return steps[steps.length - 1]?.name === stepName
  }, [])

  // ─── Handle job response ────────────────────────────────────────────────────

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
        // Apply any processMetaDataAdjustment
        if (response.processMetaDataAdjustment) {
          const { addedSteps, removedSteps } = response.processMetaDataAdjustment
          let updatedSteps = [...stepsRef.current]
          if (removedSteps) {
            updatedSteps = updatedSteps.filter((s) => !removedSteps.includes(s.name))
          }
          if (addedSteps) {
            updatedSteps = [...updatedSteps, ...addedSteps]
          }
          stepsRef.current = updatedSteps
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
          }))
        }
        return
      }
    },
    [resolveStep, isLastStepCheck]
  )

  // ─── Polling ─────────────────────────────────────────────────────────────────

  const pollingEnabled = state.status === 'polling' && !!state.processUUID && !!state.jobUUID

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

  const initMutation = useMutation({
    mutationFn: (request: ProcessInitRequest) => processInit(processName, request),
    onSuccess: (response) => {
      // processUUID comes from the response itself
      const pUUID = (response as QJobResponse & { processUUID?: string }).processUUID ?? ''
      handleJobResponse(response, pUUID)
    },
    onError: (err) => {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Failed to start process',
      }))
    },
  })

  const initProcess = useCallback(
    async (request: ProcessInitRequest = {}) => {
      setState((prev) => ({ ...prev, status: 'initializing', errorMessage: null }))
      await initMutation.mutateAsync(request)
    },
    [initMutation]
  )

  // ─── Submit Step ──────────────────────────────────────────────────────────

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

  const goBack = useCallback(() => {
    // The back step logic is managed by the server; for the UI, we
    // just re-set the current step to the step before current in the list
    const steps = stepsRef.current
    const currentIdx = steps.findIndex((s) => s.name === stateRef.current.currentStep?.name)
    if (currentIdx > 0) {
      const prevStep = steps[currentIdx - 1]
      setState((prev) => ({
        ...prev,
        currentStep: prevStep,
        status: 'running',
        isLastStep: isLastStepCheck(prevStep.name),
      }))
    }
  }, [isLastStepCheck])

  // ─── Cancel ───────────────────────────────────────────────────────────────

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (stateRef.current.processUUID) {
        return processCancel(processName, stateRef.current.processUUID)
      }
      return Promise.resolve(true)
    },
  })

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
