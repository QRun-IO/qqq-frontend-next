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

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  default: { post: vi.fn() },
}))

describe('uploadFile', () => {
  beforeEach(() => vi.resetAllMocks())

  it('posts the file as multipart form data to /uploads and returns the ref', async () => {
    const { default: apiClient } = await import('./client')
    const { uploadFile } = await import('./uploads')
    vi.mocked(apiClient.post).mockResolvedValue({ ref: 'up_1', fileName: 'posts.csv', sizeBytes: 12, contentType: 'text/csv', expiresAt: '2026-10-21T00:00:00Z' })

    const file = new File(['Title\nHello\n'], 'posts.csv', { type: 'text/csv' })
    const ref = await uploadFile(file)

    expect(ref.ref).toBe('up_1')
    const [url, body] = vi.mocked(apiClient.post).mock.calls[0]
    expect(url).toBe('/uploads')
    expect((body as FormData).get('file')).toBeInstanceOf(File)
  })

  it('rejects a response without a ref', async () => {
    const { default: apiClient } = await import('./client')
    const { uploadFile } = await import('./uploads')
    vi.mocked(apiClient.post).mockResolvedValue({})
    await expect(uploadFile(new File(['x'], 'x.csv'))).rejects.toThrow('did not return a reference')
  })
})
