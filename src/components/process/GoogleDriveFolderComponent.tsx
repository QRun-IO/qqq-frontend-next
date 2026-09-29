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
 * @file GoogleDriveFolderComponent — renders a GOOGLE_DRIVE_SELECT_FOLDER process
 * component. The Google Picker needs an OAuth client (`GOOGLE_APP_CLIENT_ID` and
 * `GOOGLE_APP_API_KEY` environment values) and a Google account; this component
 * reports the selected folder through the `googleDriveAccessToken`,
 * `googleDriveFolderId` and `googleDriveFolderName` values like the Material
 * dashboard, and explains when the picker is not configured. The other
 * components on the screen keep working either way.
 */

'use client'

import React, { useEffect, useRef, useState } from 'react'
import { FolderOpen } from 'lucide-react'

import { loadGoogleDriveApi } from '@/lib/google-drive-picker'
import type { DrivePicker, GoogleDriveApi } from '@/lib/google-drive-picker'

import { useProcessStep, useSubmitContributor } from './ProcessStepContext'

/** Props for {@link GoogleDriveFolderComponent}. */
export interface GoogleDriveFolderComponentProps {
  index: number
}

/**
 * Render a GOOGLE_DRIVE_SELECT_FOLDER component.
 * @param props - {@link GoogleDriveFolderComponentProps}
 * @returns The folder picker panel.
 */
export function GoogleDriveFolderComponent({ index }: GoogleDriveFolderComponentProps) {
  const { instance, values, isWorking } = useProcessStep()
  const clientId = instance?.environmentValues?.GOOGLE_APP_CLIENT_ID?.trim()
  const apiKey = instance?.environmentValues?.GOOGLE_APP_API_KEY?.trim()
  const configured = Boolean(clientId && apiKey)
  const [selection, setSelection] = useState({
    googleDriveAccessToken: typeof values.googleDriveAccessToken === 'string' ? values.googleDriveAccessToken : '',
    googleDriveFolderId: typeof values.googleDriveFolderId === 'string' ? values.googleDriveFolderId : '',
    googleDriveFolderName: typeof values.googleDriveFolderName === 'string' ? values.googleDriveFolderName : '',
  })
  const [api, setApi] = useState<GoogleDriveApi>()
  const [loading, setLoading] = useState(configured)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const generation = useRef(0)
  const picker = useRef<DrivePicker | null>(null)
  const expiresAt = useRef<number | null>(null)
  const folderName = selection.googleDriveFolderName

  useEffect(() => {
    const current = ++generation.current
    if (configured) {
      loadGoogleDriveApi().then((loaded) => {
        if (generation.current === current) { setApi(loaded); setLoading(false) }
      }).catch(() => {
        if (generation.current === current) {
          setError('Google Drive could not be loaded. Please try again.')
          setLoading(false)
        }
      })
    }
    return () => { generation.current = current + 1; picker.current?.dispose(); picker.current = null }
  }, [configured, clientId, apiKey, loadAttempt])

  /** Remove credentials together with the folder they authorize. */
  function clearSelection() {
    expiresAt.current = null
    setSelection({ googleDriveAccessToken: '', googleDriveFolderId: '', googleDriveFolderName: '' })
  }

  useSubmitContributor(`googleDrive-${index}`, () => {
    if (busy) return { maySubmit: false }
    if (selection.googleDriveFolderId && (expiresAt.current === null || Date.now() >= expiresAt.current)) {
      const unknownExpiry = expiresAt.current === null
      clearSelection()
      setError(unknownExpiry
        ? 'Google Drive authorization must be renewed. Please select the folder again.'
        : 'Google Drive authorization expired. Please select the folder again.')
      return { maySubmit: false }
    }
    return { maySubmit: true, values: selection }
  })

  /** Request authorization synchronously from the folder button click. */
  function selectFolder() {
    if (!clientId || !apiKey || busy || isWorking) return
    setError('')
    if (!api) { setLoading(true); setLoadAttempt((attempt) => attempt + 1); return }
    const current = generation.current
    const isCurrent = () => current === generation.current
    const fail = (message: string) => {
      if (!isCurrent()) return
      picker.current?.dispose()
      picker.current = null
      clearSelection()
      setBusy(false)
      setError(message)
    }
    setBusy(true)
    try {
      api.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive',
        error_callback: ({ type }) => fail(type === 'popup_closed'
          ? 'Google sign-in was cancelled. Please try again.'
          : 'Google sign-in could not open. Allow popups and try again.'),
        callback: (token) => {
          if (!isCurrent()) return
          if (token.error || !token.access_token) { fail('Google Drive authorization failed. Please try again.'); return }
          if (!token.scope?.split(/\s+/).includes('https://www.googleapis.com/auth/drive')) {
            fail('You must allow access to Google Drive after you sign in. Please try again.'); return
          }
          if (!token.expires_in || !Number.isFinite(Number(token.expires_in)) || Number(token.expires_in) <= 0) {
            fail('Google Drive authorization expired. Please try again.'); return
          }
          const accessToken = token.access_token
          const expiration = Date.now() + Number(token.expires_in) * 1000
          try {
            const view = new api.picker.DocsView(api.picker.ViewId.FOLDERS)
              .setEnableDrives(true).setIncludeFolders(true).setSelectFolderEnabled(true).setMode(api.picker.DocsViewMode.LIST)
            picker.current = new api.picker.PickerBuilder().addView(view)
              .setOAuthToken(accessToken).setDeveloperKey(apiKey).setOrigin(window.location.origin)
              .enableFeature(api.picker.Feature.SUPPORT_DRIVES)
              .setCallback((response) => {
                if (!isCurrent() || !['picked', 'cancel'].includes(response.action)) return
                picker.current?.dispose()
                picker.current = null
                setBusy(false)
                clearSelection()
                if (response.action === 'cancel') return
                const folder = response.docs?.[0]
                if (response.docs?.length !== 1 || folder?.mimeType !== 'application/vnd.google-apps.folder' || !folder.id || !folder.name) {
                  setError('You selected a file, but a folder is required.'); return
                }
                expiresAt.current = expiration
                setSelection({ googleDriveAccessToken: accessToken, googleDriveFolderId: folder.id, googleDriveFolderName: folder.name })
              }).build()
            picker.current.setVisible(true)
          } catch { fail('Google Drive could not open. Please try again.') }
        },
      }).requestAccessToken()
    } catch { fail('Google sign-in could not open. Allow popups and try again.') }
  }

  return (
    <section aria-label="Google Drive folder" className="rounded-xl border border-border p-4 text-sm" data-qqq-id={`process-google-drive-${index}`}>
      <button
        type="button"
        disabled={!configured || loading || busy || isWorking}
        onClick={selectFolder}
        aria-describedby={`process-google-drive-note-${index}`}
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 font-medium text-foreground disabled:opacity-60"
        data-qqq-id="button-google-drive-select-folder"
      >
        <FolderOpen className="h-4 w-4" aria-hidden="true" />
        Select Google Drive Folder
      </button>
      <p id={`process-google-drive-note-${index}`} className="mt-2 text-muted-foreground" data-qqq-id="process-google-drive-note">
        {configured
          ? loading ? 'Loading Google Drive…' : busy ? 'Complete your selection in Google Drive.' : 'Choose a folder in a shared drive.'
          : 'Google Drive folder selection is not configured for this application.'}
        {folderName && <span className="block text-foreground">{`Selected folder: ${folderName}`}</span>}
      </p>
      {error && <p role="alert" className="mt-2 text-destructive" data-qqq-id="process-google-drive-error">{error}</p>}
    </section>
  )
}
