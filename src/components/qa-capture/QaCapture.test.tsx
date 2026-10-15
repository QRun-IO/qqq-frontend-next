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

import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true },
  installed: true,
  jamImports: 0,
  initialize: vi.fn(),
  open: vi.fn(),
  push: vi.fn(),
  getCapability: vi.fn(),
  createReport: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/lib/auth/use-auth', () => ({ useAuth: () => mocks.auth }))
vi.mock('@/lib/api/ui-api-extensions', () => ({ useUiApiExtensionInstalled: (_name: string, enabled: boolean) => enabled && mocks.installed }))
vi.mock('next/navigation', () => ({ usePathname: () => '/app/person/42', useRouter: () => ({ push: mocks.push }) }))
vi.mock('sonner', () => ({ toast: { warning: mocks.toastWarning, error: mocks.toastError, success: vi.fn() } }))
vi.mock('@/lib/api/qa-capture', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/qa-capture')>()),
  getQaCaptureCapability: mocks.getCapability,
  createQaCaptureReport: mocks.createReport,
}))
vi.mock('@jam.dev/recording-links/sdk', () => {
  mocks.jamImports++
  return {
    initialize: mocks.initialize,
    isInitialized: () => false,
    loadRecorder: async () => ({ open: mocks.open }),
  }
})
vi.mock('@jam.dev/sdk', () => {
  mocks.jamImports++
  return { jam: { metadata: vi.fn() } }
})

import { normalizeQaCaptureCapability } from '@/lib/api/qa-capture'
import { queryClient } from '@/lib/query-client'
import { resetJamLoaderForTesting } from '@/lib/qa-capture/jam-loader'
import { isCollectingRequestIds, resetRequestIds } from '@/lib/qa-capture/request-ids'
import { QaCaptureLoader } from './QaCaptureLoader'
import { QaModeIndicator } from './QaModeIndicator'
import { NO_RECORDING_LINK_MESSAGE, ReportBugMenuItems } from './ReportBugMenuItems'

const ENABLED = {
  enabled: true,
  reason: 'AUDIENCE',
  provider: 'jam',
  providerConfig: { teamId: 'team-1', recordingLinkId: 'abc123' },
  qaMode: { available: true, active: false, preferenceSection: 'qa-capture' },
  canReport: true,
  reportsHref: '/app/qa_capture_report',
  sanitizer: { redaction: '[redacted]', headerNames: [], bodyFieldNames: [], queryParamNames: [], valuePatterns: [], dropPathPrefixes: [] },
  blurSelectors: [],
  requestIdHeader: 'X-Request-Id',
}

/**
 * Renders the loader with the menu items and indicator, as the app does.
 *
 * @returns The render result.
 */
function renderAll() {
  return render(
    <QueryClientProvider client={queryClient}>
      <QaCaptureLoader />
      <QaModeIndicator />
      <div role="menu">
        <ReportBugMenuItems />
      </div>
    </QueryClientProvider>
  )
}

afterEach(() => {
  queryClient.clear()
  resetJamLoaderForTesting()
  resetRequestIds()
  vi.clearAllMocks()
  mocks.auth.isAuthenticated = true
  mocks.installed = true
  mocks.jamImports = 0
  document.head.querySelectorAll('meta[name^="jam:"]').forEach((meta) => meta.remove())
})

