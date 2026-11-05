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

/** @file Bounded permission catalog and grant source views. */
'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { fetchWidgetData } from '@/lib/api/widgets'
import { INPUT_CLASS, ALERT_CLASS } from '@/components/ui/controls'

const optionSchema = z.object({ id: z.string(), label: z.string() })
// QQQ omits empty strings on the wire. Only application membership uses the
// empty string as a valid identity (the Other/unassigned application bucket).
const appOptionSchema = optionSchema.extend({ id: z.string().default('') })
const pageSchema = z.object({ fields: z.array(z.object({
  rows: z.array(z.object({ name: z.string(), label: z.string(), kind: z.string(), app: z.string().default(''), permissions: z.array(optionSchema) })),
  total: z.number().int().nonnegative(), page: z.number().int().nonnegative(), pageSize: z.number().int().positive(), apps: z.array(appOptionSchema),
})).min(1) })
type Option = z.infer<typeof optionSchema>
interface Field {
  name: string; label: string; catalogWidget?: string; selected: Option[]
  inherited?: Record<string, string[]>; policyPermissions?: string[]
}

/**
 * Paged resource matrix. Selection is independent of catalog pages and requests.
 * @param props - Initial grants, catalog source, and process output callback.
 * @returns A searchable matrix with page-scoped bulk actions.
 */
