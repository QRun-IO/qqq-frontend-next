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
 * @file use-process — drives one QQQ process run: init, screen submission, back
 * steps, async job polling with progress, dynamic step lists, cancel and retry.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { QFieldMetaData, QFrontendStepMetaData, QProcessMetaData } from '@/types'
import {
  processCancel,
  processInit,
  processStatus,
  processStep,
  type ProcessFiles,
  type ProcessInitRequest,
  type ProcessResponse,
} from '@/lib/api/processes'
import { getErrorStatusCode } from '@/lib/utils/error-utils'

/** First poll delay after a job starts or reports progress (matches the Material dashboard). */
export const POLL_INITIAL_MILLIS = 1_500
/** Poll delay ceiling while the status endpoint is failing; beyond it the run errors. */
export const POLL_MAX_MILLIS = 12_000
const POLL_BACKOFF = 1.5

/**
 * Lifecycle phase of a process run.
 *
 * - `idle` — not started.
 * - `working` — a request or async job is in flight (see `progress`).
 * - `step` — a frontend screen (`currentStep`) is waiting for the user.
 * - `complete` — the backend finished without another screen.
 * - `error` — the run failed (see `error`).
 * - `cancelled` — the user cancelled the run.
 */
export type ProcessPhase = 'idle' | 'working' | 'step' | 'complete' | 'error' | 'cancelled'

/** Progress reported by a running async job. */
export interface ProcessJobProgress {
  message?: string
  current?: number
  total?: number
  /** When the latest progress report arrived. */
  updatedAt: Date
}

/** Failure details for the error screen. */
export interface ProcessRunError {
  message: string
  /** `true` when the backend wrote the message for users (shown directly). */
  isUserFacing: boolean
}

/** Full state of one process run. */
export interface ProcessState {
  phase: ProcessPhase
  processUUID: string | null
  jobUUID: string | null
  /** Current frontend step list; replaced by `processMetaDataAdjustment.updatedFrontendStepList`. */
  steps: QFrontendStepMetaData[]
  /** Screen being shown when `phase` is `step`. */
  currentStep: QFrontendStepMetaData | null
  /** Latest process values returned by the backend. */
  values: Record<string, unknown>
  /** Step to restart at when the user goes Back from the current screen, if allowed. */
  backStep: string | null
  progress: ProcessJobProgress | null
  error: ProcessRunError | null
  /** Increments for every screen shown, so screen-local state resets between screens. */
  screenInstance: number
}

/** Result of {@link useProcess}. */
export interface UseProcessReturn {
  state: ProcessState
  /** Start (or restart, for Retry) the process with the original init request. */
  start: () => void
  /** Submit the current screen's values (and uploads) and continue. */
  submit: (values: Record<string, unknown>, files?: ProcessFiles) => void
  /** Restart at the backend-provided back step. No-op without one. */
  back: () => void
  /** Tell the backend the user cancelled (runs the process cancel step). */
  cancel: () => Promise<void>
}

/**
 * Apply accumulated field replacements to every field list of every step.
 * @param steps - Frontend steps.
 * @param updatedFields - Replacement field definitions by name.
 * @returns Steps with the replacements applied.
 */
export function applyUpdatedFields(
  steps: QFrontendStepMetaData[],
  updatedFields: Record<string, QFieldMetaData>
): QFrontendStepMetaData[] {
  if (Object.keys(updatedFields).length === 0) return steps
  const patch = (fields?: QFieldMetaData[]) => fields?.map((field) => updatedFields[field.name] ? { ...field, ...updatedFields[field.name] } : field)
  return steps.map((step) => ({
    ...step,
    formFields: patch(step.formFields),
    viewFields: patch(step.viewFields),
    recordListFields: patch(step.recordListFields),
  }))
}

/**
 * Manages the full lifecycle of a QQQ process run against the registered process routes.
 *
 * @param processName - Backend process name.
 * @param processMetaData - Process metadata (supplies the initial step list).
 * @param initialRequest - Record selection, table name and values sent on init (and on retry).
 * @returns The run state and its actions.
 */
