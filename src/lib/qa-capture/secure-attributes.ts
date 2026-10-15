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

/**
 * @file Marks secure field values for QA capture. Elements that render or edit a secure value
 * carry `data-jam-blur` (Jam blurs them in recordings) and `data-qqq-secure` (the selector QQQ
 * adds to Jam's blur list). The attributes are unconditional and inert when capture is off.
 *
 * A field is secure when it is a `PASSWORD` field, has the `REVEAL` adornment (API keys,
 * tokens), or is restricted by secured data (`accessTier` `MASKED` or `REVEALABLE`).
 */

import type { QFieldMetaData } from '@/types'

/** The attributes on a secure value element. */
export const SECURE_VALUE_ATTRIBUTES = { 'data-jam-blur': '', 'data-qqq-secure': '' } as const

/**
 * Whether a field's value is secure.
 *
 * @param field - Field metadata (or undefined).
 * @returns True for password, reveal and secured-data restricted fields.
 */
export function isSecureField(field: Pick<QFieldMetaData, 'type' | 'accessTier' | 'adornments'> | undefined): boolean {
  if (!field) return false
  return (
    field.type === 'PASSWORD' ||
    field.accessTier === 'MASKED' ||
    field.accessTier === 'REVEALABLE' ||
    Boolean(field.adornments?.some((adornment) => adornment.type === 'REVEAL'))
  )
}

/**
 * The secure attributes for a field's value element, or none.
 *
 * @param field - Field metadata (or undefined).
 * @returns Attributes to spread onto the element.
 */
export function secureValueAttributes(field: Pick<QFieldMetaData, 'type' | 'accessTier' | 'adornments'> | undefined): Partial<typeof SECURE_VALUE_ATTRIBUTES> {
  return isSecureField(field) ? SECURE_VALUE_ATTRIBUTES : {}
}
