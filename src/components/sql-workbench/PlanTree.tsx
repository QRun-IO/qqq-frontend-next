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
 * expensive node. A toggle shows the raw plan text.
 */

'use client'

import React, { useState } from 'react'

import type { SqlExplainResponse, SqlPlanNode } from '@/types'
import { planMax } from '@/lib/utils/sql-workbench'

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
      <span className="font-medium">{node.label}</span>
      {node.detail && <span className="text-muted-foreground">{node.detail}</span>}
      {node.totalCost !== null && (
        <span className="font-mono text-xs">
          cost {n(node.startupCost)}..{n(node.totalCost)}
        </span>
      )}
      {node.planRows !== null && <span className="font-mono text-xs">rows {n(node.planRows)}</span>}
      {node.actualTimeMs !== null && (
        <span className="font-mono text-xs">
          actual {n(node.actualTimeMs)} ms · {n(node.actualRows)} rows × {n(node.loops)}
        </span>
      )}
      {width > 0 && (
        <span className="inline-block h-1.5 w-24 rounded bg-muted" aria-hidden>
          <span className="block h-1.5 rounded bg-primary" style={{ width: `${width}%` }} />
        </span>
      )}
    </span>
  )
  return (
    <li className="my-1">
      <details open>
        <summary className="cursor-pointer">{summary}</summary>
        {extras.length > 0 && (
          <dl className="ml-4 grid grid-cols-[auto_1fr] gap-x-2 text-xs text-muted-foreground">
            {extras.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt>{k}</dt>
                <dd className="truncate font-mono">
                  {typeof v === 'string' ? v : JSON.stringify(v)}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        )}
        {node.children.length > 0 && (
          <ul className="ml-4 border-l pl-3">
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
      <p className="text-sm text-destructive" role="alert">
        {explain.error ?? 'The plan could not be produced.'}
      </p>
    )
  }
  const useActual = explain.analyze === true
  const max = planMax(explain.plan, useActual)
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {explain.analyze ? 'EXPLAIN ANALYZE (executed, rolled back)' : 'EXPLAIN (estimated)'}
        </span>
        <button
          type="button"
          className="ml-auto rounded border px-2 py-0.5"
          onClick={() => setRaw(!raw)}
          data-qqq-id="button-sql-plan-raw"
        >
          {raw ? 'Tree' : 'Raw'}
        </button>
      </div>
      {raw ? (
        <pre className="max-h-96 overflow-auto rounded bg-muted p-2 font-mono text-xs">
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
