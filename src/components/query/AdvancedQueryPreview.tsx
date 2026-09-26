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

/** @file Removable previews of advanced query conditions, including nested groups. */

'use client'

import { X } from 'lucide-react'

import type { QFilterCriteria, QQueryFilter } from '@/types'
import { formatCriterionDisplay } from '@/lib/utils/filter-utils'

import type { FilterField } from './FilterBuilder'

interface PreviewItem {
  groupPath: number[]
  index: number
  criterion: QFilterCriteria
}

/**
 * Collects every condition with its nested group path.
 *
 * @param filter - The group to traverse.
 * @param groupPath - Indices from the root to this group.
 * @returns Preview items in filter order.
 */
function collectCriteria(filter: QQueryFilter, groupPath: number[] = []): PreviewItem[] {
  return [
    ...(filter.criteria ?? []).map((criterion, index) => ({ groupPath, index, criterion })),
    ...(filter.subFilters ?? []).flatMap((child, index) => collectCriteria(child, [...groupPath, index])),
  ]
}

/**
 * Removes one condition without changing its siblings or other nested groups.
 *
 * @param filter - The current group.
 * @param groupPath - Indices to the condition's parent group.
 * @param index - The condition index within that group.
 * @returns The updated filter.
 */
function removeCriterion(filter: QQueryFilter, groupPath: number[], index: number): QQueryFilter {
  if (groupPath.length === 0) return { ...filter, criteria: (filter.criteria ?? []).filter((_, itemIndex) => itemIndex !== index) }
  const [childIndex, ...remainder] = groupPath
  const subFilters = (filter.subFilters ?? []).map((child, itemIndex) => itemIndex === childIndex ? removeCriterion(child, remainder, index) : child)
    .filter((child) => (child.criteria?.length ?? 0) > 0 || (child.subFilters?.length ?? 0) > 0)
  return { ...filter, subFilters }
}

interface AdvancedQueryPreviewProps {
  filter: QQueryFilter
  fields: FilterField[]
  onChange: (filter: QQueryFilter) => void
}

/**
 * Shows advanced conditions as removable chips while retaining the full builder for editing.
 *
 * @param props - Filter, field labels, and update callback.
 * @returns Condition preview chips, or nothing for an empty filter.
 */
export function AdvancedQueryPreview(props: AdvancedQueryPreviewProps) {
  const { filter, fields, onChange } = props
  const items = collectCriteria(filter)
  if (items.length === 0) return null
  const labelFor = (fieldName: string) => fields.find((field) => field.name === fieldName)?.label

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Advanced filter preview" data-qqq-id="advanced-query-preview">
      {items.map(({ groupPath, index, criterion }) => {
        const label = formatCriterionDisplay(criterion, labelFor)
        return (
          <button key={`${groupPath.join('.')}:${index}`} type="button"
            onClick={() => onChange(removeCriterion(filter, groupPath, index))}
            aria-label={`Remove ${label}`}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-input bg-card px-3 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
            data-qqq-id={`advanced-preview-${groupPath.join('-') || 'root'}-${index}`}>
            <span>{label}</span><X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
