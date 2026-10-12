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
 * @file TableMetadataExplorer — the table's metadata on the developer view as readable, searchable
 * groups (summary, fields with their possible-value sources and adornments, sections, menus and
 * supplemental metadata) plus the raw JSON, instead of one large JSON block.
 */

'use client'

import React, { useMemo, useState } from 'react'

import type { QFieldMetaData, QTableMetaData } from '@/types'
import { CodeBlock } from '@/components/scripts/HighlightedCode'
import { CopyButton } from './DeveloperSection'
import { PanelTable } from './DeveloperPanelView'

/**
 * Adornments of a field as short text, e.g. `CHIP {"color.ACTIVE":"success"}`.
 * @param field - The field.
 * @returns One line per adornment.
 */
export function adornmentText(field: QFieldMetaData): string {
  return (field.adornments ?? [])
    .map((adornment) => adornment.values && Object.keys(adornment.values).length ? `${adornment.type} ${JSON.stringify(adornment.values)}` : adornment.type)
    .join('\n')
}

/**
 * Whether any of the texts contains the needle (case-insensitive).
 * @param needle - Lower-cased search text ('' matches everything).
 * @param texts - Candidate texts.
 * @returns True on a match.
 */
function matches(needle: string, ...texts: Array<string | undefined | null>): boolean {
  return !needle || texts.some((text) => text?.toLowerCase().includes(needle))
}

/**
 * The explorer.
 *
 * @param props - The table.
 * @param props.table - Full table metadata.
 * @returns Search box and collapsible groups.
 */
export function TableMetadataExplorer({ table }: { table: QTableMetaData }) {
  const [search, setSearch] = useState('')
  const needle = search.trim().toLowerCase()
  const json = useMemo(() => JSON.stringify(table, null, 2), [table])

  const fields = Object.values(table.fields ?? {}).filter((field) =>
    matches(needle, field.name, field.label, field.type, field.possibleValueSourceName, adornmentText(field), field.displayFormat))
  const sections = (table.sections ?? []).filter((section) => matches(needle, section.name, section.label, section.tier, ...(section.fieldNames ?? [])))
  const supplemental = Object.entries({ ...(table.supplementalMetaData ?? {}), ...(table.supplementalTableMetaData ?? {}) })
    .filter(([key, value]) => matches(needle, key, JSON.stringify(value)))
  const capabilities = (table.capabilities ?? []).join(', ')

  return (
    <div className="space-y-3">
      <label className="flex max-w-sm flex-col gap-1 text-xs font-medium text-muted-foreground">
        Search table metadata
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Field, section, adornment, PVS…"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          data-qqq-id="dev-metadata-search"
        />
      </label>

      <Group title="Summary" open={!needle}>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(8rem,max-content)_1fr]">
          {[
            ['Name', table.name],
            ['Label', table.label],
            ['Primary key', table.primaryKeyField],
            ['Capabilities', capabilities || 'all'],
            ['Your permissions', ['read', 'insert', 'edit', 'delete'].filter((_, index) => [table.readPermission, table.insertPermission, table.editPermission, table.deletePermission][index]).join(', ') || 'none'],
            ['Uses variants', table.usesVariants ? `yes (${table.variantTableLabel})` : 'no'],
            ['Record search fields', (table.searchFields ?? []).join(', ') || '—'],
          ].map(([label, value]) => (
            <React.Fragment key={label}>
              <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
              <dd className="m-0 break-words font-mono text-xs text-foreground">{value}</dd>
            </React.Fragment>
          ))}
        </dl>
      </Group>

      <Group title={`Fields (${fields.length})`} open={Boolean(needle)}>
        <PanelTable
          columns={['Name', 'Label', 'Type', 'Possible values', 'Adornments', 'Flags', 'Format']}
          rows={fields.map((field) => [
            field.name,
            field.label,
            field.type,
            field.possibleValueSourceName ?? (field.inlinePossibleValueSource?.enumValues?.map((option) => `${option.id}=${option.label}`).join(', ') ?? ''),
            adornmentText(field),
            [field.isRequired && 'required', !field.isEditable && 'read-only', field.isHidden && 'hidden', field.isHeavy && 'heavy', field.maxLength && `max ${field.maxLength}`].filter(Boolean).join(', '),
            field.displayFormat ?? '',
          ])}
        />
      </Group>

      <Group title={`Sections (${sections.length})`} open={Boolean(needle) && sections.length > 0}>
        <PanelTable
          columns={['Name', 'Label', 'Tier', 'Fields']}
          rows={sections.map((section) => [section.name, section.label, section.tier ?? '', (section.fieldNames ?? []).join(', ')])}
        />
      </Group>

      {(table.menus?.length ?? 0) > 0 && !needle && (
        <Group title={`Menus (${table.menus?.length})`}>
          <PanelTable
            columns={['Slot', 'Label', 'Items']}
            rows={(table.menus ?? []).map((menu) => [menu.slot ?? '', menu.label ?? '', (menu.items ?? []).map((item) => item.label ?? item.itemType).join(', ')])}
          />
        </Group>
      )}

      {supplemental.length > 0 && (
        <Group title={`Supplemental metadata (${supplemental.length})`} open={Boolean(needle)}>
          {supplemental.map(([key, value]) => (
            <div key={key}>
              <h4 className="mb-1 font-mono text-xs font-semibold text-foreground">{key}</h4>
              <CodeBlock code={JSON.stringify(value, null, 2)} language="json" className="max-h-64" />
            </div>
          ))}
        </Group>
      )}

      <Group title="Raw JSON">
        <div className="mb-2 flex justify-end"><CopyButton text={json} label="Copy table metadata JSON" /></div>
        <CodeBlock code={json} language="json" className="max-h-[32rem]" dataQqqId="json-output" />
      </Group>
    </div>
  )
}

/**
 * A collapsible group (native details/summary: keyboard and screen-reader friendly).
 * @param props - Title, initial state and content.
 * @param props.title - Summary text.
 * @param props.open - Starts open.
 * @param props.children - Content.
 * @returns The group.
 */
function Group({ title, open = false, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    // key on open: a search that opens the group re-mounts it, so the user's own toggling still works afterwards
    <details key={String(open)} open={open} className="rounded-lg border border-border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">{title}</summary>
      <div className="min-w-0 border-t border-border p-3">{children}</div>
    </details>
  )
}
