/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => vi.resetModules())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.head.querySelectorAll('script').forEach((script) => script.remove())
})

const sdk = { accounts: { oauth2: {} }, picker: {} }

describe('Google Drive script loading', () => {
  it('lets concurrent process components use one successful SDK load', async () => {
    const { loadGoogleDriveApi } = await import('./google-drive-picker')
    const first = loadGoogleDriveApi()
    const second = loadGoogleDriveApi()
    const scripts = Array.from(document.head.querySelectorAll('script'))
    expect(scripts.map((script) => script.src)).toEqual(['https://accounts.google.com/gsi/client', 'https://apis.google.com/js/api.js'])
    vi.stubGlobal('google', sdk)
    scripts.forEach((script) => script.dispatchEvent(new Event('load')))
    expect(await first).toBe(sdk)
    expect(await second).toBe(sdk)
  })

  it('retries a failed SDK script without requiring a page reload', async () => {
    const { loadGoogleDriveApi } = await import('./google-drive-picker')
    const first = loadGoogleDriveApi()
    const failed = expect(first).rejects.toThrow('could not be loaded')
    const [identity, picker] = Array.from(document.head.querySelectorAll('script'))
    identity.dispatchEvent(new Event('error'))
    vi.stubGlobal('gapi', {})
    picker.dispatchEvent(new Event('load'))
    await failed
    const retry = loadGoogleDriveApi()
    const replacement = document.head.querySelector('script[src="https://accounts.google.com/gsi/client"]')!
    expect(replacement).not.toBe(identity)
    vi.stubGlobal('google', sdk)
    replacement.dispatchEvent(new Event('load'))
    expect(await retry).toBe(sdk)
  })

  it('fails a stalled script instead of leaving the control loading forever', async () => {
    vi.useFakeTimers()
    const { loadGoogleDriveApi } = await import('./google-drive-picker')
    const loaded = expect(loadGoogleDriveApi()).rejects.toThrow('could not be loaded')
    await vi.advanceTimersByTimeAsync(15000)
    await loaded
    expect(document.head.querySelectorAll('script')).toHaveLength(0)
  })

  it('reports picker module failure and allows a new module load', async () => {
    vi.stubGlobal('google', { accounts: sdk.accounts })
    vi.stubGlobal('gapi', { load: (_: string, options: { onerror: () => void }) => options.onerror() })
    const { loadGoogleDriveApi } = await import('./google-drive-picker')
    await expect(loadGoogleDriveApi()).rejects.toThrow('could not be loaded')
    vi.stubGlobal('gapi', { load: (_: string, options: { callback: () => void }) => { vi.stubGlobal('google', sdk); options.callback() } })
    expect(await loadGoogleDriveApi()).toBe(sdk)
  })
})
