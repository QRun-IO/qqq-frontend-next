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

// Tests for the process run lifecycle hook

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import type { QProcessMetaData } from '@/types'

vi.mock('@/lib/api/processes', () => ({
  processInit: vi.fn(),
  processStep: vi.fn(),
  processStatus: vi.fn(),
  processCancel: vi.fn(),
}))

import { processCancel, processInit, processStatus, processStep } from '@/lib/api/processes'
import { POLL_INITIAL_MILLIS, applyUpdatedFields, useProcess } from './use-process'

const process: QProcessMetaData = {
  name: 'lab', label: 'Lab', tableName: 'specimen', isHidden: false, iconName: '', hasPermission: true, stepFlow: 'LINEAR', minInputRecords: 0,
  frontendSteps: [
    { name: 'choose', label: 'Choose', components: [{ type: 'EDIT_FORM' }], formFields: [{ name: 'detail', label: 'Detail', type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [] }] },
    { name: 'extra', label: 'Extra', components: [{ type: 'EDIT_FORM' }] },
    { name: 'done', label: 'Done', components: [{ type: 'VIEW_FORM' }] },
  ],
}

const request = { recordsParam: 'recordIds' as const, recordIds: '2,4', tableName: 'specimen' }

/**
 * Let pending promises settle.
 */
async function flush() {
  await act(async () => { await Promise.resolve() })
}

