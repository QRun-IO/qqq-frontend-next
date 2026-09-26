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
 * @file CreateChildFromLinkDialog — the create form that a Material `#/createChild=` link
 * (backend HTML widgets, child record lists) opens over a record view.
 */

'use client'

import React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'

import type { HashFormPresets } from '@/lib/utils/material-links'
import { lockedPresetValues } from '@/lib/utils/material-links'
import { canInsertRecords, hasCapability } from '@/lib/auth/permissions'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { cn } from '@/lib/utils/cn'
import { EntityForm } from '@/components/forms/EntityForm'

/** Props for {@link CreateChildFromLinkDialog}. */
interface CreateChildFromLinkDialogProps {
  /** Child table named by the link. */
  tableName: string
  /** Default and locked field values from the link. */
  presets: HashFormPresets
  /** Closes the dialog (and clears the link's hash). */
  onClose: () => void
  /** Called after the child record is created, so the parent can reload its children. */
  onCreated: () => void
}

/**
 * Loads the child table and shows its create form with the link's presets: default values
 * filled in, `disabledFields` shown read-only and always submitted.
 *
 * @param props - See {@link CreateChildFromLinkDialogProps}.
 * @returns A modal dialog.
 */
export function CreateChildFromLinkDialog({ tableName, presets, onClose, onCreated }: CreateChildFromLinkDialogProps) {
  const { data: table, isError, isLoading } = useTableMetaData(tableName)
  // widget-driven form sections (such as a cron schedule editor) need the instance widgets, as on the create page
  const { data: metaData } = useQuery({ queryKey: queryKeys.metadataAll(), queryFn: loadMetaData, staleTime: 1000 * 60 * 30 })

  let body: React.ReactNode
  if (isLoading) {
    body = <p role="status" className="px-6 py-8 text-sm text-muted-foreground">Loading...</p>
  } else if (isError || !table) {
    body = <p role="alert" className="px-6 py-8 text-sm text-destructive">This record type is unavailable.</p>
  } else if (!canInsertRecords(table)) {
    body = (
      <p role="alert" className="px-6 py-8 text-sm text-yellow-700" data-qqq-id="permission-denied">
        {!hasCapability(table, 'TABLE_INSERT') ? `${table.label} records cannot be created.` : `You do not have permission to create ${table.label} records.`}
      </p>
    )
  } else {
    body = (
      <EntityForm
        tableMetaData={table}
        widgets={metaData?.widgets}
        isModal
        saveButtonLabel="Create"
        defaultValues={presets.defaultValues}
        disabledFieldNames={presets.disabledFields}
        fixedValues={lockedPresetValues(table, presets)}
        onSuccess={() => {
          onCreated()
          onClose()
        }}
        onCancel={onClose}
      />
    )
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            // a margin at the screen edges on phones (QRun-IO/qqq#708)
            'flex max-h-[85vh] w-[calc(100%-2rem)] max-w-xl flex-col',
            'rounded-xl border border-border bg-card shadow-lg'
          )}
          aria-describedby={undefined}
          data-qqq-id={`dialog-create-child-${tableName}`}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-foreground">
              Add {table?.label ?? 'Record'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto">{body}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
