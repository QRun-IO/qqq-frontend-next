/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** @file Google SDK loading and types for process folder selection. */

export interface DriveTokenResponse {
  access_token?: string
  expires_in?: number
  scope?: string
  error?: string
}

export interface DrivePickerResponse {
  action: string
  docs?: Array<{ id?: string; name?: string; mimeType?: string }>
}

export interface DrivePicker {
  setVisible: (visible: boolean) => void
  dispose: () => void
}

interface DriveDocsView {
  setIncludeFolders: (include: boolean) => DriveDocsView
  setSelectFolderEnabled: (enabled: boolean) => DriveDocsView
  setEnableDrives: (enabled: boolean) => DriveDocsView
  setMode: (mode: string) => DriveDocsView
}

interface DrivePickerBuilder {
  addView: (view: DriveDocsView) => DrivePickerBuilder
  setOAuthToken: (token: string) => DrivePickerBuilder
  setDeveloperKey: (key: string) => DrivePickerBuilder
  setOrigin: (origin: string) => DrivePickerBuilder
  enableFeature: (feature: string) => DrivePickerBuilder
  setCallback: (callback: (response: DrivePickerResponse) => void) => DrivePickerBuilder
  build: () => DrivePicker
}

/** The Google SDK surface used by process folder selection. */
export interface GoogleDriveApi {
  accounts: { oauth2: { initTokenClient: (config: {
    client_id: string
    scope: string
    callback: (response: DriveTokenResponse) => void
    error_callback: (error: { type: string }) => void
  }) => { requestAccessToken: () => void } } }
  picker: {
    DocsView: new (viewId: string) => DriveDocsView
    PickerBuilder: new () => DrivePickerBuilder
    ViewId: { FOLDERS: string }
    DocsViewMode: { LIST: string }
    Feature: { SUPPORT_DRIVES: string }
  }
}

type GoogleWindow = Window & {
  google?: Partial<GoogleDriveApi>
  gapi?: { load: (name: string, options: { callback: () => void; onerror: () => void; timeout: number; ontimeout: () => void }) => void }
}

const scripts = new Map<string, Promise<void>>()

/**
 * Load a shared SDK script, evicting failures so another click can retry.
 * @param src - Official SDK script URL.
 * @returns Completion of script loading.
 */
function loadScript(src: string): Promise<void> {
  const existing = scripts.get(src)
  if (existing) return existing
  const pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    const finish = (failed: boolean) => {
      clearTimeout(timer)
      script.onload = script.onerror = null
      if (failed) {
        scripts.delete(src)
        script.remove()
        reject(new Error('Google Drive could not be loaded. Please try again.'))
      } else resolve()
    }
    const timer = setTimeout(() => finish(true), 15000)
    script.src = src
    script.async = true
    script.onload = () => finish(false)
    script.onerror = () => finish(true)
    document.head.appendChild(script)
  })
  scripts.set(src, pending)
  return pending
}

/**
 * Load SDKs before a user click so token requests retain popup user activation.
 * @returns The loaded Google identity and picker APIs.
 */
export async function loadGoogleDriveApi(): Promise<GoogleDriveApi> {
  const browser = window as GoogleWindow
  await Promise.all([
    browser.google?.accounts ? Promise.resolve() : loadScript('https://accounts.google.com/gsi/client'),
    browser.google?.picker || browser.gapi ? Promise.resolve() : loadScript('https://apis.google.com/js/api.js'),
  ])
  if (!browser.google?.picker) {
    await new Promise<void>((resolve, reject) => {
      const failed = () => reject(new Error('Google Drive could not be loaded. Please try again.'))
      if (!browser.gapi) { failed(); return }
      browser.gapi.load('picker', { callback: resolve, onerror: failed, timeout: 15000, ontimeout: failed })
    })
  }
  if (!browser.google?.accounts?.oauth2 || !browser.google.picker) throw new Error('Google Drive could not be loaded. Please try again.')
  return browser.google as GoogleDriveApi
}