export function PermissionMatrix({ field, onChange, selection, onSelectionChange }: {
  field: Field; onChange?: (values: Record<string, unknown>) => void
  selection?: Set<string>; onSelectionChange?: (selection: Set<string>) => void
}) {
  const [localSelected, setSelected] = useState(() => new Map(field.selected.map(option => [option.id, option])))
  const selected = useMemo(() => selection ? new Map([...selection].map(id => [id, { id, label: id }])) : localSelected, [selection, localSelected])
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [app, setApp] = useState('*')
  const [kind, setKind] = useState('*')
  const [page, setPage] = useState(0)
  const [view, setView] = useState('catalog')
  const id = useId()
  useEffect(() => { const timer = setTimeout(() => { setDebounced(search); setPage(0) }, 250); return () => clearTimeout(timer) }, [search])
  useEffect(() => { if (!selection) onChange?.({ [field.name]: [...selected.keys()].join('\n') }) }, [selected, field.name, onChange, selection])
  const catalog = useQuery({
    queryKey: ['access-catalog', field.catalogWidget, debounced, app, kind, page],
    queryFn: async () => pageSchema.parse(await fetchWidgetData(field.catalogWidget!, { accessCatalog: true, search: debounced, app, kind, page })).fields[0],
    enabled: view === 'catalog',
  })
  const data = catalog.data
  const busy = catalog.isFetching || search !== debounced
  const visible = data?.rows.flatMap(row => row.permissions) ?? []
  const actions = [...new Set(visible.map(option => option.label))]
  const change = (options: Option[], checked: boolean) => {
    const next = new Map(selected)
    options.forEach(option => { if (checked) next.set(option.id, option); else next.delete(option.id) })
    if (selection) onSelectionChange?.(new Set(next.keys()))
    else setSelected(next)
  }
  const localEntries = (view === 'selected' ? [...selected.values()].map(option => [option.id, 'Direct grant'] as const)
    : [...Object.entries(field.inherited ?? {}).map(([permission, sources]) => [permission, sources.join(', ')] as const),
      ...(field.policyPermissions ?? []).map(permission => [permission, 'This item’s policy'] as const)])
    .filter(([permission, source]) => (permission + ' ' + source).toLowerCase().includes(search.toLowerCase()))
  const localPage = Math.min(page, Math.max(0, Math.ceil(localEntries.length / 25) - 1))
  const currentPage = view === 'catalog' ? (data?.page ?? 0) : localPage
  const total = view === 'catalog' ? (data?.total ?? 0) : localEntries.length
  return <fieldset className="space-y-3 rounded-lg border border-border p-4" data-qqq-id="access-permission-matrix">
    <legend className="px-2 font-semibold">{field.label}</legend>
    <p className="text-sm">{selected.size} direct permissions selected. Changes affect named permissions on existing resources. Future resources are not included.</p>
    <label htmlFor={id + '-view'}>Show</label>
    <select id={id + '-view'} className={INPUT_CLASS} value={view} onChange={event => { setView(event.target.value); setPage(0) }}>
      <option value="catalog">Permission catalog</option><option value="selected">Selected direct grants</option><option value="inherited">Why access is granted</option>
    </select>
    <label htmlFor={id + '-search'}>Search permissions or resources</label>
    <input id={id + '-search'} className={INPUT_CLASS} value={search} onChange={event => setSearch(event.target.value)} />
    {view === 'catalog' && <>
      <label htmlFor={id + '-app'}>Application</label>
      <select id={id + '-app'} className={INPUT_CLASS} value={app} onChange={event => { setApp(event.target.value); setPage(0) }}>
        <option value="*">All applications</option>{data?.apps.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      <label htmlFor={id + '-kind'}>Resource type</label>
      <select id={id + '-kind'} className={INPUT_CLASS} value={kind} onChange={event => { setKind(event.target.value); setPage(0) }}>
        <option value="*">All resource types</option>{['APP', 'TABLE', 'PROCESS', 'REPORT', 'WIDGET', 'OTHER'].map(value => <option key={value}>{value}</option>)}
      </select>
      {busy && <p role="status">Loading permission page…</p>}
      {catalog.isError && <p role="alert" className={ALERT_CLASS}>Could not load permissions. Your selections are preserved. <button type="button" onClick={() => void catalog.refetch()}>Retry</button></p>}
      <div className="flex gap-4">
        <button type="button" disabled={busy || !visible.length || catalog.isError} onClick={() => change(visible, true)}>Select {visible.length} permissions on this page</button>
        <button type="button" disabled={busy || !visible.length || catalog.isError} onClick={() => change(visible, false)}>Clear {visible.length} permissions on this page</button>
      </div>
      <div className="overflow-auto"><table className="w-full text-sm"><caption className="sr-only">Direct permissions by resource and action</caption>
        <thead><tr><th scope="col" className="text-left">Resource</th>{actions.map(action => <th scope="col" key={action}>{action === 'insert' ? 'Create' : action === 'hasAccess' ? 'Access' : action}</th>)}</tr></thead>
        <tbody>{data?.rows.map(row => <tr key={row.name}><th scope="row" className="text-left"><span>{row.label}</span><small className="block font-normal">{row.name} · {row.kind}</small></th>
          {actions.map(action => { const option = row.permissions.find(item => item.label === action); return <td key={action} className="p-2 text-center">{option ? <input type="checkbox" aria-label={option.id} data-qqq-id={'access-choice-permissions-' + option.id} checked={selected.has(option.id)} disabled={busy} onChange={event => change([option], event.target.checked)} /> : '—'}</td> })}
        </tr>)}</tbody>
      </table></div>
    </>}
    {view !== 'catalog' && <ul className="space-y-2">{localEntries.slice(localPage * 25, localPage * 25 + 25).map(([permission, source]) => <li key={permission + source}>
      {view === 'selected' ? <label><input type="checkbox" checked aria-label={permission} onChange={() => change([{ id: permission, label: permission }], false)} /> {permission}</label> : <span>{permission} — {source}</span>}
    </li>)}</ul>}
    <p role="status">{total} {view === 'catalog' ? 'resources' : 'permissions'} · Page {currentPage + 1} of {Math.max(1, Math.ceil(total / 25))}</p>
    <div className="flex gap-4"><button type="button" disabled={currentPage === 0 || (view === 'catalog' && busy)} onClick={() => setPage(currentPage - 1)}>Previous</button>
      <button type="button" disabled={(currentPage + 1) * 25 >= total || (view === 'catalog' && busy)} onClick={() => setPage(currentPage + 1)}>Next</button></div>
    {view === 'inherited' && <p className="text-sm">Inherited grants must be changed at their source. Policy grants use Edit Policy.</p>}
  </fieldset>
}
