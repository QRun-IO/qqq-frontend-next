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
 * @file FilterValuePaster — Material's "Bulk Add Filter Values" dialog for "is any of" / "is
 * none of" criteria: paste values from a spreadsheet, pick or detect the separator, review each
 * value (numbers checked, possible values looked up by label), see the counts, and add the valid
 * ones. The instance can add help text in the `bulkAddFilterValues` (or, for possible values,
 * `bulkAddFilterValuesPossibleValueSource`) slot.
 */

'use client'

import React, { useEffect, useId, useMemo, useState } from 'react'
import { ClipboardPaste, Loader2, AlertCircle } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import { fetchTablePossibleValues } from '@/lib/api/possible-values'
import { useFilterSettings } from '@/lib/context/filter-settings-context'
import { selectHelpContent, QUERY_SCREEN_HELP_ROLES } from '@/lib/utils/help-utils'
import {
  PASTE_SEPARATORS,
  detectSeparator,
  invalidPastedValuesMessage,
  pastedValuesSummary,
  splitPastedValues,
  type PasteSeparator,
} from '@/lib/utils/filter-paste-utils'

import { HelpContent } from '@/components/records/HelpContent'

/** How pasted values are checked. */
export type PasterKind = 'text' | 'number' | 'pvs'

/** Possible values are looked up in batches of this many labels. */
const LABEL_BATCH_SIZE = 250

/**
 * Props for FilterValuePaster.
 */
interface FilterValuePasterProps {
  /** How values are checked. */
  kind: PasterKind
  /** Field label (for the button's name). */
  fieldLabel: string
  /** Table that owns the field (possible-value lookups). */
  tableName: string
  /** Field name within its table (possible-value lookups). */
  fieldName: string
  /** Receives the values to add (possible values as their ids). */
  onAdd: (values: string[]) => void
  /** data-qqq-id prefix. */
  dataId: string
}

/** One reviewed value. */
interface ReviewedValue {
  /** The pasted text. */
  text: string
  /** Whether it can be added. */
  valid: boolean
  /** Possible-value id, for possible values. */
  id?: string
}

/**
 * Looks pasted labels up in a field's possible values (case-insensitive exact matches).
 *
 * @param tableName - Table that owns the field.
 * @param fieldName - The field.
 * @param labels - Distinct pasted labels.
 * @returns Each matched label (lower case) mapped to its id.
 */
async function lookUpLabels(tableName: string, fieldName: string, labels: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>()
  for (let i = 0; i < labels.length; i += LABEL_BATCH_SIZE) {
    const batch = labels.slice(i, i + LABEL_BATCH_SIZE)
    const options = await fetchTablePossibleValues(tableName, fieldName, { labelList: batch, useCase: 'filter' })
    for (const option of options) {
      const key = option.label.toLowerCase()
      if (!found.has(key)) found.set(key, String(option.id))
    }
  }
  return found
}

/**
 * The paste button and the "Bulk Add Filter Values" dialog.
 *
 * @param root0 - Component properties.
 * @returns The button and dialog.
 */
