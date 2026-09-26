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
 * @file RecordActions — the record view's action controls: Edit and Delete buttons, the
 * table's additional menus, and the Actions menu (the table's own or the Material default).
 */

'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ChevronRight, Copy, MoreVertical, Pencil, Trash2 } from 'lucide-react'

import type { QTableMetaData, QRecord, QTableMenu } from '@/types'
import { cn } from '@/lib/utils/cn'
import { MATERIAL_BUTTON_VARIANTS, sanitizeQqqId } from '@/lib/utils/qqq-id'
import { canDeleteRecords, canEditRecords, canInsertRecords } from '@/lib/auth/permissions'
import { recordAdditionalMenus, hasMenuItems, type RecordMenuAction, type RecordMenuEntry } from '@/lib/utils/record-menu-utils'
import { MetadataIcon } from '@/components/layout/MetadataIcon'

import { RecordMenuIcon } from './RecordMenuIcon'

/** Props for {@link RecordActions}. */
interface RecordActionsProps {
  tableMetaData: QTableMetaData
  record: QRecord
  /** The resolved Actions menu (see `resolveRecordMenu`). */
  actionEntries: RecordMenuEntry[]
  /** Resolves one of the table's additional menus into entries. */
  resolveMenu: (menu: QTableMenu) => RecordMenuEntry[]
  /** Runs a chosen action (navigation, the delete and audit dialogs, downloads, processes). */
  onAction: (action: RecordMenuAction) => void
  className?: string
}

const BUTTON_CLASSES = cn(
  'inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-input px-3 py-2 text-sm font-medium',
  'text-foreground bg-card hover:bg-accent',
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  'transition-colors duration-150'
)

const ITEM_CLASSES = cn(
  'relative flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm text-foreground',
  'outline-none data-[highlighted]:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
  'transition-colors duration-100'
)

const CONTENT_CLASSES = cn(
  'z-50 min-w-[200px] overflow-hidden rounded-md border border-border bg-card py-1 shadow-lg',
  'animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2'
)

/**
 * Menu entries as Radix dropdown items, with sub-menus and separators.
 *
 * @param props - Component properties.
 * @param props.entries - Resolved entries.
 * @param props.onAction - Runs a chosen action.
 * @returns The items.
 */
