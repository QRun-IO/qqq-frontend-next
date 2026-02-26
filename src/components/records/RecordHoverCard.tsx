'use client'

// RecordHoverCard — hover preview card for linked record references
// Shows a compact preview of the referenced record with key fields
// Fetches record data lazily on hover via TanStack Query

import React, { type ReactNode } from 'react'
import Link from 'next/link'
import * as HoverCardPrimitive from '@radix-ui/react-hover-card'
import { Loader2, ArrowRight, ExternalLink } from 'lucide-react'

import type { QTableMetaData } from '@/types'
import { useRecord } from '@/lib/hooks/use-record'
import { cn } from '@/lib/utils/cn'

interface RecordHoverCardProps {
  /** The table name of the referenced record */
  tableName: string
  /** The primary key value of the referenced record */
  primaryKey: string | number
  /** Table metadata for the referenced record — used to display field labels */
  tableMetaData: QTableMetaData
  /** Source page info for back navigation — appended to the "View" link */
  navigateFrom?: { path: string; label: string }
  /** The trigger element (typically the link text) */
  children: ReactNode
}

/** Extract up to two uppercase initials from a label string */
function getInitials(label: string): string {
  const words = label.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return label.slice(0, 2).toUpperCase()
}

export function RecordHoverCard({
  tableName,
  primaryKey,
  tableMetaData,
  navigateFrom,
  children,
}: RecordHoverCardProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const { record, isLoading } = useRecord({
    tableName,
    primaryKey,
    enabled: isOpen,
    includeAssociations: false,
    staleTime: 1000 * 60 * 10, // 10 min cache — previews rarely change
  })

  // Get the first visible T1 fields to preview (up to 5)
  const t1Sections = tableMetaData.sections.filter(
    (s) => !s.isHidden && (!s.tier || s.tier === 'T1' || s.tier === 'basic')
  )
  const previewFieldNames = t1Sections.length > 0
    ? t1Sections.flatMap((s) => s.fieldNames)
    : Object.keys(tableMetaData.fields)

  const previewFields = previewFieldNames
    .map((fn) => tableMetaData.fields[fn])
    .filter((f) => f && !f.isHidden && !f.isHeavy && f.name !== tableMetaData.primaryKeyField)
    .slice(0, 5)

  const recordLabel = record?.recordLabel || `${tableMetaData.label} #${primaryKey}`
  const fromParams = navigateFrom
    ? `?from=${encodeURIComponent(navigateFrom.path)}&fromLabel=${encodeURIComponent(navigateFrom.label)}`
    : ''
  const href = `/app/${tableName}/${primaryKey}${fromParams}`

  return (
    <HoverCardPrimitive.Root
      openDelay={400}
      closeDelay={200}
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <HoverCardPrimitive.Trigger asChild>
        {children}
      </HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          side="top"
          align="start"
          sideOffset={8}
          className={cn(
            'z-50 w-72 rounded-xl border border-border bg-card p-4 shadow-lg',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            'data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2'
          )}
        >
          {isLoading || !record ? (
            <div className="flex items-center gap-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Header — avatar + record label */}
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                  aria-hidden="true"
                >
                  {getInitials(recordLabel)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {recordLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tableMetaData.label}
                  </p>
                </div>
              </div>

              {/* Preview fields */}
              {previewFields.length > 0 && (
                <dl className="space-y-1.5 border-t border-border pt-3">
                  {previewFields.map((field) => {
                    const displayVal = record.displayValues?.[field.name]
                    const rawVal = record.values[field.name]
                    const val = displayVal ?? (rawVal != null ? String(rawVal) : null)
                    // Skip fields already in the record label
                    if (val && recordLabel.includes(val)) return null
                    return (
                      <div key={field.name} className="flex items-baseline justify-between gap-2">
                        <dt className="flex-shrink-0 text-xs text-muted-foreground">
                          {field.label}
                        </dt>
                        <dd className="truncate text-xs text-right">
                          {val == null ? '\u2014' : /^https?:\/\//i.test(val) ? (
                            <a
                              href={val}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:text-primary/80 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {val.replace(/^https?:\/\//, '')}
                              <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
                            </a>
                          ) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? (
                            <a
                              href={`mailto:${val}`}
                              className="text-primary hover:text-primary/80 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {val}
                            </a>
                          ) : (
                            <span className="text-foreground">{val}</span>
                          )}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              )}

              {/* Footer link */}
              <div className="border-t border-border pt-2">
                <Link
                  href={href}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                >
                  View Record
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
          <HoverCardPrimitive.Arrow className="fill-border" />
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  )
}
