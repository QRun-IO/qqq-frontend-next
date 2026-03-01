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
 * @file AssociatedRecords — renders child/related record tables below the main record.
 */

'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ExternalLink, X } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import type { QTableMetaData, QRecord, QExposedJoin } from '@/types'
import { serializeFilter } from '@/lib/utils/filter-utils'
import { cn } from '@/lib/utils/cn'
import { FieldValue } from './FieldValue'
import { RecordHoverCard } from './RecordHoverCard'
import { EntityForm } from '@/components/forms/EntityForm'

interface AssociatedRecordsProps {
  join: QExposedJoin
  records: QRecord[]
  /** The parent table's metadata — used for building "View All" filter */
  parentTableMetaData?: QTableMetaData
  /** The parent record's primary key value — used for building "View All" filter */
  parentPrimaryKey?: string | number
  /** Full table metadata map for rendering possibleValueSource fields as links with hover previews */
  allTables?: Record<string, QTableMetaData>
  /** Source page info for back navigation — appended to outgoing links */
  navigateFrom?: { path: string; label: string }
  /** Called after a child record is successfully created — used to refetch the parent record */
  onRecordCreated?: () => void
  className?: string
}

/**
 * AssociatedRecords — renders a table of child/related records for a given join.
 *
 * Displays column headers derived from the join table's visible fields, a
 * "View All" link when a foreign-key field can be resolved, and an inline
 * create dialog when the join table allows inserts.
 *
 * @param props - Component properties.
 * @returns The associated records section element, or `null` when no fields are renderable.
 */
