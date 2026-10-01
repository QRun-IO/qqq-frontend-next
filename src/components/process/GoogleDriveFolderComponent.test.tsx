/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { QFrontendStepMetaData, QInstance, QProcessMetaData } from '@/types'
import { ProcessStepScreen } from './ProcessStepScreen'

const scope = 'https://www.googleapis.com/auth/drive'
const step: QFrontendStepMetaData = { name: 'folder', label: 'Folder', components: [{ type: 'GOOGLE_DRIVE_SELECT_FOLDER' }] }
const steps = [step, { name: 'done', label: 'Done', components: [] }]
const process: QProcessMetaData = {
  name: 'drive', label: 'Drive', tableName: '', isHidden: false, iconName: '', hasPermission: true,
  stepFlow: 'LINEAR', minInputRecords: 0, frontendSteps: steps,
}

function renderFolder(configured = true, values: Record<string, unknown> = {}) {
  const onSubmit = vi.fn()
  const view = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ProcessStepScreen processName="drive" processMetaData={process} processUUID="run-1" step={step} steps={steps}
      instance={{ environmentValues: configured ? { GOOGLE_APP_CLIENT_ID: 'test-client', GOOGLE_APP_API_KEY: 'test-key' } : {} } as QInstance}
      values={values} backStep={null} isWorking={false} onSubmit={onSubmit} onBack={vi.fn()} onCancel={vi.fn()} onReturn={vi.fn()} />
  </QueryClientProvider>)
  return { ...view, onSubmit }
}

