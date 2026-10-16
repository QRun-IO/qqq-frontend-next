/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */
import { expect, it, vi } from 'vitest'
import apiClient from './client'
import { getEdiGuide, getEdiTarget, previewEdi, validateEdiRules } from './edi'
import spec from './openapi/extensions/edi.json'
import { ediGuide, ediPreview, ediTarget } from '../../../tests/fixtures/edi'

vi.mock('./client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

it('uses exactly the four vendored operations with typed response fixtures', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce(ediGuide).mockResolvedValueOnce(ediTarget)
  vi.mocked(apiClient.post).mockResolvedValueOnce({ rules: [] }).mockResolvedValueOnce(ediPreview)
  expect(await getEdiGuide(2)).toEqual(ediGuide)
  expect(await getEdiTarget(7)).toEqual(ediTarget)
  await validateEdiRules(7, [])
  expect(await previewEdi({ mapId: 7, sampleId: 11, ruleOverrides: [] })).toEqual(ediPreview)
  expect(apiClient.get).toHaveBeenNthCalledWith(1, '/qbit/edi/guides/2/tree')
  expect(apiClient.get).toHaveBeenNthCalledWith(2, '/qbit/edi/maps/7/target')
  expect(apiClient.post).toHaveBeenNthCalledWith(1, '/qbit/edi/maps/7/validate', { rules: [] })
  expect(apiClient.post).toHaveBeenNthCalledWith(2, '/qbit/edi/sandbox/preview', {
    mapId: 7,
    sampleId: 11,
    ruleOverrides: [],
  })
  expect(Object.keys(spec.paths)).toHaveLength(4)
  expect(spec.info.version).toBe('1.1.0')
})