export function AssociatedRecords({
  join,
  records,
  parentTableMetaData,
  parentPrimaryKey,
  allTables,
  navigateFrom,
  onRecordCreated,
  className,
}: AssociatedRecordsProps) {
  const joinTableMetaData = join.joinTable
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  if (!joinTableMetaData) return null

  // Get visible fields for column headers (first 6 non-hidden fields)
  const visibleFields = Object.values(joinTableMetaData.fields)
    .filter((f) => !f.isHidden && !f.isHeavy)
    .slice(0, 6)

  if (visibleFields.length === 0) return null

  // Build from params for outgoing links
  const fromParams = navigateFrom
    ? `&from=${encodeURIComponent(navigateFrom.path)}&fromLabel=${encodeURIComponent(navigateFrom.label)}`
    : ''
  const fromParamsFirst = navigateFrom
    ? `?from=${encodeURIComponent(navigateFrom.path)}&fromLabel=${encodeURIComponent(navigateFrom.label)}`
    : ''

  // Build "View All" URL — find the FK field in the join table that references the parent table
  let viewAllHref: string | undefined
  if (parentTableMetaData && parentPrimaryKey != null) {
    const fkField = Object.values(joinTableMetaData.fields).find(
      (f) => f.possibleValueSourceName === parentTableMetaData.name
    )
    if (fkField) {
      const filterParam = serializeFilter({
        criteria: [{ fieldName: fkField.name, operator: 'EQUALS', values: [parentPrimaryKey] }],
        booleanOperator: 'AND',
        skip: 0,
        limit: 25,
      })
      viewAllHref = `/app/${joinTableMetaData.name}?filter=${filterParam}${fromParams}`
    }
  }

  return (
    <section
      className={cn('space-y-3', className)}
      data-qqq-id={`associated-records-${join.label}`}
      aria-labelledby={`assoc-heading-${join.label}`}
    >
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3
          id={`assoc-heading-${join.label}`}
          className="text-sm font-semibold text-muted-foreground"
        >
          {join.label}
          {records.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {records.length}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-3">
          {viewAllHref && records.length > 0 && (
            <Link
              href={viewAllHref}
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80',
                'focus:outline-none focus:underline'
              )}
              data-qqq-id={`button-view-all-${joinTableMetaData.name}`}
            >
              View All
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}
          {joinTableMetaData.insertPermission && (
            <button
              type="button"
              onClick={() => setCreateDialogOpen(true)}
              className={cn(
                'text-xs font-medium text-primary hover:text-primary/80',
                'focus:outline-none focus:underline'
              )}
              data-qqq-id={`button-create-${joinTableMetaData.name}`}
            >
              + Add {joinTableMetaData.label}
            </button>
          )}
        </div>
      </div>

      {records.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No {join.label} records
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table
            className="min-w-full divide-y divide-border"
            aria-label={`${join.label} records`}
          >
            <thead className="bg-muted">
              <tr>
                {visibleFields.map((field) => (
                  <th
                    key={field.name}
                    scope="col"
                    className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground"
                    data-qqq-id={`grid-header-${field.name}`}
                  >
                    {field.label}
                  </th>
                ))}
                {joinTableMetaData.readPermission && (
                  <th scope="col" className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {records.map((childRecord, rowIdx) => {
                const childPk =
                  childRecord.values[joinTableMetaData.primaryKeyField] as string | number
                const recordHref = joinTableMetaData.readPermission && childPk !== undefined
                  ? `/app/${joinTableMetaData.name}/${childPk}${fromParamsFirst}`
                  : undefined
                return (
                  <tr
                    key={childPk ?? rowIdx}
                    className="hover:bg-accent transition-colors"
                    data-qqq-id={`assoc-row-${joinTableMetaData.name}-${childPk}`}
                  >
                    {visibleFields.map((field, fieldIdx) => (
                      <td
                        key={field.name}
                        className="whitespace-nowrap px-3 py-2 text-sm"
                        data-qqq-id={`grid-cell-${field.name}`}
                      >
                        {fieldIdx <= 1 && recordHref ? (
                          <RecordHoverCard
                            tableName={joinTableMetaData.name}
                            primaryKey={childPk}
                            tableMetaData={joinTableMetaData}
                            navigateFrom={navigateFrom}
                          >
                            <Link
                              href={recordHref}
                              className="text-primary hover:text-primary/80 hover:underline"
                              aria-label={`View ${joinTableMetaData.label} record ${childPk}`}
                            >
                              {childRecord.displayValues?.[field.name] ?? String(childRecord.values[field.name] ?? '')}
                            </Link>
                          </RecordHoverCard>
                        ) : (
                          <FieldValue field={field} record={childRecord} allTables={allTables} navigateFrom={navigateFrom} />
                        )}
                      </td>
                    ))}
                    {recordHref && (
                      <td className="whitespace-nowrap px-3 py-2 text-right text-sm">
                        <Link
                          href={recordHref}
                          className={cn(
                            'inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80',
                            'focus:outline-none focus:underline'
                          )}
                          data-qqq-id={`link-view-${joinTableMetaData.name}-${childPk}`}
                        >
                          View
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Create child record dialog */}
      {joinTableMetaData.insertPermission && (
        <CreateChildRecordDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          joinTableMetaData={joinTableMetaData}
          parentTableMetaData={parentTableMetaData}
          parentPrimaryKey={parentPrimaryKey}
          onRecordCreated={onRecordCreated}
        />
      )}
    </section>
  )
}

// --- Create child record dialog ---

/**
 * CreateChildRecordDialog — modal form for creating a new child record linked to the parent.
 *
 * Pre-fills the foreign-key field with the parent record's primary key and
 * excludes that field from the visible form so users only fill in remaining fields.
 *
 * @param props - Component properties.
 * @returns A Radix Dialog portal with an EntityForm for the join table.
 */
function CreateChildRecordDialog({
  open,
  onOpenChange,
  joinTableMetaData,
  parentTableMetaData,
  parentPrimaryKey,
  onRecordCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  joinTableMetaData: QTableMetaData
  parentTableMetaData?: QTableMetaData
  parentPrimaryKey?: string | number
  onRecordCreated?: () => void
}) {
  // Find the FK field that references the parent table and pre-fill it
  const fkField = parentTableMetaData
    ? Object.values(joinTableMetaData.fields).find(
        (f) => f.possibleValueSourceName === parentTableMetaData.name
      )
    : undefined

  const defaultValues: Record<string, unknown> = {}
  if (fkField && parentPrimaryKey != null) {
    defaultValues[fkField.name] = parentPrimaryKey
  }

  // Exclude the FK field from the form since it's pre-filled
  const fieldNamesToExclude = fkField ? [fkField.name] : []
  const allEditableFields = Object.values(joinTableMetaData.fields)
    .filter((f) => !f.isHidden && f.isEditable)
    .map((f) => f.name)
  const fieldNamesToInclude = allEditableFields.filter(
    (name) => !fieldNamesToExclude.includes(name)
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/50',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-xl max-h-[85vh] flex flex-col',
            'rounded-xl border border-border bg-card shadow-lg',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
          )}
          aria-describedby={undefined}
          data-qqq-id={`dialog-create-${joinTableMetaData.name}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-foreground">
              Add {joinTableMetaData.label}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className={cn(
                'rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-accent',
                'focus:outline-none focus:ring-2 focus:ring-ring'
              )}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto">
            <EntityForm
              tableMetaData={joinTableMetaData}
              isModal
              overrideHeading={`Add ${joinTableMetaData.label}`}
              saveButtonLabel="Create"
              defaultValues={defaultValues}
              fieldNamesToInclude={fieldNamesToInclude}
              onSuccess={() => {
                onOpenChange(false)
                onRecordCreated?.()
              }}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
