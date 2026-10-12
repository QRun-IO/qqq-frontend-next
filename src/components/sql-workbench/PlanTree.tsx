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
 * @file PlanTree — a query plan as a collapsible tree: each node's operation, target, cost range,
 * estimated rows and (with ANALYZE) actual time, rows and loops, with a bar scaled to the most
 * expensive node. A toggle button shows the raw plan text instead.
 */

'use client'

import React, { useState } from 'react'

import type { SqlExplainResponse, SqlPlanNode } from '@/types'
import { planMax } from '@/lib/utils/sql-workbench'
import { cn } from '@/lib/utils/cn'
import { ALERT_CLASS, buttonClass } from '@/components/ui/controls'

/**
 * Formats a plan number.
 *
 * @param value - The number.
 * @returns Up to two decimals, or an empty string.
 */
function n(value: number | null): string {
  return value === null || value === undefined ? '' : Number(value.toFixed(2)).toLocaleString()
}

/**
 * Renders one node and its children.
 *
 * @param props - Component props.
 * @param props.node - The node.
 * @param props.max - The plan's largest cost or time.
 * @param props.useActual - Scale bars by actual time.
 * @returns The node as a list item.
 */
function PlanNodeItem({
  node,
  max,
  useActual,
}: {
  node: SqlPlanNode
  max: number
  useActual: boolean
}) {
  const value = (useActual ? node.actualTimeMs : node.totalCost) ?? 0
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  const extras = Object.entries(node.extra ?? {})
  const summary = (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-0.5">
      <span className="font-semibold text-foreground">{node.label}</span>
      {node.detail && <span className="text-muted-foreground">{node.detail}</span>}
      {node.totalCost !== null && (
        <span className="font-mono text-xs text-muted-foreground">
          cost {n(node.startupCost)}..{n(node.totalCost)}
        </span>
      )}
      {node.planRows !== null && (
        <span className="font-mono text-xs text-muted-foreground">rows {n(node.planRows)}</span>
      )}
      {node.actualTimeMs !== null && (
        <span className="font-mono text-xs text-foreground">
          actual {n(node.actualTimeMs)} ms · {n(node.actualRows)} rows × {n(node.loops)}
        </span>
      )}
      {width > 0 && (
        <span className="inline-block h-1.5 w-24 rounded-full bg-muted" aria-hidden>
          {/* the bar's length is data, so it is the one inline style */}
          <span className="block h-1.5 rounded-full bg-primary" style={{ width: `${width}%` }} />
        </span>
      )}
    </span>
  )
  return (
    <li className="my-1.5">
      <details open>
        <summary className="cursor-pointer rounded-md px-1 py-0.5 marker:text-muted-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {summary}
        </summary>
        {extras.length > 0 && (
          <dl className="ml-5 mt-0.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-xs text-muted-foreground">
            {extras.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt>{k}</dt>
                <dd className="break-words font-mono text-foreground">
                  {typeof v === 'string' ? v : JSON.stringify(v)}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        )}
        {node.children.length > 0 && (
          <ul className="ml-3 border-l border-border pl-3">
            {node.children.map((child, i) => (
              <PlanNodeItem key={i} node={child} max={max} useActual={useActual} />
            ))}
          </ul>
        )}
      </details>
    </li>
  )
}

/**
 * Renders an EXPLAIN response.
 *
 * @param props - Component props.
 * @param props.explain - The response.
 * @returns The tree, the raw text, or the error.
 */
export function PlanTree({ explain }: { explain: SqlExplainResponse }) {
  const [raw, setRaw] = useState(false)
  if (explain.status !== 'SUCCEEDED' || !explain.plan) {
    return (
      <p className={ALERT_CLASS} role="alert">
        {explain.error ?? 'The plan could not be produced.'}
      </p>
    )
  }
  const useActual = explain.analyze === true
  const max = planMax(explain.plan, useActual)
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          {explain.analyze
            ? 'Actual plan: the statement ran and was rolled back'
            : 'Estimated plan'}
        </span>
        <button
          type="button"
          className={cn(buttonClass('secondary', 'sm'), 'ml-auto')}
          aria-pressed={raw}
          onClick={() => setRaw(!raw)}
          data-qqq-id="button-sql-plan-raw"
        >
          Raw text
        </button>
      </div>
      {raw ? (
        <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-3 font-mono text-xs text-foreground">
          {explain.raw}
        </pre>
      ) : (
        <ul aria-label="Query plan">
          <PlanNodeItem node={explain.plan} max={max} useActual={useActual} />
        </ul>
      )}
    </div>
  )
}
