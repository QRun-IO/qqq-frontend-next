/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */
import { describe, expect, it } from 'vitest'
import { interruptedLegacyFont } from './font-diagnostics'

const url = 'http://127.0.0.1:18861/fonts/material-icons/MaterialIcons-Regular.ttf'
const text = `[JavaScript Error: "downloadable font: download failed (font-family: "QQQ Legacy Material Icons" style:normal weight:400 stretch:100 src index:0): status=2152398850 source: ${url}"]`
const aborted = { url, at: 1100, document: 1, outcome: 'NS_BINDING_ABORTED' }
const context = { text, at: 1105, origin: 'http://127.0.0.1:18861', currentDocument: 2, navigations: [1050], requests: [aborted] }

describe('legacy font cancellation evidence', () => {
  it('matches a same-origin font cancellation from a superseded document near navigation', () => {
    expect(interruptedLegacyFont(context)).toBe(url)
  })
  it('recognizes the exact font-loader cancellation after successful transport in the old document', () => {
    expect(interruptedLegacyFont({ ...context, requests: [{ ...aborted, outcome: 'HTTP 200' }] })).toBe(url)
  })
  it.each([
    { text: text.replace('2152398850', '2152398851') },
    { origin: 'https://unrelated.invalid' },
    { currentDocument: 1 },
    { navigations: [4000] },
    { requests: [] },
    { requests: [{ ...aborted, outcome: 'HTTP 404' }] },
    { requests: [{ ...aborted, at: 9000 }] },
  ])('retains unexplained errors: %j', (change) => {
    expect(interruptedLegacyFont({ ...context, ...change })).toBeNull()
  })
})
