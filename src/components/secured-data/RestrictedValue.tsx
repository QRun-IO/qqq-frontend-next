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

/** @file Restricted values shared by records, grids and related lists. */
'use client'
import type { QFieldMetaData, QRecord, QTableMetaData } from '@/types'
import { countdownText, remainingSeconds, securedValueKey } from '@/lib/utils/secured-data'
import { useSecuredData } from './SecuredDataProvider'
import { MaskedValue } from './MaskedValue'

/**
 * Render a mask or a currently authorized reveal, with an optional record-view action.
 * @param props - Component inputs.
 * @returns The rendered UI or current secured-data context.
 */
export function RestrictedValue({
  field,
  record,
  table,
  reveal = false,
}: {
  field: QFieldMetaData
  record: QRecord
  table?: QTableMetaData
  reveal?: boolean
}) {
  const secured = useSecuredData()
  const primaryKey = table ? record.values[table.primaryKeyField] : undefined
  const grant =
    primaryKey == null || field.accessTier !== 'REVEALABLE'
      ? undefined
      : secured.grants.find(
          (item) =>
            item.tableName === (table?.name ?? record.tableName) &&
            String(item.primaryKey) === String(primaryKey) &&
            item.fieldName === field.name &&
            remainingSeconds(item.expiresAt) > 0
        )
  const maskKey =
    typeof primaryKey === 'string' || typeof primaryKey === 'number'
      ? securedValueKey({
          tableName: table?.name ?? record.tableName,
          primaryKey,
          fieldName: field.name,
        })
      : ''
  const maskedValue = Object.prototype.hasOwnProperty.call(secured.masks, maskKey)
    ? secured.masks[maskKey]
    : (record.displayValues?.[field.name] ?? record.values[field.name])
  if (grant)
    return (
      <span
        className="inline-flex max-w-full flex-wrap items-center gap-2"
        data-qqq-id="revealed-value"
      >
        <span className="break-all">{String(grant.displayValue ?? grant.value ?? '—')}</span>
        <span
          className="font-mono text-xs text-muted-foreground"
          role="timer"
          aria-label="Reveal expires in"
        >
          {countdownText(remainingSeconds(grant.expiresAt))}
        </span>
      </span>
    )
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-2">
      <MaskedValue
        value={maskedValue}
        tier={field.accessTier === 'MASKED' ? 'MASKED' : 'REVEALABLE'}
      />
      {reveal &&
        secured.installed &&
        field.accessTier === 'REVEALABLE' &&
        (typeof primaryKey === 'string' || typeof primaryKey === 'number') && (
          <button
            type="button"
            className="min-h-9 rounded border border-input bg-background px-2 text-sm text-foreground hover:bg-accent"
            data-qqq-id={`reveal-${field.name}`}
            onClick={(event) => {
              event.stopPropagation()
              secured.request({
                tableName: table!.name,
                primaryKey,
                fieldName: field.name,
                maskedValue,
              })
            }}
          >
            Reveal
          </button>
        )}
    </span>
  )
}
