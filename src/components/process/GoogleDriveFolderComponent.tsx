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

import React from 'react'
import { FolderOpen } from 'lucide-react'

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
  const { instance, values } = useProcessStep()
  const clientId = instance?.environmentValues?.GOOGLE_APP_CLIENT_ID
  const apiKey = instance?.environmentValues?.GOOGLE_APP_API_KEY
  const configured = Boolean(clientId && apiKey)
  const folderName = typeof values.googleDriveFolderName === 'string' ? values.googleDriveFolderName : ''

  useSubmitContributor(`googleDrive-${index}`, () => ({
    maySubmit: true,
    values: {
      googleDriveAccessToken: typeof values.googleDriveAccessToken === 'string' ? values.googleDriveAccessToken : '',
      googleDriveFolderId: typeof values.googleDriveFolderId === 'string' ? values.googleDriveFolderId : '',
      googleDriveFolderName: folderName,
    },
  }))

  return (
    <section aria-label="Google Drive folder" className="rounded-xl border border-border p-4 text-sm" data-qqq-id={`process-google-drive-${index}`}>
      <button
        type="button"
        disabled
        aria-describedby={`process-google-drive-note-${index}`}
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 font-medium text-foreground disabled:opacity-60"
        data-qqq-id="button-google-drive-select-folder"
      >
        <FolderOpen className="h-4 w-4" aria-hidden="true" />
        Select Google Drive Folder
      </button>
      <p id={`process-google-drive-note-${index}`} className="mt-2 text-muted-foreground" data-qqq-id="process-google-drive-note">
        {configured
          ? 'Selecting a Google Drive folder is not available in this browser yet.'
          : 'Google Drive folder selection is not configured for this application.'}
        {folderName && <span className="block text-foreground">{`Selected folder: ${folderName}`}</span>}
      </p>
    </section>
  )
}
