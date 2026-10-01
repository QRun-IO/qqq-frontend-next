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
 * @file DownloadFormComponent — renders a DOWNLOAD_FORM process component: a
 * link to the file a step produced (`downloadFileName` with `serverFilePath`, or
 * `storageTableName` and `storageReference`), served by the process download route.
 */

'use client'

import React from 'react'
import { Download } from 'lucide-react'

import { processDownloadUrl } from '@/lib/api/processes'

import { useProcessStep } from './ProcessStepContext'

/** Props for {@link DownloadFormComponent}. */
export interface DownloadFormComponentProps {
  index: number
}

/**
 * Render a DOWNLOAD_FORM component.
 * @param props - {@link DownloadFormComponentProps}
 * @returns The download panel.
 */
export function DownloadFormComponent({ index }: DownloadFormComponentProps) {
  const { values } = useProcessStep()
  const href = processDownloadUrl(values)
  const fileName = typeof values.downloadFileName === 'string' ? values.downloadFileName : ''
  return (
    <section aria-label="Download" className="rounded-xl border border-border p-4" data-qqq-id={`process-download-form-${index}`}>
      <h4 className="mb-2 text-sm font-semibold text-foreground">Download</h4>
      {href ? (
        <a
          href={href}
          download={fileName}
          className="inline-flex items-center gap-2 font-semibold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
          data-qqq-id="link-process-download"
        >
          <Download className="h-5 w-5" aria-hidden="true" />
          {fileName}
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">No file is available to download.</p>
      )}
    </section>
  )
}