export function RecordMenuItems({ entries, onAction }: { entries: RecordMenuEntry[]; onAction: (action: RecordMenuAction) => void }) {
  return (
    <>
      {entries.map((entry) => {
        if (entry.kind === 'divider') {
          return <DropdownMenuPrimitive.Separator key={entry.key} className="my-1 h-px bg-border" />
        }
        if (entry.kind === 'submenu') {
          return (
            <DropdownMenuPrimitive.Sub key={entry.key}>
              <DropdownMenuPrimitive.SubTrigger className={cn(ITEM_CLASSES, 'justify-between')} data-qqq-id={`menu-item-${sanitizeQqqId(entry.id)}`}>
                <span className="flex items-center gap-2">
                  {entry.iconName ? <MetadataIcon iconName={entry.iconName} /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                  {entry.label}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </DropdownMenuPrimitive.SubTrigger>
              <DropdownMenuPrimitive.Portal>
                <DropdownMenuPrimitive.SubContent className={CONTENT_CLASSES} sideOffset={2} data-qqq-id={`record-submenu-${entry.id}`}>
                  <RecordMenuItems entries={entry.entries} onAction={onAction} />
                </DropdownMenuPrimitive.SubContent>
              </DropdownMenuPrimitive.Portal>
            </DropdownMenuPrimitive.Sub>
          )
        }
        return (
          <DropdownMenuPrimitive.Item
            key={entry.key}
            disabled={entry.disabled}
            onSelect={() => onAction(entry.action)}
            data-qqq-id={`menu-item-${sanitizeQqqId(entry.id)}`}
            className={cn(ITEM_CLASSES, entry.action.type === 'delete' && 'text-destructive data-[highlighted]:bg-destructive/10')}
          >
            <RecordMenuIcon entry={entry} />
            {entry.label}
          </DropdownMenuPrimitive.Item>
        )
      })}
    </>
  )
}

/**
 * The record view's action controls, as in the Material dashboard: Edit and Delete buttons for
 * quick access (Material's button bar), a button per `VIEW_SCREEN_ADDITIONAL` menu, and the
 * Actions menu.
 *
 * @param props - {@link RecordActionsProps}
 * @returns The controls.
 */
export function RecordActions({ tableMetaData, record, actionEntries, resolveMenu, onAction, className }: RecordActionsProps) {
  const router = useRouter()

  const primaryKey = record.values[tableMetaData.primaryKeyField] as string | number
  const canEdit = canEditRecords(tableMetaData)
  const canCopy = canInsertRecords(tableMetaData)
  const canDelete = canDeleteRecords(tableMetaData)

  const additionalMenus = recordAdditionalMenus(tableMetaData)
    .map((menu, index) => ({ menu, index, entries: resolveMenu(menu) }))
    .filter(({ entries }) => hasMenuItems(entries))

  return (
    <div className={cn('flex items-center gap-2', className)} data-qqq-id={`record-view-button-bar-${sanitizeQqqId(tableMetaData.name)}`}>
      {canEdit && (
        <button
          type="button"
          onClick={() => router.push(`/app/${encodeURIComponent(tableMetaData.name)}/${encodeURIComponent(String(primaryKey))}/edit`)}
          data-qqq-id="button-edit"
          data-button-variant={MATERIAL_BUTTON_VARIANTS.edit}
          aria-label={`Edit ${tableMetaData.label} record`}
          className={BUTTON_CLASSES}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </button>
      )}

      {canCopy && (
        <button
          type="button"
          onClick={() => router.push(`/app/${encodeURIComponent(tableMetaData.name)}/${encodeURIComponent(String(primaryKey))}/copy`)}
          data-qqq-id="button-copy"
          data-button-variant={MATERIAL_BUTTON_VARIANTS.edit}
          aria-label={`Copy ${tableMetaData.label} record`}
          className={BUTTON_CLASSES}
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copy
        </button>
      )}

      {canDelete && (
        <button
          type="button"
          onClick={() => onAction({ type: 'delete' })}
          data-qqq-id="button-delete"
          data-button-variant={MATERIAL_BUTTON_VARIANTS.delete}
          aria-label={`Delete ${tableMetaData.label} record`}
          className={cn(BUTTON_CLASSES, 'border-destructive/30 text-destructive hover:bg-destructive/10')}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </button>
      )}

      {additionalMenus.map(({ menu, index, entries }) => (
        <DropdownMenuPrimitive.Root key={index}>
          <DropdownMenuPrimitive.Trigger asChild>
            <button type="button" data-qqq-id={`record-additional-menu-${index}`} className={BUTTON_CLASSES}>
              {menu.icon?.name && <MetadataIcon icon={menu.icon} />}
              {menu.label || 'More'}
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </DropdownMenuPrimitive.Trigger>
          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content align="end" sideOffset={4} className={CONTENT_CLASSES}>
              <RecordMenuItems entries={entries} onAction={onAction} />
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>
      ))}

      {hasMenuItems(actionEntries) && (
        <span className="contents" data-qqq-id="record-view-actions-menu-button">
        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger asChild>
            <button type="button" data-qqq-id="button-actions-menu" data-button-variant={MATERIAL_BUTTON_VARIANTS['actions-menu']} aria-label="Record actions menu" className={BUTTON_CLASSES}>
              Actions
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </button>
          </DropdownMenuPrimitive.Trigger>
          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content align="end" sideOffset={4} className={CONTENT_CLASSES} data-qqq-id="record-view-actions-menu">
              <RecordMenuItems entries={actionEntries} onAction={onAction} />
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>
        </span>
      )}
    </div>
  )
}
