/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** @file Typed operations of the EDI 1.0.0 extension. Rule writes use core table CRUD. */
import type {
  EdiGuideTreeV1,
  EdiTargetV1,
  EdiRuleV1,
  EdiValidationV1,
  EdiPreviewRequestV1,
  EdiPreviewV1,
} from '@/types/edi'
import apiClient from './client'

const ROOT = '/qbit/edi'

/** Reads a permitted guide.
 * @param id - Guide identifier.
 * @returns Ordered guide tree.
 */
export function getEdiGuide(id: number): Promise<EdiGuideTreeV1> {
  return apiClient.get(`${ROOT}/guides/${id}/tree`)
}

/** Reads the map target and saved rules.
 * @param id - Map identifier.
 * @returns Target fields, associations and transforms.
 */
export function getEdiTarget(id: number): Promise<EdiTargetV1> {
  return apiClient.get(`${ROOT}/maps/${id}/target`)
}

/** Validates without persisting or executing transforms.
 * @param id - Map identifier.
 * @param rules - Complete unsaved rule set.
 * @returns Indexed rule errors.
 */
export function validateEdiRules(id: number, rules: EdiRuleV1[]): Promise<EdiValidationV1> {
  return apiClient.post(`${ROOT}/maps/${id}/validate`, { rules })
}

/** Runs the sandbox without target writes.
 * @param request - Sample and complete rule overrides.
 * @returns Parse, findings, acknowledgement, records and diffs.
 */
export function previewEdi(request: EdiPreviewRequestV1): Promise<EdiPreviewV1> {
  return apiClient.post(`${ROOT}/sandbox/preview`, request)
}
