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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ProcessDownloadStep } from './ProcessDownloadStep'

const defaults = vi.hoisted(() => ({ baseURL: 'https://sample.invalid/prefix/qqq/v1/' }))
vi.mock('@/lib/api/client', () => ({ default: { getInstance: () => ({ defaults }) } }))

const props = {
  step: { name: 'download', label: 'Download', components: [] },
  isLoading: false,
  onSubmit: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn(),
  canGoBack: false,
  isLastStep: true,
}

describe('ProcessDownloadStep download contract', () => {
  beforeEach(() => {
    defaults.baseURL = 'https://sample.invalid/prefix/qqq/v1/'
  })

  it('uses the registered download route with an encoded server path and filename', () => {
    render(<ProcessDownloadStep {...props} stepValues={{ serverFilePath: '/tmp/report & #1.csv', downloadFileName: 'Report / é.csv' }} />)
    const link = screen.getByRole('link')
    const url = new URL(link.getAttribute('href')!)
    expect(url.origin).toBe('https://sample.invalid')
    expect(url.pathname).toBe('/prefix/download/Report%20%2F%20%C3%A9.csv')
    expect(url.searchParams.get('filePath')).toBe('/tmp/report & #1.csv')
    expect(link).toHaveAttribute('download', 'Report / é.csv')
  })

  it('supports stored report references with the configured application prefix', () => {
    render(<ProcessDownloadStep {...props} stepValues={{ storageTableName: 'report files', storageReference: '2026/report?one&two.csv', downloadFileName: 'Report.csv' }} />)
    const url = new URL(screen.getByRole('link').getAttribute('href')!)
    expect(url.pathname).toBe('/prefix/download/Report.csv')
    expect(url.searchParams.get('storageTableName')).toBe('report files')
    expect(url.searchParams.get('storageReference')).toBe('2026/report?one&two.csv')
    expect(Array.from(url.searchParams.keys())).toEqual(['storageTableName', 'storageReference'])
  })

  it('uses the same-origin route for the default API configuration', () => {
    defaults.baseURL = '/qqq/v1'
    render(<ProcessDownloadStep {...props} stepValues={{ serverFilePath: '/tmp/report.csv' }} />)
    expect(screen.getByRole('link').getAttribute('href')).toBe('/download/download?filePath=%2Ftmp%2Freport.csv')
  })

  it.each(['javascript:alert(1)', 'data:text/html,owned', 'file:///tmp/owned'])('rejects unsafe download URL %s', (downloadUrl) => {
    render(<ProcessDownloadStep {...props} stepValues={{ downloadUrl }} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('retains an explicit HTTPS download URL', () => {
    render(<ProcessDownloadStep {...props} stepValues={{ downloadUrl: 'https://files.invalid/report.csv' }} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://files.invalid/report.csv')
  })
})
