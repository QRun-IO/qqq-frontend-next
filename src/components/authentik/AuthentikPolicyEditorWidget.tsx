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
 * @file AuthentikPolicyEditorWidget — the `AUTHENTIK_POLICY_EDITOR` widget of qbit-authentik
 * (its DESIGN.md section 12.4): edits a group's policy document as a matrix of the app's
 * resources (apps, tables, processes, reports, widgets from metadata, grouped by app) by action,
 * with search, select-all per row, per column and per app, a list of resources the app does not
 * know, and a live read-only JSON preview. On a process step it hands the generated document to
 * the step as `{ [outputFieldName]: compactJson }`; the server validates it again on Review.
 */
'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'

import type { WidgetComponentProps } from '@/components/widgets/widget-types'
import { asList, isPlainObject } from '@/components/widgets/widget-types'
import { ALERT_CLASS, INPUT_CLASS, WARNING_CLASS, buttonClass } from '@/components/ui/controls'
import { cn } from '@/lib/utils/cn'
import type { PolicyAction, PolicyFormat } from './policy-document'
import { POLICY_ACTIONS, generatePolicy, parsePolicy, permissionName, roundTrips, splitPermission } from './policy-document'

/** One grantable resource in the catalog. */
export interface PolicyCatalogResource {
  name: string
  label: string
  kind: 'APP' | 'TABLE' | 'PROCESS' | 'REPORT' | 'WIDGET'
  actions: PolicyAction[]
  note?: string
}

/** The resources of one app (`app` null: in no app). */
export interface PolicyCatalogGroup {
  app: string | null
  label: string
  resources: PolicyCatalogResource[]
}

/** The widget's payload from the qbit. */
export interface PolicyEditorPayload {
  spec: string
  version: string
  /** The group the policy belongs to (display only). */
  groupLabel?: string
  catalog: PolicyCatalogGroup[]
  /** The group's current document (JSON text), or empty for none. */
  document?: string
  /** Why the current document in Authentik does not parse, if it does not. */
  documentProblem?: string
  /** The document in Authentik differs from the last save made in QQQ. */
  changedInAuthentik?: boolean
  /** Process value the generated document goes to (default `policyDocument`). */
  outputFieldName?: string
}

/** Column labels of the actions. */
const ACTION_LABELS: Record<PolicyAction, string> = { hasAccess: 'Access', read: 'Read', insert: 'Insert', edit: 'Edit', delete: 'Delete' }

/** Plain names of the resource kinds. */
const KIND_LABELS: Record<PolicyCatalogResource['kind'], string> = { APP: 'App', TABLE: 'Table', PROCESS: 'Process', REPORT: 'Report', WIDGET: 'Widget' }

/**
 * A checkbox that can show the mixed state.
 * @param props - Checked state, mixed flag, label and change handler.
 * @returns The input.
 */
function TriStateCheckbox({ checked, mixed, label, onChange, disabled, qqqId }: { checked: boolean; mixed: boolean; label: string; onChange: (next: boolean) => void; disabled?: boolean; qqqId?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed
  }, [mixed])
  return (
    <input
      ref={ref}
      type="checkbox"
      className="size-4 shrink-0 cursor-pointer accent-[var(--color-primary)] disabled:cursor-not-allowed"
      checked={checked}
      aria-checked={mixed ? 'mixed' : checked}
      aria-label={label}
      disabled={disabled}
      data-qqq-id={qqqId}
      onChange={(event) => onChange(event.target.checked)}
    />
  )
}

/**
 * The state of a set of permissions within a selection.
 * @param permissions - The permissions.
 * @param selected - The selection.
 * @returns Whether all are selected, and whether only some are.
 */
function stateOf(permissions: string[], selected: Set<string>): { checked: boolean; mixed: boolean } {
  const count = permissions.filter((permission) => selected.has(permission)).length
  return { checked: permissions.length > 0 && count === permissions.length, mixed: count > 0 && count < permissions.length }
}

/**
 * The policy editor.
 * @param props - Widget metadata, payload and the step callback.
 * @returns The editor, or a notice for a malformed payload.
 */
