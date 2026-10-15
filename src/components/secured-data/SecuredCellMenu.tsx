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

/** @file Keyboard and context-menu access to a grid cell's audited reveal. */
'use client'
import { useState, useRef, type ReactNode } from 'react'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import type { QFieldMetaData, QRecord, QTableMetaData } from '@/types'
import { useSecuredData } from './SecuredDataProvider'

/**
 * Offer Reveal only for a known record key and installed extension.
 * @param props - Component inputs.
 * @returns The rendered UI or current secured-data context.
 */
export function SecuredCellMenu({
  children,
  field,
  record,
  table,
}: {
  children: ReactNode
  field: QFieldMetaData
  record: QRecord
  table?: QTableMetaData
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const secured = useSecuredData()
  const [open, setOpen] = useState(false)
  const key = table ? record.values[table.primaryKeyField] : undefined
  if (
    !secured.installed ||
    field.accessTier !== 'REVEALABLE' ||
    !table ||
    (typeof key !== 'string' && typeof key !== 'number')
  )
    return children
  return (
    <Dropdown.Root open={open} onOpenChange={setOpen} modal={false}>
      <span
        className="flex min-w-0 items-center gap-1"
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(true)
        }}
      >
        <span className="min-w-0 flex-1">{children}</span>
        <Dropdown.Trigger asChild>
          <button
            ref={trigger}
            type="button"
            aria-label={`${field.label} value menu`}
            onClick={(event) => event.stopPropagation()}
            className="shrink-0 rounded p-1 hover:bg-accent"
            data-qqq-id={`cell-menu-${field.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </Dropdown.Trigger>
      </span>
      <Dropdown.Portal>
        <Dropdown.Content
          className="z-50 rounded border border-border bg-popover p-1 text-popover-foreground shadow-md"
          onClick={(event) => event.stopPropagation()}
        >
          <Dropdown.Item
            className="cursor-pointer rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-accent"
            data-qqq-id="cell-reveal"
            onSelect={() => {
              trigger.current?.focus()
              secured.request({
                tableName: table.name,
                primaryKey: key,
                fieldName: field.name,
                maskedValue: record.displayValues?.[field.name] ?? record.values[field.name],
              })
            }}
          >
            Reveal
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
