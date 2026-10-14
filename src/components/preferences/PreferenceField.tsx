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

/** @file Preference metadata adapter for the existing form field editors. */
'use client'

import type { UseFormReturn } from 'react-hook-form'
import { LockKeyhole } from 'lucide-react'
import type { PreferenceSection } from '@/types/preferences'
import { cn } from '@/lib/utils/cn'
import { BooleanField } from '@/components/forms/field-types/BooleanField'
import { DateField } from '@/components/forms/field-types/DateField'
import { DateTimeField } from '@/components/forms/field-types/DateTimeField'
import { NumberField } from '@/components/forms/field-types/NumberField'
import { SelectField } from '@/components/forms/field-types/SelectField'
import { TextAreaField } from '@/components/forms/field-types/TextAreaField'
import { TextField } from '@/components/forms/field-types/TextField'
import { HelpContent } from '@/components/records/HelpContent'
import type { PreferenceSlot } from './preference-values'

/** Adapts a scalar or list cell without fetching possible values.
 * @param props - Slot metadata, enum sources and shared form state.
 * @returns A labelled field with help and any read-only reason.
 */
export function PreferenceField({
  slot,
  section,
  form,
  prefix,
  disabled,
  hideLabel = false,
}: {
  slot: PreferenceSlot
  section: PreferenceSection
  form: UseFormReturn<Record<string, unknown>>
  prefix: string
  disabled: boolean
  /** In a table cell the column header names the field: keep the label for assistive tech only. */
  hideLabel?: boolean
}) {
  const { field } = slot
  if (field.isHidden) return null
  const id = `${prefix}-${slot.name}`
  const help = field.helpContents?.filter((item) => item.content)
  const reason = slot.readOnly ? slot.reason || 'Read only' : undefined
  const props = {
    id,
    label: field.label,
    required: field.isRequired,
    disabled: disabled || slot.readOnly,
    registration: form.register(slot.name),
    describedBy:
      [help?.length ? `${id}-help` : '', reason ? `${id}-reason` : ''].filter(Boolean).join(' ') ||
      undefined,
    'data-qqq-id': `preferences-field-${section.name}-${slot.list ? `${slot.list}-${slot.row}-` : ''}${field.name}`,
  }
  const options = field.possibleValueSourceName
    ? (section.possibleValues[field.possibleValueSourceName] ?? [])
    : field.inlinePossibleValueSource?.enumValues
  let editor
  if (options) editor = <SelectField {...props} options={options} />
  else
    switch (field.type) {
      case 'BOOLEAN':
        editor = <BooleanField {...props} name={slot.name} control={form.control} />
        break
      case 'INTEGER':
      case 'DECIMAL':
        editor = (
          <NumberField
            {...props}
            step={field.type === 'INTEGER' ? 1 : 'any'}
            minValue={field.minValue}
            maxValue={field.maxValue}
          />
        )
        break
      case 'TEXT':
        editor = <TextAreaField {...props} maxLength={field.maxLength} />
        break
      case 'DATE':
      case 'TIME':
        editor = <DateField {...props} type={field.type === 'TIME' ? 'time' : 'date'} />
        break
      case 'DATE_TIME':
        editor = <DateTimeField {...props} />
        break
      default:
        editor = <TextField {...props} maxLength={field.maxLength} />
    }
  return (
    <div className={cn('min-w-0 space-y-1 break-words', hideLabel && '[&_label]:sr-only')}>
      {editor}
      {help && (
        <div id={`${id}-help`} className="text-xs text-muted-foreground">
          {help.map((item, i) => (
            <HelpContent key={i} helpContent={item} />
          ))}
        </div>
      )}
      {reason && (
        <p
          id={`${id}-reason`}
          className="flex items-start gap-1 text-xs text-muted-foreground"
          title={reason}
        >
          <LockKeyhole className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          {reason}
        </p>
      )}
    </div>
  )
}
