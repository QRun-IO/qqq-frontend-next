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

/** @file Shared accessible profile sheet, metric cards, value lists and loading states. */
'use client'

import { createContext, useContext, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import type {
  DataAnalysisDrillV1,
  DataAnalysisMetricV1,
  DataAnalysisValueCountV1,
} from '@/types/data-analysis'
import { drillHref, metricText } from '@/lib/utils/data-analysis'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import { HintTooltip } from '@/components/query/HintTooltip'

export const AnalysisNavigationContext = createContext<() => void>(() => undefined)

/**
 * Applies a drill in place when the host can (e.g. the query page already showing that table, whose
 * URL state is read only on mount). Returns true when handled; otherwise the link navigates.
 */
export const AnalysisDrillContext = createContext<((drill: DataAnalysisDrillV1) => boolean) | null>(
  null
)

export const controlClass =
  'rounded border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50'

/** A modal right-hand sheet with exactly one scrolling body.
 * @param props - Heading, summary, content and close action.
 * @returns The accessible sheet.
 */
export function ProfileSheet({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description: string
  onClose: () => void
  children: ReactNode
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  return (
    <AnalysisNavigationContext.Provider value={onClose}>
      <Dialog.Root
        open
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[170] bg-black/40" />
          <Dialog.Content
            ref={contentRef}
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              contentRef.current?.focus()
            }}
            className="fixed inset-y-0 right-0 z-[180] flex h-dvh w-full flex-col overflow-hidden border-l border-border bg-background text-foreground shadow-xl outline-none min-[900px]:w-[560px]"
            data-qqq-id="data-analysis-panel"
          >
            <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-border bg-background p-5">
              <div className="min-w-0 break-words">
                <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">
                  {description}
                </Dialog.Description>
              </div>
              <Dialog.Close
                className={controlClass}
                aria-label="Close analysis"
                data-qqq-id="analysis-close"
              >
                Close
              </Dialog.Close>
            </header>
            <div
              className="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden p-5 [overflow-wrap:anywhere]"
              data-qqq-id="analysis-body"
            >
              {children}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AnalysisNavigationContext.Provider>
  )
}

/** Links only when the API supplies an actionable drill.
 * @param props - Drill and visible content.
 * @returns A navigation link or plain content.
 */
export function DrillLink({
  drill,
  children,
}: {
  drill?: DataAnalysisDrillV1
  children: ReactNode
}) {
  const close = useContext(AnalysisNavigationContext)
  const applyDrill = useContext(AnalysisDrillContext)
  const href = drillHref(drill)
  return href ? (
    <Link
      href={href}
      onClick={(event) => {
        if (drill && !event.metaKey && !event.ctrlKey && !event.shiftKey && applyDrill?.(drill))
          event.preventDefault()
        close()
      }}
      data-qqq-id="analysis-drill"
      className="underline decoration-primary/50 underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children}
    </Link>
  ) : (
    <>{children}</>
  )
}

/** Renders a metric with suppression taking priority over drill and formatted value.
 * @param props - Metric.
 * @returns The value or an accessible suppression hint.
 */
export function MetricValue({ metric }: { metric: DataAnalysisMetricV1 }) {
  if (metric?.suppressed)
    return (
      <HintTooltip content={metric.suppressedReason ?? 'This value is suppressed.'}>
        <span tabIndex={0} data-qqq-id="analysis-hidden" className="cursor-help">
          Hidden
        </span>
      </HintTooltip>
    )
  return <DrillLink drill={metric?.drill}>{metricText(metric)}</DrillLink>
}

/** Wraps semantic metrics in a responsive grid.
 * @param props - Metrics.
 * @returns Metric cards.
 */
export function Metrics({ metrics }: { metrics?: DataAnalysisMetricV1[] | null }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-3">
      {metrics?.map(
        (metric, index) => metric && <MetricCard key={metric.key ?? index} metric={metric} />
      )}
    </div>
  )
}

