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

import React, { useId, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ExternalLink, X } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import type { QTableMetaData, QRecord, QAssociation } from '@/types'
import { resolveAssociationValues, type AssociationTableState } from '@/lib/utils/association-utils'
import { serializeFilter } from '@/lib/utils/filter-utils'
import { cn } from '@/lib/utils/cn'
import { FieldValue } from './FieldValue'
import { RecordHoverCard } from './RecordHoverCard'
import { EntityForm } from '@/components/forms/EntityForm'

interface AssociatedRecordsProps {
  association: QAssociation
  metadata?: AssociationTableState
  label?: string
  /** Undefined when this relationship has no resolved response data. */
  records?: QRecord[]
  /** Full parent metadata used to resolve the named join. */
  parentTableMetaData: QTableMetaData
  /** Actual parent values supply every relationship field. */
  parentRecord: QRecord
  /** Full table metadata map for rendering possibleValueSource fields as links with hover previews */
  allTables?: Record<string, QTableMetaData>
  /** Source page info for back navigation — appended to outgoing links */
  navigateFrom?: { path: string; label: string }
  /** Called after a child record is successfully created — used to refetch the parent record */
  onRecordCreated?: () => void
  className?: string
}

/** Number of associated records to show per page/batch. */
const PAGE_SIZE = 25

/**
 * Render one exact named group with independently resolved target metadata.
 * Add needs INSERT and a complete relationship tuple; related data needs READ.
 * @param props - Association descriptor, parent values, child metadata and response state.
 * @returns The related panel, including localized unavailable states and permitted actions.
 */
export function AssociatedRecords({
  association,
  metadata,
  label = association.name,
  records: loadedRecords,
  parentTableMetaData,
  parentRecord,
  allTables,
  navigateFrom,
  onRecordCreated,
  className,
}: AssociatedRecordsProps) {
  const joinTableMetaData = metadata?.table
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const headingId = useId()
  const associationId = encodeURIComponent(association.name)

  if (metadata?.isDenied) return null

  if (!joinTableMetaData || metadata?.isError) {
    return <section data-qqq-id={`associated-records-${associationId}`} aria-labelledby={headingId}>
      <h3 id={headingId}>{label}</h3>
      <p role={metadata?.isLoading ? 'status' : 'alert'}>{metadata?.isLoading ? 'Loading related metadata...' : 'Related table metadata is unavailable.'}</p>
    </section>
  }

  const relationship = resolveAssociationValues(association, parentTableMetaData, parentRecord, joinTableMetaData)
  const reverse = association.join.leftTable !== parentTableMetaData.name
  const availableRecords = !reverse && joinTableMetaData.readPermission ? loadedRecords : undefined
  const records = availableRecords ?? []
  const fixedValues = 'values' in relationship ? relationship.values : undefined
  const visibleFields = Object.values(joinTableMetaData.fields)
    .filter((f) => !f.isHidden && !f.isHeavy)
    .slice(0, 6)

  // Build from params for outgoing links
  const fromParams = navigateFrom
    ? `&from=${encodeURIComponent(navigateFrom.path)}&fromLabel=${encodeURIComponent(navigateFrom.label)}`
    : ''
  const fromParamsFirst = navigateFrom
    ? `?from=${encodeURIComponent(navigateFrom.path)}&fromLabel=${encodeURIComponent(navigateFrom.label)}`
    : ''

  const filter = fixedValues ? {
    criteria: Object.entries(fixedValues).map(([fieldName, value]) => ({ fieldName, operator: 'EQUALS' as const, values: [value] })),
    booleanOperator: 'AND' as const,
    skip: 0,
    limit: 25,
  } : undefined
  const viewAllHref = joinTableMetaData.readPermission && filter
    ? `/app/${encodeURIComponent(joinTableMetaData.name)}?filter=${encodeURIComponent(serializeFilter(filter))}${fromParams}`
    : undefined

  return (
    <section
      className={cn('space-y-3', className)}
      data-qqq-id={`associated-records-${associationId}`}
      aria-labelledby={headingId}
    >
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3
          id={headingId}
          className="text-sm font-semibold text-muted-foreground"
        >
          {label}
          {records.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {records.length}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-3">
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80',
                'focus:outline-none focus:underline'
              )}
              data-qqq-id={`button-view-all-association-${associationId}`}
            >
              View All
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}
          {joinTableMetaData.insertPermission && fixedValues && (
            <button
              type="button"
              onClick={() => setCreateDialogOpen(true)}
              className={cn(
                'text-xs font-medium text-primary hover:text-primary/80',
                'focus:outline-none focus:underline'
              )}
              data-qqq-id={`button-create-association-${associationId}`}
            >
              + Add {joinTableMetaData.label}
            </button>
          )}
        </div>
      </div>

      {'error' in relationship && <p role="alert" className="text-sm text-destructive">{relationship.error}</p>}
      {reverse ? (
        <p className="py-4 text-sm text-muted-foreground">Related record loading for reverse associations is not supported.</p>
      ) : availableRecords === undefined ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Related records are unavailable.</p>
      ) : records.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No {label} records
        </p>
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-md border border-border">
            <table
              className="min-w-full divide-y divide-border"
              aria-label={`${label} records`}
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
                {records.slice(0, visibleCount).map((childRecord, rowIdx) => {
                  const childPk =
                    childRecord.values[joinTableMetaData.primaryKeyField] as string | number
                  const recordHref = joinTableMetaData.readPermission && childPk !== undefined
                    ? `/app/${encodeURIComponent(joinTableMetaData.name)}/${encodeURIComponent(String(childPk))}${fromParamsFirst}`
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

          {/* Show more — reveals next batch of PAGE_SIZE records */}
          {visibleCount < records.length && (
            <div className="flex items-center justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium',
                  'text-muted-foreground bg-card hover:bg-accent hover:text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                  'transition-colors duration-150'
                )}
                data-qqq-id={`button-show-more-${joinTableMetaData.name}`}
                aria-label={`Show more ${label} records`}
              >
                Show more ({records.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
      {/* Create child record dialog */}
      {joinTableMetaData.insertPermission && fixedValues && (
        <CreateChildRecordDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          joinTableMetaData={joinTableMetaData}
          fixedValues={fixedValues}
          associationId={associationId}
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
 * Fixed relationship fields are validated and submitted independently of editable inputs.
 *
 * @param props - Component properties.
 * @returns A Radix Dialog portal with an EntityForm for the join table.
 */
function CreateChildRecordDialog({
  open,
  onOpenChange,
  joinTableMetaData,
  fixedValues,
  associationId,
  onRecordCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  joinTableMetaData: QTableMetaData
  fixedValues: Record<string, string | number | boolean>
  associationId: string
  onRecordCreated?: () => void
}) {
  const fieldNamesToInclude = Object.values(joinTableMetaData.fields)
    .filter((field) => !field.isHidden && field.isEditable && !Object.prototype.hasOwnProperty.call(fixedValues, field.name))
    .map((field) => field.name)

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
          data-qqq-id={`dialog-create-association-${associationId}`}
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
              saveButtonLabel="Create"
              fixedValues={fixedValues}
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
