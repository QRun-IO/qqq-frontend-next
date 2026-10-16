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

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'
import { server } from '@/mocks/node'
import type { PreferenceSection } from '@/types/preferences'
import { PreferenceSectionForm } from './PreferenceSectionForm'
import { imageFileProblem, imageUploadSettings } from './ImageUploadField'

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

const PHOTO_URL = '/qqq/v1/avatars/alice?v=abc123'

const profile = (avatar: string | null): PreferenceSection => ({
  name: 'profile',
  label: 'Profile',
  icon: { name: 'account_circle' },
  description: 'Your photo and the name other people see.',
  order: 1,
  showInUserMenu: false,
  fields: [
    {
      name: 'avatar',
      isRequired: false,
      isHeavy: false,
      label: 'Photo',
      type: 'STRING',
      adornments: [
        {
          type: 'FILE_UPLOAD',
          values: { format: 'dragAndDrop', valueIsUploadRef: true, accept: 'image/png,image/jpeg,image/webp,image/gif', maxBytes: 5242880, imageShape: 'circle' },
        },
      ],
    },
    { name: 'displayName', label: 'Display name', type: 'STRING', maxLength: 100, isRequired: false, isHeavy: false, adornments: [] },
    { name: 'avatarUrl', label: 'Avatar URL', type: 'STRING', isHidden: true, isEditable: false, isRequired: false, isHeavy: false, adornments: [] },
  ] as PreferenceSection['fields'],
  values: { avatar, displayName: null, avatarUrl: avatar },
  lists: [],
  possibleValues: {},
  actions: [],
})

const renderForm = (section: PreferenceSection) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <PreferenceSectionForm section={section} />
    </QueryClientProvider>
  )

// jsdom neither decodes images nor draws: stand-ins that load a 400x300 image and crop to a blob
beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:local-photo'), revokeObjectURL: vi.fn() }))
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(400)
  vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(300)
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    set(this: HTMLImageElement, value: string) {
      this.setAttribute('src', value)
      setTimeout(() => this.onload?.(new Event('load')))
    },
    get(this: HTMLImageElement) {
      return this.getAttribute('src') ?? ''
    },
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), imageSmoothingQuality: 'low' } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })))
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('imageUploadSettings', () => {
  it('reads upload-ref image fields only, and never accepts SVG', () => {
    expect(imageUploadSettings({ format: 'button' })).toBeNull()
    expect(imageUploadSettings({ valueIsUploadRef: true, accept: 'image/png,image/svg+xml', maxBytes: 10, imageShape: 'square' })).toEqual({
      accept: ['image/png'],
      maxBytes: 10,
      shape: 'square',
    })
    expect(imageUploadSettings({ valueIsUploadRef: true })?.accept).toEqual(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
  })

  it('refuses other types and oversized files before uploading', () => {
    const settings = imageUploadSettings({ valueIsUploadRef: true, maxBytes: 1024 * 1024 })!
    expect(imageFileProblem(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }), settings)).toBe('Use a PNG, JPEG, WebP or GIF image.')
    expect(imageFileProblem(new File([new Uint8Array(2 * 1024 * 1024)], 'a.png', { type: 'image/png' }), settings)).toMatch(/too large: the limit is 1 MB/)
    expect(imageFileProblem(new File(['x'], 'a.png', { type: 'image/png' }), settings)).toBeNull()
  })
})

describe('ImageUploadField in the profile section', () => {
  it('crops, uploads, and saves the upload ref as the photo', async () => {
    const uploads: string[] = []
    const patches: unknown[] = []
    server.use(
      http.post('/qqq/v1/uploads', ({ request }) => {
        uploads.push(request.headers.get('content-type')?.split(';')[0] ?? '')
        return HttpResponse.json({ ref: 'up-1', fileName: 'photo.png', sizeBytes: 3, contentType: 'image/png', expiresAt: '2026-10-22T00:00:00Z' })
      }),
      http.patch('/qqq/v1/preferences/profile', async ({ request }) => {
        patches.push(await request.json())
        return HttpResponse.json(profile(PHOTO_URL))
      })
    )
    const { container } = renderForm(profile(null))
    const user = userEvent.setup()
    expect(screen.getByRole('button', { name: 'Choose photo' })).toBeInTheDocument()

    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File(['png'], 'me.png', { type: 'image/png' }))
    const dialog = await screen.findByRole('dialog', { name: 'Crop your photo' })
    expect(dialog).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use photo' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Use photo' }))

    await waitFor(() => expect(uploads).toEqual(['multipart/form-data']))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(patches).toEqual([{ values: { avatar: 'up-1' } }]))
    expect(await screen.findByRole('button', { name: 'Replace photo' })).toBeInTheDocument()
  })

  it('removes the photo by saving null', async () => {
    const patches: unknown[] = []
    server.use(
      http.patch('/qqq/v1/preferences/profile', async ({ request }) => {
        patches.push(await request.json())
        return HttpResponse.json(profile(null))
      })
    )
    renderForm(profile(PHOTO_URL))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(patches).toEqual([{ values: { avatar: null } }]))
  })

  it('refuses an SVG without opening the crop dialog or uploading', async () => {
    const upload = vi.fn()
    server.use(http.post('/qqq/v1/uploads', () => (upload(), HttpResponse.json({}))))
    const { container } = renderForm(profile(null))
    await userEvent.setup({ applyAccept: false }).upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File(['<svg/>'], 'evil.png', { type: 'image/svg+xml' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Use a PNG, JPEG, WebP or GIF image.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(upload).not.toHaveBeenCalled()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderForm(profile(PHOTO_URL))
    expect(await axe(container)).toHaveNoViolations()
  })
})