describe('useProcess', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with the init request and shows the next screen with its back step', async () => {
    vi.mocked(processInit).mockResolvedValue({ type: 'COMPLETE', processUUID: 'run-1', values: { detail: 'x' }, nextStep: 'extra', backStep: 'choose' })
    const { result } = renderHook(() => useProcess('lab', process, request))
    act(() => result.current.start())
    expect(result.current.state.phase).toBe('working')
    await flush()
    expect(processInit).toHaveBeenCalledWith('lab', request)
    expect(result.current.state).toMatchObject({ phase: 'step', processUUID: 'run-1', backStep: 'choose', values: { detail: 'x' } })
    expect(result.current.state.currentStep?.name).toBe('extra')
  })

  it('keeps the run through a development (StrictMode) remount', async () => {
    vi.mocked(processInit).mockResolvedValue({ type: 'COMPLETE', processUUID: 'run-1', values: {}, nextStep: 'extra' })
    const { result } = renderHook(() => {
      const process_ = useProcess('lab', process, request)
      const started = React.useRef(false)
      React.useEffect(() => {
        if (started.current) return
        started.current = true
        process_.start()
      }, []) // eslint-disable-line react-hooks/exhaustive-deps
      return process_
    }, { wrapper: React.StrictMode })
    await flush()
    expect(result.current.state.phase).toBe('step')
    expect(result.current.state.currentStep?.name).toBe('extra')
  })

  it('steps back with isStepBack at the backend back step (#655)', async () => {
    vi.mocked(processInit).mockResolvedValue({ type: 'COMPLETE', processUUID: 'run-1', values: {}, nextStep: 'extra', backStep: 'choose' })
    vi.mocked(processStep).mockResolvedValue({ type: 'COMPLETE', processUUID: 'run-1', values: {}, nextStep: 'choose' })
    const { result } = renderHook(() => useProcess('lab', process, request))
    act(() => result.current.start())
    await flush()
    act(() => result.current.back())
    await flush()
    expect(processStep).toHaveBeenCalledWith('lab', 'run-1', 'choose', { isStepBack: true })
    expect(result.current.state.currentStep?.name).toBe('choose')
    expect(result.current.state.backStep).toBeNull()
  })

  it('does not step back without a backend back step', async () => {
    vi.mocked(processInit).mockResolvedValue({ type: 'COMPLETE', processUUID: 'run-1', values: {}, nextStep: 'extra' })
    const { result } = renderHook(() => useProcess('lab', process, request))
    act(() => result.current.start())
    await flush()
    act(() => result.current.back())
    expect(processStep).not.toHaveBeenCalled()
  })

  it('polls a started job, shows RUNNING progress and continues when complete (#657)', async () => {
    vi.mocked(processInit).mockResolvedValue({ type: 'COMPLETE', processUUID: 'run-1', values: {}, nextStep: 'choose' })
    vi.mocked(processStep).mockResolvedValue({ type: 'JOB_STARTED', processUUID: 'run-1', jobUUID: 'job-1' })
    vi.mocked(processStatus)
      .mockResolvedValueOnce({ type: 'RUNNING', processUUID: 'run-1', message: 'Item 2 of 5', current: 2, total: 5 })
      .mockResolvedValueOnce({ type: 'RUNNING', processUUID: 'run-1' })
      .mockResolvedValueOnce({ type: 'COMPLETE', processUUID: 'run-1', values: { processedCount: 5 }, nextStep: 'done' })
    const { result } = renderHook(() => useProcess('lab', process, request))
    act(() => result.current.start())
    await flush()
    act(() => result.current.submit({ detail: 'y' }))
    await flush()
    expect(processStep).toHaveBeenCalledWith('lab', 'run-1', 'choose', { values: { detail: 'y' }, files: undefined })
    expect(result.current.state).toMatchObject({ phase: 'working', jobUUID: 'job-1' })

    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INITIAL_MILLIS) })
    expect(result.current.state.progress).toMatchObject({ message: 'Item 2 of 5', current: 2, total: 5 })
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INITIAL_MILLIS) })
    expect(result.current.state.phase).toBe('working')
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INITIAL_MILLIS) })
    expect(processStatus).toHaveBeenCalledTimes(3)
    expect(processStatus).toHaveBeenCalledWith('lab', 'run-1', 'job-1')
    expect(result.current.state).toMatchObject({ phase: 'step', values: { processedCount: 5 } })
    expect(result.current.state.currentStep?.name).toBe('done')
  })

  it('gives up polling with an error once the status endpoint keeps failing', async () => {
    vi.mocked(processInit).mockResolvedValue({ type: 'JOB_STARTED', processUUID: 'run-1', jobUUID: 'job-1' })
    vi.mocked(processStatus).mockRejectedValue(new Error('Network Error'))
    const { result } = renderHook(() => useProcess('lab', process, request))
    act(() => result.current.start())
    await flush()
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(result.current.state).toMatchObject({ phase: 'error', error: { message: 'Could not connect to server', isUserFacing: false } })
    const calls = vi.mocked(processStatus).mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(vi.mocked(processStatus).mock.calls.length).toBe(calls)
  })

  it('retries with the original record selection (#658)', async () => {
    vi.mocked(processInit)
      .mockResolvedValueOnce({ type: 'ERROR', processUUID: 'run-1', error: 'warming up', userFacingError: 'warming up' })
      .mockResolvedValueOnce({ type: 'COMPLETE', processUUID: 'run-2', values: {}, nextStep: 'choose' })
    const { result } = renderHook(() => useProcess('lab', process, request))
    act(() => result.current.start())
    await flush()
    expect(result.current.state).toMatchObject({ phase: 'error', error: { message: 'warming up', isUserFacing: true } })
    act(() => result.current.start())
    await flush()
    expect(processInit).toHaveBeenNthCalledWith(2, 'lab', request)
    expect(result.current.state).toMatchObject({ phase: 'step', processUUID: 'run-2' })
  })

  it('replaces the step list and applies updated fields from the adjustment (#662)', async () => {
    vi.mocked(processInit).mockResolvedValue({
      type: 'COMPLETE', processUUID: 'run-1', values: {}, nextStep: 'choose',
      processMetaDataAdjustment: {
        updatedFrontendStepList: [process.frontendSteps[0], process.frontendSteps[2]],
        updatedFields: { detail: { ...process.frontendSteps[0].formFields![0], label: 'Long Detail', isRequired: true } },
      },
    })
    const { result } = renderHook(() => useProcess('lab', process, request))
    act(() => result.current.start())
    await flush()
    expect(result.current.state.steps.map((step) => step.name)).toEqual(['choose', 'done'])
    expect(result.current.state.currentStep?.formFields?.[0]).toMatchObject({ label: 'Long Detail', isRequired: true })
  })

  it('reports an unknown next step', async () => {
    vi.mocked(processInit).mockResolvedValue({ type: 'COMPLETE', processUUID: 'run-1', values: {}, nextStep: 'nowhere' })
    const { result } = renderHook(() => useProcess('lab', process, request))
    act(() => result.current.start())
    await flush()
    expect(result.current.state).toMatchObject({ phase: 'error', error: { message: 'Unknown process step nowhere.' } })
  })

  it('completes without a next step and cancels through the backend', async () => {
    vi.mocked(processInit).mockResolvedValue({ type: 'COMPLETE', processUUID: 'run-1', values: {}, nextStep: 'choose' })
    vi.mocked(processCancel).mockResolvedValue(true)
    const { result } = renderHook(() => useProcess('lab', process, request))
    act(() => result.current.start())
    await flush()
    await act(async () => { await result.current.cancel() })
    expect(processCancel).toHaveBeenCalledWith('lab', 'run-1')
    expect(result.current.state.phase).toBe('cancelled')
  })
})

describe('applyUpdatedFields', () => {
  it('patches form, view and record-list fields by name', () => {
    const field = process.frontendSteps[0].formFields![0]
    const steps = [{ ...process.frontendSteps[0], viewFields: [field], recordListFields: [field] }]
    const [patched] = applyUpdatedFields(steps, { detail: { ...field, label: 'Renamed' } })
    expect([patched.formFields![0].label, patched.viewFields![0].label, patched.recordListFields![0].label]).toEqual(['Renamed', 'Renamed', 'Renamed'])
    expect(applyUpdatedFields(steps, {})).toBe(steps)
  })
})