describe('QA capture loader', () => {
  it('makes no capability call and loads no Jam when the extension is not advertised', async () => {
    mocks.installed = false
    renderAll()
    await act(async () => {})
    expect(mocks.getCapability).not.toHaveBeenCalled()
    expect(mocks.jamImports).toBe(0)
    expect(screen.queryByText('Report a bug')).not.toBeInTheDocument()
  })

  it('makes no capability call before sign-in', async () => {
    mocks.auth.isAuthenticated = false
    renderAll()
    await act(async () => {})
    expect(mocks.getCapability).not.toHaveBeenCalled()
    expect(mocks.jamImports).toBe(0)
  })

  it('loads no Jam (no chunk, no meta, no request ids) when capture is disabled for the user', async () => {
    mocks.getCapability.mockResolvedValue(normalizeQaCaptureCapability({ enabled: false, reason: 'NO_ACCESS' }))
    renderAll()
    await waitFor(() => expect(mocks.getCapability).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(mocks.jamImports).toBe(0)
    expect(mocks.initialize).not.toHaveBeenCalled()
    expect(document.head.querySelector('meta[name="jam:team"]')).toBeNull()
    expect(isCollectingRequestIds()).toBe(false)
    expect(screen.queryByText('Report a bug')).not.toBeInTheDocument()
    expect(screen.queryByText('QA mode on')).not.toBeInTheDocument()
  })

  it('initializes Jam once, collects request ids and shows the menu items when enabled', async () => {
    mocks.getCapability.mockResolvedValue(normalizeQaCaptureCapability(ENABLED))
    renderAll()
    await waitFor(() => expect(mocks.initialize).toHaveBeenCalledTimes(1))
    expect(mocks.getCapability).toHaveBeenCalledTimes(1)
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="jam:team"]')!.content).toBe('team-1')
    expect(isCollectingRequestIds()).toBe(true)
    expect(screen.getByRole('menuitem', { name: 'Report a bug' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'QA reports' })).toHaveAttribute('href', '/app/qa_capture_report')
    expect(screen.queryByText('QA mode on')).not.toBeInTheDocument()
  })

  it('refetches the capability when the QA mode preference is saved, and shows the QA mode badge', async () => {
    mocks.getCapability.mockResolvedValueOnce(normalizeQaCaptureCapability({ ...ENABLED, enabled: false, reason: 'QA_MODE_OFF' }))
    mocks.getCapability.mockResolvedValueOnce(normalizeQaCaptureCapability({ ...ENABLED, reason: 'QA_MODE', qaMode: { available: true, active: true, preferenceSection: 'qa-capture' } }))
    renderAll()
    await waitFor(() => expect(mocks.getCapability).toHaveBeenCalledTimes(1))
    expect(mocks.jamImports).toBe(0)
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['qqq', 'qa-capture', 'capability'] })
    })
    await waitFor(() => expect(screen.getAllByText('QA mode on').length).toBeGreaterThan(0))
    expect(screen.getByRole('link', { name: /QA mode on/ })).toHaveAttribute('href', '/app/preferences?section=qa-capture')
    await waitFor(() => expect(mocks.initialize).toHaveBeenCalledTimes(1))
  })
})

describe('Report a bug menu item', () => {
  it('creates the report and opens the recorder with its title and reference', async () => {
    mocks.getCapability.mockResolvedValue(normalizeQaCaptureCapability(ENABLED))
    mocks.createReport.mockResolvedValue({ id: 7, reference: 'qa-1', title: 'Bug', recordingParams: { 'jam-recording': 'abc123', 'jam-title': 'Bug', 'jam-reference': 'qa-1' } })
    renderAll()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Report a bug' }))
    await waitFor(() => expect(mocks.open).toHaveBeenCalledWith('abc123', { jamParams: { 'jam-title': 'Bug', 'jam-reference': 'qa-1' } }))
    expect(mocks.createReport).toHaveBeenCalledWith(expect.objectContaining({ pageUrl: expect.any(String), requestIds: [] }))
  })

  it('explains that an admin must set the Recording Link when none is configured', async () => {
    mocks.getCapability.mockResolvedValue(normalizeQaCaptureCapability(ENABLED))
    mocks.createReport.mockResolvedValue({ id: 8, reference: 'qa-2', title: null, recordingParams: null })
    renderAll()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Report a bug' }))
    await waitFor(() => expect(mocks.toastWarning).toHaveBeenCalled())
    const [message, options] = mocks.toastWarning.mock.calls[0]
    expect(message).toBe(NO_RECORDING_LINK_MESSAGE)
    options.action.onClick()
    expect(mocks.push).toHaveBeenCalledWith('/app/qa_capture_report')
    expect(mocks.open).not.toHaveBeenCalled()
  })

  it('reports failures in a toast and hides reporting when the user cannot report', async () => {
    mocks.getCapability.mockResolvedValue(normalizeQaCaptureCapability(ENABLED))
    mocks.createReport.mockRejectedValue(new Error('Permission denied.'))
    const { unmount } = renderAll()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Report a bug' }))
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Could not start the bug report: Permission denied.'))
    unmount()
    queryClient.clear()
    mocks.getCapability.mockResolvedValue(normalizeQaCaptureCapability({ ...ENABLED, canReport: false, reportsHref: null }))
    renderAll()
    await waitFor(() => expect(mocks.initialize).toHaveBeenCalled())
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })
})