export function useProcess(
  processName: string,
  processMetaData: QProcessMetaData,
  initialRequest: ProcessInitRequest
): UseProcessReturn {
  const [state, setState] = useState<ProcessState>(() => ({
    phase: 'idle',
    processUUID: null,
    jobUUID: null,
    steps: processMetaData.frontendSteps ?? [],
    currentStep: null,
    values: {},
    backStep: null,
    progress: null,
    error: null,
    screenInstance: 0,
  }))
  const stateRef = useRef(state)
  stateRef.current = state

  ////////////////////////////////////////////////////////////////////////
  // every run (start / retry) gets a generation; stale responses from a //
  // cancelled, retried or unmounted run are ignored                     //
  ////////////////////////////////////////////////////////////////////////
  const generationRef = useRef(0)
  const pollTimerRef = useRef<number | null>(null)
  const updatedFieldsRef = useRef<Record<string, QFieldMetaData>>({})
  const initialRequestRef = useRef(initialRequest)
  initialRequestRef.current = initialRequest

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  ////////////////////////////////////////////////////////////////////////
  // responses and polls after unmount are ignored; the flag (not the    //
  // generation) is used so React's development remount keeps the run   //
  ////////////////////////////////////////////////////////////////////////
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fail = useCallback((message: string, isUserFacing: boolean) => {
    clearPoll()
    setState((previous) => ({ ...previous, phase: 'error', jobUUID: null, progress: null, error: { message, isUserFacing } }))
  }, [clearPoll])

  /////////////////////////////////////////////////////////////////////////////
  // handle a normalized response; `poll` is supplied later via a ref so the //
  // two callbacks can reference each other                                  //
  /////////////////////////////////////////////////////////////////////////////
  const pollRef = useRef<(generation: number, processUUID: string, jobUUID: string, delay: number) => void>(() => undefined)

  const handle = useCallback((response: ProcessResponse, generation: number) => {
    if (generation !== generationRef.current || !mountedRef.current) return
    switch (response.type) {
      case 'ERROR':
        fail(response.userFacingError ?? response.error, Boolean(response.userFacingError))
        return
      case 'JOB_STARTED':
        setState((previous) => ({
          ...previous,
          phase: 'working',
          processUUID: response.processUUID || previous.processUUID,
          jobUUID: response.jobUUID,
          progress: previous.progress ?? { message: 'Working...', updatedAt: new Date() },
        }))
        pollRef.current(generation, response.processUUID || stateRef.current.processUUID || '', response.jobUUID, POLL_INITIAL_MILLIS)
        return
      case 'RUNNING':
        ////////////////////////////////////////////////////////////////////
        // init and step never report RUNNING; only the status poll does, //
        // and it handles that case itself                                //
        ////////////////////////////////////////////////////////////////////
        fail('Unexpected server response.', false)
        return
      case 'COMPLETE': {
        clearPoll()
        const adjustment = response.processMetaDataAdjustment
        if (adjustment?.updatedFields) {
          updatedFieldsRef.current = { ...updatedFieldsRef.current, ...adjustment.updatedFields }
        }
        const baseSteps = adjustment?.updatedFrontendStepList ?? stateRef.current.steps
        const steps = applyUpdatedFields(baseSteps, updatedFieldsRef.current)
        const processUUID = response.processUUID || stateRef.current.processUUID
        if (!response.nextStep) {
          setState((previous) => ({
            ...previous, phase: 'complete', processUUID, jobUUID: null, steps, currentStep: null,
            values: response.values, backStep: null, progress: null, error: null,
          }))
          return
        }
        const nextStep = steps.find((step) => step.name === response.nextStep)
        if (!nextStep) {
          setState((previous) => ({ ...previous, steps, processUUID }))
          fail(`Unknown process step ${response.nextStep}.`, false)
          return
        }
        setState((previous) => ({
          ...previous, phase: 'step', processUUID, jobUUID: null, steps, currentStep: nextStep,
          values: response.values, backStep: response.backStep ?? null, progress: null, error: null,
          screenInstance: previous.screenInstance + 1,
        }))
      }
    }
  }, [clearPoll, fail])

  pollRef.current = (generation, processUUID, jobUUID, delay) => {
    clearPoll()
    pollTimerRef.current = window.setTimeout(async () => {
      pollTimerRef.current = null
      if (generation !== generationRef.current || !mountedRef.current) return
      try {
        const response = await processStatus(processName, processUUID, jobUUID, initialRequestRef.current?.tableVariant)
        if (generation !== generationRef.current) return
        if (response.type === 'RUNNING') {
          setState((previous) => ({
            ...previous,
            phase: 'working',
            progress: { message: response.message, current: response.current, total: response.total, updatedAt: new Date() },
          }))
          pollRef.current(generation, processUUID, jobUUID, POLL_INITIAL_MILLIS)
          return
        }
        if (response.type === 'JOB_STARTED') {
          fail('Unexpected server response.', false)
          return
        }
        handle(response, generation)
      } catch (error) {
        if (generation !== generationRef.current) return
        const status = getErrorStatusCode(error)
        if (status === 401) return
        if (status === undefined || status >= 500) {
          const nextDelay = delay * POLL_BACKOFF
          if (nextDelay <= POLL_MAX_MILLIS) {
            pollRef.current(generation, processUUID, jobUUID, nextDelay)
            return
          }
          fail('Could not connect to server', false)
          return
        }
        fail(error instanceof Error ? error.message : 'Could not check the job status', false)
      }
    }, delay)
  }

  /**
   * Run one request for the current generation and route its result.
   * @param request - The API call to make.
   * @param generation - Generation that owns the call.
   */
  const run = useCallback(async (request: () => Promise<ProcessResponse>, generation: number) => {
    try {
      handle(await request(), generation)
    } catch (error) {
      if (generation !== generationRef.current) return
      if (getErrorStatusCode(error) === 401) return
      fail(error instanceof Error ? error.message : 'The process request failed', false)
    }
  }, [fail, handle])

  const start = useCallback(() => {
    generationRef.current += 1
    const generation = generationRef.current
    clearPoll()
    updatedFieldsRef.current = {}
    setState((previous) => ({
      ...previous, phase: 'working', processUUID: null, jobUUID: null, steps: processMetaData.frontendSteps ?? [],
      currentStep: null, values: {}, backStep: null, error: null, progress: { message: 'Working...', updatedAt: new Date() },
    }))
    void run(() => processInit(processName, initialRequestRef.current), generation)
  }, [clearPoll, processMetaData.frontendSteps, processName, run])

  const submit = useCallback((values: Record<string, unknown>, files?: ProcessFiles) => {
    const { processUUID, currentStep, phase } = stateRef.current
    if (!processUUID || !currentStep || phase !== 'step') return
    const generation = generationRef.current
    setState((previous) => ({ ...previous, phase: 'working', progress: { message: 'Working...', updatedAt: new Date() } }))
    void run(() => processStep(processName, processUUID, currentStep.name, { values, files, tableVariant: initialRequestRef.current?.tableVariant }), generation)
  }, [processName, run])

  const back = useCallback(() => {
    const { processUUID, backStep, phase } = stateRef.current
    if (!processUUID || !backStep || phase !== 'step') return
    const generation = generationRef.current
    setState((previous) => ({ ...previous, phase: 'working', progress: { message: 'Working...', updatedAt: new Date() } }))
    void run(() => processStep(processName, processUUID, backStep, { isStepBack: true, tableVariant: initialRequestRef.current?.tableVariant }), generation)
  }, [processName, run])

  const cancel = useCallback(async () => {
    const { processUUID } = stateRef.current
    generationRef.current += 1
    clearPoll()
    setState((previous) => ({ ...previous, phase: 'cancelled', jobUUID: null }))
    if (!processUUID) return
    try {
      await processCancel(processName, processUUID, initialRequestRef.current?.tableVariant)
    } catch {
      /////////////////////////////////////////////////////////////////////
      // the user is leaving either way; a failed cancel is not blocking //
      /////////////////////////////////////////////////////////////////////
    }
  }, [clearPoll, processName])

  return { state, start, submit, back, cancel }
}
