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

/** @file Lazy, batched effective-permission preview for the policy editor. */
'use client'

import { useMemo, useState } from 'react'

import { buttonClass } from '@/components/ui/controls'
import type { PolicyCatalogGroup, PolicyPreviewMember } from './AuthentikPolicyEditorWidget'
import { ACTION_LABELS, FULL_ACCESS_PERMISSION, isPolicyAction } from './policy-document'

const PAGE_SIZE = 50

/**
 * On-demand member preview. Base permissions can include non-policy names (with dots),
 * so they must be retained verbatim. Removed entries are visible but excluded from the total.
 * @param props - Server snapshot, current and saved policy permissions, and display catalog.
 * @returns Effective permissions grouped by resource, rendered in bounded batches.
 */
export default function PolicyMemberPreview({ member, selected, saved, catalog }: {
  member: PolicyPreviewMember
  selected: Set<string>
  saved: Set<string>
  catalog: PolicyCatalogGroup[]
}) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const fullAccess = selected.has(FULL_ACCESS_PERMISSION)
  const savedFullAccess = saved.has(FULL_ACCESS_PERMISSION)
  const baseCount = new Set(member.basePermissions).size
  const preview = useMemo(() => {
    // Full access is symbolic, so neither enumerate it nor mark old named grants removed.
    if (fullAccess) return { total: 0, entries: [] }
    const current = new Set([...member.basePermissions, ...selected])
    const previous = new Set([...member.basePermissions, ...[...saved].filter((permission) => permission !== FULL_ACCESS_PERMISSION)])
    const resources = new Map(catalog.flatMap((group) => group.resources.map((resource) => [resource.name, resource] as const)))
    const entries = [...new Set([...current, ...previous])].sort().map((permission) => {
      const dot = permission.lastIndexOf('.')
      const resourceName = dot > 0 ? permission.slice(0, dot) : permission
      const action = dot > 0 ? permission.slice(dot + 1) : ''
      const resource = resources.get(resourceName)
      const resourceLabel = resource?.label ?? resourceName
      const actionLabel = resource?.features?.find((feature) => feature.name === action)?.label
        ?? (isPolicyAction(action) ? ACTION_LABELS[action] : action)
      return {
        permission,
        resourceName,
        resourceLabel,
        // Unknown non-policy names stay readable without implying catalog membership.
        label: resource || isPolicyAction(action) ? `${resourceLabel}: ${actionLabel}` : permission,
        change: !current.has(permission) ? 'removed by this edit' : !savedFullAccess && !previous.has(permission) ? 'added by this edit' : null,
      }
    })
    return { total: current.size, entries }
  }, [catalog, fullAccess, member.basePermissions, saved, savedFullAccess, selected])

  const groups = new Map<string, { label: string; entries: typeof preview.entries }>()
  for (const entry of preview.entries.slice(0, limit)) {
    if (!groups.has(entry.resourceName)) groups.set(entry.resourceName, { label: entry.resourceLabel, entries: [] })
    groups.get(entry.resourceName)?.entries.push(entry)
  }

  return (
    <div className="flex min-w-0 flex-col gap-3" data-qqq-id="policy-preview-permissions">
      {(fullAccess || savedFullAccess) && (
        <div className="text-sm text-foreground">
          <p role="status" className="flex flex-wrap items-center gap-x-2">
            <span className="font-medium">Full access: everything in this app</span>
            {fullAccess !== savedFullAccess && <span className="text-xs">{fullAccess ? 'added by this edit' : 'removed by this edit'}</span>}
          </p>
          <p className="mt-1 text-muted-foreground">{`${baseCount} base permission${baseCount === 1 ? '' : 's'}`}</p>
        </div>
      )}
      {!fullAccess && <p role="status" className="text-sm font-medium text-foreground">{`${preview.total} effective permission${preview.total === 1 ? '' : 's'}`}</p>}
      {!fullAccess && preview.total === 0 && <p className="text-sm text-muted-foreground">No effective permissions.</p>}
      {[...groups].map(([name, group]) => (
        <div key={name} className="min-w-0">
          <h4 className="break-words text-sm font-medium text-foreground">{group.label}</h4>
          <ul aria-label={`${group.label} permissions`} className="mt-1 flex min-w-0 flex-wrap gap-2">
            {group.entries.map((entry) => (
              <li key={entry.permission} className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 rounded-md border border-border bg-muted px-2 py-1 text-sm text-foreground">
                <span className="min-w-0 break-all">{entry.label}</span>
                {entry.change && <span className="text-xs">{entry.change}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {preview.entries.length > limit && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{`Showing ${limit} of ${preview.entries.length} permissions, including removals`}</span>
          <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => setLimit((current) => current + PAGE_SIZE)} data-qqq-id="policy-preview-more">Show more permissions</button>
        </div>
      )}
    </div>
  )
}
