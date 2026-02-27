'use client'

/** EmptyState — reusable placeholder shown when a query returns zero results or no data is available. */

import React, { type ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Props for the EmptyState component.
 */
export interface EmptyStateProps {
  /** The primary heading text describing the empty state (e.g. "No records found"). */
  title: string
  /** Optional supporting text explaining why the list is empty or what the user can do. */
  description?: string
  /** Optional custom icon node; defaults to the `Inbox` Lucide icon when not provided. */
  icon?: ReactNode
  /** Optional primary call-to-action rendered as a button below the description. */
  action?: { label: string; onClick: () => void }
  /** Additional Tailwind class names applied to the outermost container div. */
  className?: string
}

/**
 * Renders a centered empty-state placeholder with an icon, title, optional description,
 * and an optional call-to-action button.
 *
 * Uses `role="status"` and `aria-live="polite"` so screen readers announce
 * the state when it appears after a data load.
 *
 * @param title - Primary heading shown in the empty state.
 * @param description - Optional supplementary text below the title.
 * @param icon - Custom icon node; defaults to `<Inbox>` when omitted.
 * @param action - Optional button configuration `{ label, onClick }`.
 * @param className - Additional class names applied to the container.
 * @returns A bordered dashed container centered in its parent.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center',
        className
      )}
      data-qqq-id="empty-state"
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>

      {/* Title */}
      <h3
        className="text-sm font-semibold text-foreground"
        data-qqq-id="empty-state-title"
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className="mt-1 max-w-xs text-sm text-muted-foreground"
          data-qqq-id="empty-state-description"
        >
          {description}
        </p>
      )}

      {/* Action button */}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={cn(
            'mt-4 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'transition-colors duration-150'
          )}
          data-qqq-id="button-empty-state-action"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
