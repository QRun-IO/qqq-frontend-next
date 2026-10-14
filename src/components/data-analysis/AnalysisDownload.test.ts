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

import { afterEach, expect, it, vi } from 'vitest'
import { chartPng, downloadAnalysisFile } from '@/lib/utils/analysis-download'
import { deliverRecordFieldFile } from '@/lib/utils/record-download'
vi.mock('@/lib/utils/record-download')
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
it('draws an SVG onto a high-resolution canvas and releases its temporary URL', async () => {
  const create = vi.fn(() => 'blob:chart'),
    revoke = vi.fn()
  Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
  const png = new Blob(['png'], { type: 'image/png' })
  const context = { scale: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback
  ) {
    expect(this.width).toBe(640)
    expect(this.height).toBe(320)
    callback(png)
  })
  vi.stubGlobal(
    'Image',
    class {
      onload?: () => void
      set src(_value: string) {
        this.onload?.()
      }
    }
  )
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ width: 320, height: 160 } as DOMRect)
  expect(await chartPng(svg)).toBe(png)
  expect(context.scale).toHaveBeenCalledWith(2, 2)
  expect(context.drawImage).toHaveBeenCalled()
  expect(revoke).toHaveBeenCalledWith('blob:chart')
})
it('cleans up after an image decode error', async () => {
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:bad'), revokeObjectURL: vi.fn() })
  vi.stubGlobal(
    'Image',
    class {
      onerror?: () => void
      set src(_value: string) {
        this.onerror?.()
      }
    }
  )
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ width: 320, height: 160 } as DOMRect)
  await expect(chartPng(svg)).rejects.toThrow('Could not render')
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:bad')
})
it('delivers files using the application helper and revokes the object URL later', () => {
  vi.useFakeTimers()
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:file'), revokeObjectURL: vi.fn() })
  downloadAnalysisFile(new Blob(['csv']), 'analysis.csv')
  expect(deliverRecordFieldFile).toHaveBeenCalledWith({
    url: 'blob:file',
    fileName: 'analysis.csv',
    mode: 'download',
  })
  expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  vi.runAllTimers()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:file')
})