/** Google is the external boundary; the process form and submit contributors are real. */
function installGoogle() {
  let tokenConfig: { callback: (response: Record<string, unknown>) => void; error_callback: (error: { type: string }) => void }
  let pickerCallback: (response: Record<string, unknown>) => void
  const viewOptions: Record<string, unknown> = {}
  const dispose = vi.fn()
  const visible = vi.fn()
  const requested = vi.fn()
  const setToken = vi.fn()
  class DocsView {
    constructor(id: string) { viewOptions.id = id }
    setIncludeFolders(value: boolean) { viewOptions.includeFolders = value; return this }
    setSelectFolderEnabled(value: boolean) { viewOptions.selectFolder = value; return this }
    setEnableDrives(value: boolean) { viewOptions.sharedDrives = value; return this }
    setMode(value: string) { viewOptions.mode = value; return this }
  }
  class PickerBuilder {
    addView() { return this }
    setOAuthToken(token: string) { setToken(token); return this }
    setDeveloperKey() { return this }
    setOrigin() { return this }
    enableFeature() { return this }
    setCallback(callback: typeof pickerCallback) { pickerCallback = callback; return this }
    build() { return { setVisible: visible, dispose } }
  }
  vi.stubGlobal('google', {
    accounts: { oauth2: { initTokenClient: (config: typeof tokenConfig) => { tokenConfig = config; return { requestAccessToken: requested } } } },
    picker: { DocsView, PickerBuilder, ViewId: { FOLDERS: 'folders' }, DocsViewMode: { LIST: 'list' }, Feature: { SUPPORT_DRIVES: 'supportDrives' } },
  })
  return {
    authorize: (response: Record<string, unknown> = { access_token: 'synthetic-token', scope, expires_in: 3600 }) => act(() => tokenConfig.callback(response)),
    authError: (type: string) => act(() => tokenConfig.error_callback({ type })),
    pick: (response: Record<string, unknown>) => act(() => pickerCallback(response)),
    dispose, visible, requested, setToken, viewOptions,
  }
}

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  const button = screen.getByRole('button', { name: 'Select Google Drive Folder' })
  await waitFor(() => expect(button).toBeEnabled())
  await user.click(button)
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('configured Google Drive process folder selection', () => {
  it('submits a selected shared-drive folder through the real process form', async () => {
    const google = installGoogle()
    const user = userEvent.setup()
    const { onSubmit } = renderFolder()
    await openPicker(user)
    expect(google.requested).toHaveBeenCalledOnce()
    google.authorize()
    expect(google.viewOptions).toMatchObject({ sharedDrives: true, selectFolder: true, includeFolders: true, mode: 'list' })
    google.pick({ action: 'picked', docs: [{ id: 'folder-12', name: 'Exports', mimeType: 'application/vnd.google-apps.folder' }] })
    expect(screen.getByText('Selected folder: Exports')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ googleDriveAccessToken: 'synthetic-token', googleDriveFolderId: 'folder-12', googleDriveFolderName: 'Exports' }, undefined))
  })

  it('blocks submission while selecting and clears previous folder values on cancel', async () => {
    const google = installGoogle()
    const user = userEvent.setup()
    const { onSubmit } = renderFolder(true, { googleDriveFolderId: 'old', googleDriveFolderName: 'Old folder', googleDriveAccessToken: 'old-token' })
    await openPicker(user)
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(onSubmit).not.toHaveBeenCalled()
    google.authorize()
    google.pick({ action: 'cancel' })
    expect(screen.queryByText('Selected folder: Old folder')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ googleDriveAccessToken: '', googleDriveFolderId: '', googleDriveFolderName: '' }, undefined))
  })

  it('rejects a file and allows a subsequent folder selection', async () => {
    const google = installGoogle()
    const user = userEvent.setup()
    renderFolder()
    await openPicker(user)
    google.authorize()
    google.pick({ action: 'picked', docs: [{ id: 'file', name: 'file.csv', mimeType: 'text/csv' }] })
    expect(screen.getByRole('alert')).toHaveTextContent('folder is required')
    await openPicker(user)
    google.authorize()
    google.pick({ action: 'picked', docs: [{ id: 'folder', name: 'Recovered', mimeType: 'application/vnd.google-apps.folder' }] })
    expect(screen.getByText('Selected folder: Recovered')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each(['popup_closed', 'popup_failed_to_open'])('recovers from %s without starting a picker', async (type) => {
    const google = installGoogle()
    const user = userEvent.setup()
    renderFolder()
    await openPicker(user)
    google.authError(type)
    expect(screen.getByRole('alert')).toBeVisible()
    expect(google.visible).not.toHaveBeenCalled()
    await openPicker(user)
    expect(google.requested).toHaveBeenCalledTimes(2)
  })

  it('rejects denied Drive permission without exposing the token', async () => {
    const google = installGoogle()
    const user = userEvent.setup()
    renderFolder()
    await openPicker(user)
    google.authorize({ access_token: 'synthetic-token', scope: 'openid', expires_in: 3600 })
    expect(screen.getByRole('alert')).toHaveTextContent('allow access to Google Drive')
    expect(google.visible).not.toHaveBeenCalled()
    expect(document.body).not.toHaveTextContent('synthetic-token')
  })

  it('disposes the picker on unmount and ignores late authorization', async () => {
    const google = installGoogle()
    const user = userEvent.setup()
    const first = renderFolder()
    await openPicker(user)
    google.authorize()
    first.unmount()
    expect(google.dispose).toHaveBeenCalledOnce()
    const second = renderFolder()
    await openPicker(user)
    second.unmount()
    google.authorize()
    expect(google.visible).toHaveBeenCalledTimes(1)
  })

  it('requires fresh authorization when a previous screen selection has no known expiry', async () => {
    installGoogle()
    const user = userEvent.setup()
    const { onSubmit } = renderFolder(true, { googleDriveAccessToken: 'restored-token', googleDriveFolderId: 'restored-id', googleDriveFolderName: 'Restored folder' })
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('select the folder again'))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.queryByText('Selected folder: Restored folder')).not.toBeInTheDocument()
  })

  it('blocks an expired token on submit and asks for a new selection', async () => {
    const google = installGoogle()
    const user = userEvent.setup()
    const { onSubmit } = renderFolder()
    await openPicker(user)
    const now = Date.now()
    google.authorize({ access_token: 'synthetic-token', scope, expires_in: 1 })
    google.pick({ action: 'picked', docs: [{ id: 'folder', name: 'Expires', mimeType: 'application/vnd.google-apps.folder' }] })
    vi.spyOn(Date, 'now').mockReturnValue(now + 2000)
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('authorization expired'))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.queryByText('Selected folder: Expires')).not.toBeInTheDocument()
    expect(localStorage.getItem('googleDriveAccessToken')).toBeNull()
    expect(sessionStorage.getItem('googleDriveAccessToken')).toBeNull()
  })

  it('keeps the unconfigured control disabled and other process submission available', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFolder(false)
    expect(screen.getByRole('button', { name: 'Select Google Drive Folder' })).toBeDisabled()
    expect(screen.getByText('Google Drive folder selection is not configured for this application.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
  })
})