export function FilterValuePaster({ kind, fieldLabel, tableName, fieldName, onAdd, dataId }: FilterValuePasterProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [separator, setSeparator] = useState<PasteSeparator>('Detect Automatically')
  const [custom, setCustom] = useState('')
  const [lookup, setLookup] = useState<{ key: string; found: Map<string, string> } | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const { helpContents } = useFilterSettings()
  const textId = useId()
  const separatorId = useId()
  const customId = useId()

  const values = useMemo(() => splitPastedValues(text, separator, custom), [text, separator, custom])
  const distinct = useMemo(() => [...new Set(values)], [values])
  const lookupKey = kind === 'pvs' ? JSON.stringify(distinct) : ''

  // possible values: look the pasted labels up (debounced, as Material does)
  useEffect(() => {
    if (kind !== 'pvs' || !open || distinct.length === 0) return
    let cancelled = false
    const timer = setTimeout(() => {
      lookUpLabels(tableName, fieldName, distinct)
        .then((found) => { if (!cancelled) { setLookupError(null); setLookup({ key: lookupKey, found }) } })
        .catch((e: unknown) => { if (!cancelled) setLookupError(e instanceof Error ? e.message : String(e)) })
    }, 500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [kind, open, distinct, lookupKey, tableName, fieldName])

  const loading = kind === 'pvs' && distinct.length > 0 && lookup?.key !== lookupKey && !lookupError
  const reviewed: ReviewedValue[] = values.map((value) => {
    if (kind === 'number') return { text: value, valid: value !== '' && Number.isFinite(Number(value)) }
    if (kind === 'pvs') {
      const id = lookup?.key === lookupKey ? lookup.found.get(value.toLowerCase()) : undefined
      return { text: value, valid: id !== undefined, id }
    }
    return { text: value, valid: true }
  })
  const invalidCount = loading ? 0 : reviewed.filter((v) => !v.valid).length
  const error = lookupError ?? invalidPastedValuesMessage(invalidCount, kind === 'number' ? 'number' : 'pvs')
  const addable = [...new Set(reviewed.filter((v) => v.valid).map((v) => (kind === 'pvs' ? v.id! : v.text)))]
  const slot = kind === 'pvs' ? 'bulkAddFilterValuesPossibleValueSource' : 'bulkAddFilterValues'
  const help = selectHelpContent(helpContents?.[slot], QUERY_SCREEN_HELP_ROLES)

  const reset = () => {
    setText('')
    setSeparator('Detect Automatically')
    setCustom('')
    setLookup(null)
    setLookupError(null)
  }
  const close = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }
  const add = () => {
    onAdd(addable)
    close(false)
  }

  const fieldClass = 'w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring'
  return (
    <DialogPrimitive.Root open={open} onOpenChange={close}>
      <DialogPrimitive.Trigger asChild>
        <button type="button" aria-label={`Bulk add filter values for ${fieldLabel}`}
          title="Quickly add many values to your filter by pasting them from a spreadsheet or any other data source."
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          data-qqq-id={`${dataId}-paste`}>
          <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[400] bg-black/40" />
        <DialogPrimitive.Content aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[401] flex max-h-[90dvh] w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg focus:outline-none"
          data-qqq-id="filter-paster-dialog">
          <div>
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">Bulk Add Filter Values</DialogPrimitive.Title>
            {help && <HelpContent helpContent={help} className="mt-1 text-sm text-muted-foreground" data-qqq-id="filter-paster-help" />}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={textId} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paste text</label>
              <textarea id={textId} value={text} onChange={(e) => setText(e.target.value)} rows={10}
                className={`${fieldClass} min-h-[10rem] font-mono`} data-qqq-id="filter-paster-text" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" id={`${textId}-review`}>Filter values review</span>
              <ul aria-labelledby={`${textId}-review`} className="flex min-h-[10rem] flex-wrap content-start gap-1 overflow-y-auto rounded border border-input bg-background p-2"
                data-qqq-id="filter-paster-review">
                {reviewed.map((value, i) => (
                  <li key={`${value.text}-${i}`}
                    className={`rounded px-1.5 py-0.5 text-xs ${loading ? 'bg-muted text-muted-foreground' : value.valid ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive line-through'}`}
                    data-qqq-id="filter-paster-value" data-valid={loading ? undefined : String(value.valid)}>
                    {value.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor={separatorId} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Separator</label>
                <select id={separatorId} value={separator} onChange={(e) => setSeparator(e.target.value as PasteSeparator)} className={fieldClass}
                  data-qqq-id="filter-paster-separator">
                  {PASTE_SEPARATORS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              {separator === 'Custom' && (
                <div className="flex flex-col gap-1">
                  <label htmlFor={customId} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custom separator</label>
                  <input id={customId} value={custom} maxLength={1} onChange={(e) => setCustom(e.target.value)} className={`${fieldClass} w-24`}
                    data-qqq-id="filter-paster-custom" />
                </div>
              )}
              {text && separator === 'Detect Automatically' && (
                <span className="pb-2 text-sm italic text-muted-foreground" data-qqq-id="filter-paster-detected">{detectSeparator(text)} Detected</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {loading && (
                <span className="flex items-center gap-1 text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading...</span>
              )}
              {error && values.length > 0 && (
                <span className="flex items-center gap-1 text-destructive" role="alert" data-qqq-id="filter-paster-error">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" /> {error}
                </span>
              )}
              {values.length > 0 && <span className="font-medium text-foreground" data-qqq-id="filter-paster-count">{pastedValuesSummary(values)}</span>}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <button type="button" className="rounded border border-input px-3 py-1.5 text-sm hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
                data-qqq-id="filter-paster-cancel">Cancel</button>
            </DialogPrimitive.Close>
            <button type="button" onClick={add} disabled={loading || addable.length === 0}
              className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              data-qqq-id="filter-paster-add">Add Values</button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
