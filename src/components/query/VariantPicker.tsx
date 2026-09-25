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
 * @file VariantPicker — dialog for choosing the backend variant of a table whose backend uses
 * variants (Material's TableVariantDialog). Options come from `GET /data/{table}/variants`.
 */

'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Check, Loader2 } from 'lucide-react'

import { fetchTableVariants, type TableVariant } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'
import { cn } from '@/lib/utils/cn'

/**
 * Props for the VariantPicker dialog.
 */
export interface VariantPickerProps {
  /** Whether the dialog is open. */
  open: boolean
  /** Table whose variants are listed. */
  tableName: string
  /** Label of the variant options table (for example "Store"). */
  variantTableLabel: string
  /** The currently selected variant, if any. */
  selected?: TableVariant | null
  /** Called when the user dismisses the dialog without choosing. */
  onCancel: () => void
  /** Called with the chosen variant. */
  onSelect: (variant: TableVariant) => void
}

/**
 * Variant selection dialog with a type-to-filter list.
 *
 * @param props - Component properties.
 * @returns The dialog.
 */
export function VariantPicker({ open, tableName, variantTableLabel, selected, onCancel, onSelect }: VariantPickerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [highlighted, setHighlighted] = useState<TableVariant | null>(selected ?? null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const variantsQuery = useQuery({
    queryKey: [...queryKeys.tableRecords(tableName), 'variants'],
    queryFn: () => fetchTableVariants(tableName),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (open) {
      setSearchTerm('')
      setHighlighted(selected ?? null)
    }
  }, [open, selected])

  const variants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return (variantsQuery.data ?? []).filter((v) => !term || String(v.name ?? v.id).toLowerCase().includes(term))
  }, [variantsQuery.data, searchTerm])
  const same = (a: TableVariant | null | undefined, b: TableVariant) => Boolean(a) && String(a!.id) === String(b.id) && a!.type === b.type

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          data-qqq-id="variant-picker-dialog"
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card shadow-lg focus:outline-none"
          aria-describedby="variant-picker-description"
          onOpenAutoFocus={(e) => { e.preventDefault(); searchInputRef.current?.focus() }}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{variantTableLabel}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button type="button" aria-label="Close dialog" className="rounded-md p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </DialogPrimitive.Close>
          </div>

          <div className="space-y-4 px-6 py-4">
            <p id="variant-picker-description" className="text-sm text-muted-foreground">
              Select the {variantTableLabel} to be used on this table:
            </p>
            <div className="relative">
              <label htmlFor="variant-search" className="sr-only">Filter {variantTableLabel} options</label>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                ref={searchInputRef}
                id="variant-search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Filter ${variantTableLabel}...`}
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                data-qqq-id="variant-search-input"
              />
            </div>

            {variantsQuery.isLoading && (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading {variantTableLabel} options...
              </p>
            )}
            {variantsQuery.isError && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {variantTableLabel} options could not be loaded.
              </p>
            )}
            {variantsQuery.isSuccess && variants.length === 0 && (
              <p role="status" className="py-2 text-center text-sm text-muted-foreground">No {variantTableLabel} options found.</p>
            )}
            {variants.length > 0 && (
              <div role="listbox" aria-label={`${variantTableLabel} options`} className="max-h-60 overflow-y-auto rounded-md border border-border bg-background">
                {variants.map((variant) => {
                  const isSelected = same(highlighted, variant)
                  return (
                    <button
                      key={`${variant.type}-${variant.id}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => setHighlighted(variant)}
                      onDoubleClick={() => onSelect(variant)}
                      className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring',
                        isSelected ? 'bg-primary/10 font-medium text-primary' : 'text-foreground hover:bg-accent')}
                      data-qqq-id={`variant-option-${variant.id}`}
                    >
                      <span className="flex-1 truncate">{variant.name ?? String(variant.id)}</span>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 rounded-b-lg border-t border-border bg-muted px-6 py-4">
            <button type="button" onClick={onCancel} data-qqq-id="variant-picker-cancel"
              className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              Cancel
            </button>
            <button type="button" onClick={() => highlighted && onSelect(highlighted)} disabled={!highlighted} data-qqq-id="variant-picker-select"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              Select
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
