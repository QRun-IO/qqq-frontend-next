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

/** @file Structured named grants and searchable membership assignments. */
'use client'

import { useEffect, useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import type { WidgetComponentProps } from '@/components/widgets/widget-types'
import { fetchPossibleValues } from '@/lib/api/possible-values'
import { PermissionMatrix } from './PermissionMatrix'
import { INPUT_CLASS, ALERT_CLASS } from '@/components/ui/controls'

const optionSchema = z.object({ id: z.string(), label: z.string() })
const fieldSchema = z.object({
  catalogWidget: z.string().optional(), name: z.string().min(1), label: z.string(), source: z.string().optional(),
  selected: z.array(optionSchema).default([]), choices: z.array(optionSchema).optional(),
  inherited: z.record(z.array(z.string())).optional(), policyPermissions: z.array(z.string()).optional(),
})
const payloadSchema = z.object({ fields: z.array(fieldSchema) })
type Field = z.infer<typeof fieldSchema>
type Option = z.infer<typeof optionSchema>

/**
 * Edit one structured field while keeping selection independent of search results.
 * @param props - Server metadata and the process value callback.
 * @returns A checkbox list and, for assignments, a server-backed search box.
 */
function AccessField({ field, onChange }: { field: Field; onChange: (values: Record<string, unknown>) => void }) {
  const [selected, setSelected] = useState<Option[]>(field.selected)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [debounced, setDebounced] = useState('')
  const id = useId()
  useEffect(() => { const timer = setTimeout(() => setDebounced(search), 250); return () => clearTimeout(timer) }, [search])
  const options = useQuery({
    queryKey: ['access-editor-options', field.source, debounced],
    queryFn: () => fetchPossibleValues(field.source!, { searchTerm: debounced, useCase: 'form' }),
    enabled: Boolean(field.source),
  })
  useEffect(() => { onChange({ [field.name]: selected.map(option => option.id).join('\n') }) }, [selected, field.name, onChange])
  const choices: Option[] = field.source
    ? (options.data ?? []).map(option => ({ id: String(option.id), label: option.label }))
    : (field.choices ?? []).filter(option => option.label.toLowerCase().includes(search.toLowerCase()))
  const selectedIds = new Set(selected.map(option => option.id))
  const displayed = [...selected, ...choices.filter(option => !selectedIds.has(option.id))].filter(option => Boolean(field.source) || option.label.toLowerCase().includes(search.toLowerCase()))
  const currentPage = Math.min(page, Math.max(0, Math.ceil(displayed.length / 25) - 1))
  return <fieldset className="space-y-3 rounded-lg border border-border p-4">
    <legend className="px-2 font-semibold">{field.label}</legend>
    <label htmlFor={id} className="block text-sm">Search {field.label.toLowerCase()}</label>
    <input id={id} data-qqq-id={'access-search-' + field.name} className={INPUT_CLASS} value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} />
    {options.isFetching && field.source && <p role="status" className="text-sm">Searching…</p>}
    {options.isError && <p role="alert" className={ALERT_CLASS}>Could not load choices. Your selections are preserved. Change the search to try again.</p>}
    <p className="text-sm text-muted-foreground">{selected.length} selected. Review validates every change before saving.</p>
    <div className="max-h-80 space-y-2 overflow-auto">
      {displayed.slice(currentPage * 25, currentPage * 25 + 25).map(option => <label key={option.id} className="flex items-start gap-2 text-sm">
        <input type="checkbox" data-qqq-id={'access-choice-' + field.name + '-' + option.id} checked={selectedIds.has(option.id)}
          onChange={event => setSelected(current => event.target.checked ? [...current, option] : current.filter(item => item.id !== option.id))} />
        <span>{option.label}</span>
      </label>)}
      {!options.isFetching && displayed.length === 0 && <p className="text-sm text-muted-foreground">No choices found.</p>}
    </div>
    {displayed.length > 25 && <div className="flex gap-4">
      <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous choices</button>
      <span>Page {currentPage + 1} of {Math.ceil(displayed.length / 25)}</span>
      <button type="button" disabled={(currentPage + 1) * 25 >= displayed.length} onClick={() => setPage(currentPage + 1)}>Next choices</button>
    </div>}
    {field.inherited && Object.keys(field.inherited).length > 0 && <details>
      <summary className="cursor-pointer text-sm font-medium">Inherited access — edit the source to remove it</summary>
      <ul className="mt-2 space-y-1 text-sm">{Object.entries(field.inherited).map(([permission, sources]) => <li key={permission}>{permission} — {sources.join(', ')}</li>)}</ul>
    </details>}
    {Boolean(field.policyPermissions?.length) && <details>
      <summary className="cursor-pointer text-sm font-medium">Access from this item’s policy — use Edit Policy to change it</summary>
      <ul className="mt-2 text-sm">{field.policyPermissions?.map(permission => <li key={permission}>{permission}</li>)}</ul>
    </details>}
  </fieldset>
}

/**
 * Validate server-provided metadata before rendering editable process values.
 * @param props - Standard widget payload and process callback.
 * @returns The access editor or a contained error.
 */
export default function AuthentikAccessEditorWidget({ data, onWidgetData }: WidgetComponentProps<Record<string, unknown>>) {
  const payload = payloadSchema.safeParse(data)
  const ready = payload.success
  useEffect(() => { onWidgetData?.({ __accessEditorReady: ready }) }, [ready, onWidgetData])
  if (!payload.success || !onWidgetData) return <p role="alert" className={ALERT_CLASS}>The access editor is unavailable. Reopen the action before continuing.</p>
  return <div className="space-y-4">{payload.data.fields.map(field => field.catalogWidget ? <PermissionMatrix key={field.name} field={field} onChange={onWidgetData} /> : <AccessField key={field.name} field={field} onChange={onWidgetData} />)}</div>
}
