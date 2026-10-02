/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { describe, expect, it } from 'vitest'
import { expectedMissingExtensionFailure } from '../specs/widgets/missing-extension'

const missing = {
  url: 'http://127.0.0.1:46487/missing-extension.js', method: 'GET',
  resourceType: 'script', status: 404, errorText: 'NS_ERROR_DOM_NETWORK_ERR',
}

describe('the deliberate missing extension', () => {
  it('recognizes the failed script only with its observed 404', () => {
    expect(expectedMissingExtensionFailure(missing)).toBe(true)
  })

  it.each([
    { status: undefined }, { status: 200 }, { status: 403 }, { status: 500 },
    { url: 'http://127.0.0.1:46487/owned-extension.js' },
    { url: 'https://example.com/missing-extension.js' },
    { url: 'http://127.0.0.1:46487/missing-extension.js?unexpected=1' },
    { method: 'POST' }, { resourceType: 'fetch' },
    { errorText: 'NS_ERROR_CONNECTION_REFUSED' },
  ])('keeps an unrelated or unproven failure actionable: %j', (changed) => {
    expect(expectedMissingExtensionFailure({ ...missing, ...changed })).toBe(false)
  })
})