export function AuthentikPolicyEditorWidget({ widgetMetaData, data, onWidgetData }: WidgetComponentProps<Record<string, unknown>>) {
  const payload = data as unknown as PolicyEditorPayload
  const catalog = useMemo(() => (asList<PolicyCatalogGroup>(payload.catalog) ?? []).filter((group) => isPlainObject(group) && Array.isArray(group.resources)), [payload.catalog])
  const format: PolicyFormat = useMemo(() => ({ spec: String(payload.spec ?? ''), version: String(payload.version ?? '') }), [payload.spec, payload.version])
  const outputFieldName = typeof payload.outputFieldName === 'string' && payload.outputFieldName ? payload.outputFieldName : 'policyDocument'
  const searchId = useId()

  ///////////////////////////////////////////////////////////////////
  // what this app can grant: permission -> its resource and label //
  ///////////////////////////////////////////////////////////////////
  const known = useMemo(() => {
    const map = new Map<string, PolicyCatalogResource>()
    for (const group of catalog) {
      for (const resource of group.resources) {
        for (const action of resource.actions ?? []) map.set(permissionName(resource.name, action), resource)
      }
    }
    return map
  }, [catalog])

  const initial = useMemo(() => {
    if (!payload.document || payload.document.trim() === '') return { permissions: new Set<string>(), problem: payload.documentProblem ?? null }
    const parsed = parsePolicy(payload.document, format)
    return parsed.ok ? { permissions: parsed.permissions, problem: payload.documentProblem ?? null } : { permissions: new Set<string>(), problem: payload.documentProblem ?? parsed.error }
  }, [format, payload.document, payload.documentProblem])

  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial.permissions))
  const [search, setSearch] = useState('')

  const generated = useMemo(() => generatePolicy(selected, format), [format, selected])
  const unknown = useMemo(() => [...selected].filter((permission) => !known.has(permission)).sort(), [known, selected])
  const valid = useMemo(() => roundTrips(selected, format), [format, selected])

  useEffect(() => {
    onWidgetData?.({ [outputFieldName]: generated.compact })
  }, [generated.compact, onWidgetData, outputFieldName])

  const term = search.trim().toLowerCase()
  const visibleGroups = useMemo(() => catalog
    .map((group) => ({
      ...group,
      resources: term === '' || group.label.toLowerCase().includes(term)
        ? group.resources
        : group.resources.filter((resource) => resource.label.toLowerCase().includes(term) || resource.name.toLowerCase().includes(term)),
    }))
    .filter((group) => group.resources.length > 0), [catalog, term])

  const set = (permissions: string[], on: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      permissions.forEach((permission) => (on ? next.add(permission) : next.delete(permission)))
      return next
    })
  }

  const resourceCount = catalog.reduce((sum, group) => sum + group.resources.length, 0)
  if (!payload.spec || !payload.version) {
    return <p role="alert" className={ALERT_CLASS}>The policy editor data is not in the expected format (spec).</p>
  }

  return (
    <div className="@container flex min-w-0 flex-col gap-4" data-qqq-id={`policy-editor-${widgetMetaData.name}`}>
      {payload.changedInAuthentik && (
        <p className={WARNING_CLASS} role="status" data-qqq-id="policy-editor-changed">
          This policy was changed in Authentik since it was last saved here. The editor shows what Authentik holds now.
        </p>
      )}
      {initial.problem && (
        <p className={ALERT_CLASS} role="alert" data-qqq-id="policy-editor-problem">
          {`The policy stored in Authentik is not valid, so it grants nothing: ${initial.problem}. Saving replaces it.`}
        </p>
      )}

      <div className="flex flex-col gap-2 @xl:flex-row @xl:items-end @xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={searchId} className="text-sm font-medium text-foreground">Find a resource</label>
          <input
            id={searchId}
            type="search"
            className={cn(INPUT_CLASS, '@xl:max-w-sm')}
            placeholder="App, table, process or report"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            data-qqq-id="policy-editor-search"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span data-qqq-id="policy-editor-count">{`${selected.size} permission${selected.size === 1 ? '' : 's'} selected`}</span>
          <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => setSelected(new Set())} disabled={selected.size === 0} data-qqq-id="policy-editor-clear">
            Clear all
          </button>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 @5xl:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)]">
        <div className="flex min-w-0 flex-col gap-3">
          {resourceCount === 0 && <p className="text-sm text-muted-foreground">This app has no resources that a policy can grant.</p>}
          {resourceCount > 0 && visibleGroups.length === 0 && <p className="text-sm text-muted-foreground" role="status">No resource matches the search.</p>}
          {visibleGroups.map((group) => (
            <PolicyGroupSection key={group.app ?? '(other)'} group={group} selected={selected} onSet={set} />
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          {unknown.length > 0 && (
            <section className={WARNING_CLASS} aria-labelledby="policy-editor-unknown-title" data-qqq-id="policy-editor-unknown">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="policy-editor-unknown-title" className="font-medium">{`Not in this app (${unknown.length})`}</h3>
                <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => set(unknown, false)}>Remove all</button>
              </div>
              <p className="mt-1">These are kept until you remove them, for example a table that no longer exists. New ones are refused when you save.</p>
              <ul className="mt-2 flex flex-col gap-1">
                {unknown.map((permission) => (
                  <li key={permission} className="flex min-w-0 items-center justify-between gap-2">
                    <code className="min-w-0 break-all">{permission}</code>
                    <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => set([permission], false)} aria-label={`Remove ${permission}`}>Remove</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-md border border-border bg-card" aria-labelledby="policy-editor-json-title">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <h3 id="policy-editor-json-title" className="text-sm font-medium text-foreground">Policy document</h3>
              <span className={cn('text-xs', valid ? 'text-muted-foreground' : 'text-destructive')} data-qqq-id="policy-editor-valid">
                {valid ? `${generated.statementCount} statement${generated.statementCount === 1 ? '' : 's'}; checked` : 'This document does not round-trip; it cannot be saved'}
              </span>
            </div>
            <pre className="whitespace-pre-wrap break-all p-3 font-mono text-xs leading-5 text-foreground" aria-label="Policy document JSON" data-qqq-id="policy-editor-json">{generated.pretty}</pre>
          </section>
        </div>
      </div>
    </div>
  )
}

/**
 * One app's resources with its select-all controls.
 * @param props - The group, the selection and the setter.
 * @returns The section.
 */
function PolicyGroupSection({ group, selected, onSet }: { group: PolicyCatalogGroup; selected: Set<string>; onSet: (permissions: string[], on: boolean) => void }) {
  const all = group.resources.flatMap((resource) => (resource.actions ?? []).map((action) => permissionName(resource.name, action)))
  const groupState = stateOf(all, selected)
  const count = all.filter((permission) => selected.has(permission)).length
  const slug = (group.app ?? 'other').replace(/[^A-Za-z0-9_-]/g, '_')

  return (
    <section className="@container min-w-0 rounded-md border border-border bg-card" aria-label={group.label} data-qqq-id={`policy-group-${slug}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-2">
        <label className="flex min-w-0 items-center gap-2 font-medium text-foreground">
          <TriStateCheckbox checked={groupState.checked} mixed={groupState.mixed} label={`Everything in ${group.label}`} onChange={(on) => onSet(all, on)} qqqId={`policy-group-all-${slug}`} />
          <span className="min-w-0 break-words">{group.label}</span>
        </label>
        <span className="text-xs text-muted-foreground">{`${count} of ${all.length}`}</span>
      </div>

      <div className="hidden border-b border-border px-3 py-1.5 text-xs font-medium text-muted-foreground @xl:grid @xl:grid-cols-[minmax(0,1fr)_repeat(6,3.75rem)] @xl:items-center">
        <span>Resource</span>
        {POLICY_ACTIONS.map((action) => {
          const column = group.resources.filter((resource) => resource.actions?.includes(action)).map((resource) => permissionName(resource.name, action))
          const state = stateOf(column, selected)
          return (
            <span key={action} className="flex flex-col items-center gap-0.5">
              <span>{ACTION_LABELS[action]}</span>
              <TriStateCheckbox checked={state.checked} mixed={state.mixed} disabled={column.length === 0} label={`${ACTION_LABELS[action]} for everything in ${group.label}`} onChange={(on) => onSet(column, on)} qqqId={`policy-col-${slug}-${action}`} />
            </span>
          )
        })}
        <span className="text-center">All</span>
      </div>

      <ul className="flex flex-col">
        {group.resources.map((resource) => {
          const row = (resource.actions ?? []).map((action) => permissionName(resource.name, action))
          const rowState = stateOf(row, selected)
          return (
            <li key={resource.name} className="grid grid-cols-1 gap-1 border-b border-border px-3 py-2 last:border-b-0 @xl:grid-cols-[minmax(0,1fr)_repeat(6,3.75rem)] @xl:items-center @xl:gap-0" data-qqq-id={`policy-row-${resource.name}`}>
              <div className="min-w-0">
                <div className="break-words text-sm text-foreground">{resource.label}</div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>{KIND_LABELS[resource.kind] ?? resource.kind}</span>
                  <code className="break-all">{resource.name}</code>
                </div>
                {resource.note && <div className="mt-0.5 text-xs text-muted-foreground">{resource.note}</div>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 @xl:contents">
                {POLICY_ACTIONS.map((action) => {
                  const permission = permissionName(resource.name, action)
                  const offered = resource.actions?.includes(action) ?? false
                  return (
                    <span key={action} className={cn('items-center gap-1.5 @xl:justify-center', offered ? 'flex' : 'hidden @xl:flex')}>
                      {offered
                        ? (
                            <label className="flex items-center gap-1.5 text-sm">
                              <input
                                type="checkbox"
                                className="size-4 cursor-pointer accent-[var(--color-primary)]"
                                checked={selected.has(permission)}
                                aria-label={`${ACTION_LABELS[action]}: ${resource.label}`}
                                onChange={(event) => onSet([permission], event.target.checked)}
                                data-qqq-id={`policy-cell-${resource.name}-${action}`}
                              />
                              <span className="@xl:sr-only">{ACTION_LABELS[action]}</span>
                            </label>
                          )
                        : <span className="text-xs text-muted-foreground" aria-hidden="true">-</span>}
                    </span>
                  )
                })}
                <span className="flex items-center gap-1.5 @xl:justify-center">
                  <label className="flex items-center gap-1.5 text-sm">
                    <TriStateCheckbox checked={rowState.checked} mixed={rowState.mixed} label={`All actions: ${resource.label}`} onChange={(on) => onSet(row, on)} qqqId={`policy-row-all-${resource.name}`} />
                    <span className="@xl:sr-only">All</span>
                  </label>
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Whether a permission is a well-formed policy permission (exported for tests).
 * @param permission - Candidate.
 * @returns True for `{resource}.{action}`.
 */
export function isPolicyPermission(permission: string): boolean {
  return splitPermission(permission) !== null
}

export default AuthentikPolicyEditorWidget
