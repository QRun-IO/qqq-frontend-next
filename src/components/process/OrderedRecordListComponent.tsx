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

/** @file Optional native record-list ordering, with bounded complete-set loading. */
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { QFrontendComponent, QRecord } from '@/types'
import { processRecords } from '@/lib/api/processes'
import { isRestricted } from '@/lib/utils/secured-data'
import { recordCellText } from './RecordListComponent'
import { useProcessStep, useSubmitContributor } from './ProcessStepContext'

/** Render a metadata-enabled ordering list; ordinary record lists stay unchanged.
 * @param props - Component metadata and index.
 * @returns Accessible up/down controls and submit contribution.
 */
export function OrderedRecordListComponent({ component, index }: { component: QFrontendComponent; index: number }) {
  const { step, processName, processUUID, tableVariant, isWorking } = useProcessStep()
  const [ordered, setOrdered] = useState<{ scope: string; records: QRecord[] } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const orderField = component.values?.orderFieldName
  const identityField = component.values?.identityFieldName
  const valid = typeof orderField === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(orderField) &&
    typeof identityField === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(identityField)
  const scope = JSON.stringify([processName, processUUID, step.name, tableVariant, identityField])
  const fields = (step.recordListFields ?? []).filter((field) => !field.isHidden && !isRestricted(field))
  const query = useQuery({
    queryKey: ['qqq', 'processOrderRecords', processName, processUUID, step.name, tableVariant, identityField],
    enabled: valid && Boolean(processUUID), retry: false, staleTime: Infinity, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const records: QRecord[] = []
      let total = 1
      while (records.length < total) {
        signal.throwIfAborted()
        const page = await processRecords(processName, processUUID!, records.length, 100, tableVariant)
        signal.throwIfAborted()
        if (!Number.isInteger(page.totalRecords) || page.totalRecords < 1 || page.totalRecords > 5000 ||
          (records.length > 0 && page.totalRecords !== total) || page.records.length === 0 || page.records.length > 100) {
          throw new Error('The complete ordering list is unavailable or exceeds 5,000 records.')
        }
        total = page.totalRecords
        records.push(...page.records)
      }
      const ids = records.map((record) => record.values?.[identityField as string])
      if (records.length !== total || ids.some((id) => typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== total) {
        throw new Error('The ordering list contains invalid or duplicate identities.')
      }
      return records
    },
  })
  const records = ordered?.scope === scope ? ordered.records : query.data ?? []
  const ready = valid && query.isSuccess && records.length > 0 && !isWorking
  useSubmitContributor('record-order-' + index, () => ({
    maySubmit: ready,
    values: ready ? { [orderField as string]: records.map((record) => record.values?.[identityField as string]).join(',') } : undefined,
  }))
  /** Move exactly one row, preserving its stable identity and keyboard focus.
   * @param position - Current row position.
   * @param direction - Adjacent movement.
   * @returns Nothing.
   */
  const move = (position: number, direction: -1 | 1): void => {
    const next = [...records]
    const target = position + direction
    if (!ready || target < 0 || target >= next.length) return
    ;[next[position], next[target]] = [next[target], next[position]]
    setOrdered({ scope, records: next })
    setAnnouncement('Moved to position ' + (target + 1) + ' of ' + next.length + '.')
  }
  if (!valid) return <p role="alert">This ordering control is not configured correctly.</p>
  if (query.isError) return <div role="alert"><p>{query.error.message}</p><button type="button" data-qqq-id="record-order-retry" onClick={() => { setOrdered(null); void query.refetch() }}>Retry loading</button></div>
  if (!query.isSuccess) return <p role="status">Loading the complete list for ordering…</p>
  return <section aria-label="Record order" data-qqq-id="record-order">
    <p className="text-sm text-muted-foreground">Use Move up and Move down to set the order, then submit.</p>
    <p role="status" className="sr-only">{announcement}</p>
    <ol className="space-y-2">
      {records.map((record, position) => {
        const label = fields.map((field) => recordCellText(record, field)).filter((value) => value !== '—').join(' — ') || 'Record'
        return <li key={String(record.values?.[identityField as string])} className="flex flex-wrap items-center gap-3 rounded border p-3">
          <span className="min-w-0 flex-1 break-words">{position + 1}. {label}</span>
          <button type="button" className="min-h-11 rounded border px-3" disabled={!ready || position === 0} aria-label={'Move ' + label + ' up'} data-qqq-id="record-order-up" onClick={() => move(position, -1)}>Move up</button>
          <button type="button" className="min-h-11 rounded border px-3" disabled={!ready || position === records.length - 1} aria-label={'Move ' + label + ' down'} data-qqq-id="record-order-down" onClick={() => move(position, 1)}>Move down</button>
        </li>
      })}
    </ol>
  </section>
}
