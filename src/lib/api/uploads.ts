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
 * @file Uploads — `POST /qqq/v1/uploads` (QRun-IO/qqq#1181): streams a file to the server's
 * uploads storage as the user and returns an opaque, user-bound {@link UploadRef}. Nothing is
 * kept in the browser beyond the ref.
 */

import apiClient from './client'

/** An uploaded file: an opaque ref bound to the session user, and its expiry. */
export interface UploadRef {
  /** Opaque ref; only its owner can use it. */
  ref: string
  fileName: string
  sizeBytes: number
  contentType: string
  /** ISO-8601 instant. */
  expiresAt: string
}

/**
 * Uploads one file.
 *
 * @param file - The file the user picked.
 * @returns Its upload ref.
 */
export async function uploadFile(file: File): Promise<UploadRef> {
  const form = new FormData()
  form.append('file', file, file.name)
  const response = await apiClient.post<UploadRef>('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  if (!response || typeof response.ref !== 'string') throw new Error('The upload did not return a reference.')
  return response
}