/** Displays the backend's label and formatted value in a wrapping metric card.
 * @param props - Semantic metric.
 * @returns A metric card shared by column and table profiles.
 */
export function MetricCard({ metric }: { metric: NonNullable<DataAnalysisMetricV1> }) {
  return (
    <div className="min-w-0 rounded border border-border p-3">
      <div className="text-sm text-muted-foreground">{metric.label}</div>
      <div className="mt-1 break-words text-xl font-semibold tabular-nums">
        <MetricValue metric={metric} />
      </div>
    </div>
  )
}

/** Lists labeled values and shares, using only server-provided drills.
 * @param props - Values and section label.
 * @returns A value list.
 */
export function Values({
  values,
  label,
}: {
  values?: DataAnalysisValueCountV1[] | null
  label: string
}) {
  if (!values?.length) return null
  return (
    <section aria-label={label} className="space-y-3">
      <h3 className="font-semibold">{label}</h3>
      <ul className="space-y-3">
        {values.map(
          (value, index) =>
            value && (
              <li key={index}>
                <DrillLink drill={value.drill}>
                  <span className="flex justify-between gap-3">
                    <span>{value.label ?? 'Unlabeled value'}</span>
                    <span>{value.count?.toLocaleString() ?? '—'}</span>
                  </span>
                </DrillLink>
                {value.share != null && (
                  <div
                    className="mt-1 h-1.5 rounded bg-muted"
                    role="img"
                    aria-label={`${Math.round(value.share * 100)}% share`}
                  >
                    <div
                      className="h-full rounded bg-primary"
                      style={{ width: `${Math.max(0, Math.min(100, value.share * 100))}%` }}
                    />
                  </div>
                )}
              </li>
            )
        )}
      </ul>
    </section>
  )
}

/** Common estimate and freshness labels.
 * @param props - Profile metadata.
 * @returns Badges and warnings.
 */
export function ProfileBadges({
  profile,
}: {
  profile: {
    estimate?: boolean | null
    asOf?: string | null
    warnings?: string[] | null
    sampleRows?: number | null
    truncated?: boolean | null
  }
}) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {profile.estimate && (
          <HintTooltip
            content={
              profile.warnings?.join(' ') || 'Statistics describe a sample of the filtered records.'
            }
          >
            <span
              tabIndex={0}
              data-qqq-id="analysis-estimate"
              className="rounded border border-border px-2 py-1"
            >
              Estimate
            </span>
          </HintTooltip>
        )}
        {profile.estimate && profile.sampleRows != null && (
          <span>{profile.sampleRows.toLocaleString()} sampled rows</span>
        )}
        {profile.asOf && (
          <span>
            As of <time dateTime={profile.asOf}>{new Date(profile.asOf).toLocaleString()}</time>
          </span>
        )}
      </div>
      {profile.truncated && <p>Row limit reached; this profile is incomplete.</p>}
      {Boolean(profile.warnings?.length) && (
        <div role="note" className="text-xs text-muted-foreground">
          <ul className="list-disc space-y-1 pl-4">
            {profile.warnings?.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Loading skeleton.
 * @returns Loading status.
 */
export function ProfileLoading() {
  return (
    <div role="status" aria-label="Loading analysis" className="space-y-3">
      <p>Loading analysis…</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded bg-muted" />
      ))}
    </div>
  )
}

/** Actionable API error, with explicit permission wording.
 * @param props - Error and optional retry action.
 * @returns The error message.
 */
export function ProfileError({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div role="alert" className="space-y-2">
      <p>
        {getErrorStatusCode(error) === 403
          ? "You don't have permission to analyze this table"
          : error instanceof Error
            ? error.message
            : 'Could not load analysis.'}
      </p>
      {retry && (
        <button className={controlClass} onClick={retry} data-qqq-id="analysis-retry">
          Try again
        </button>
      )}
    </div>
  )
}
