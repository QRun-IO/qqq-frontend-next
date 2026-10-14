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

/** @file Lazy Recharts rendering for small assistant presentation charts. */
'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { AssistantPresentationChart as ChartBlock } from '@/types/assistant'
import { internalAppHref } from '@/lib/utils/assistant-links'
import { PresentationLink } from './AssistantPresentation'

const COLORS = Array.from({ length: 5 }, (_, index) => `var(--color-chart-${index + 1})`)
const TICK = { fontSize: 11, fill: 'var(--color-muted-foreground)' }

/**
 * Plots values and provides equivalent keyboard-accessible links and data for every point.
 * @param props - The chart payload.
 * @returns A themed chart no taller than 200px, with a screen-reader data list.
 */
export function AssistantPresentationChart({ block }: { block: ChartBlock }) {
  const router = useRouter()
  const label = `${block.title ?? `${block.chartType} chart`}: ${block.points.map((point) => `${point.label}: ${point.display ?? point.value}`).join('; ')}`
  const navigate = (index: number) => {
    const href = internalAppHref(block.points[index]?.href)
    if (href) router.push(href)
  }
  const tooltip = <Tooltip contentStyle={{ background: 'var(--color-popover)', color: 'var(--color-popover-foreground)', border: '1px solid var(--color-border)' }} itemStyle={{ color: 'var(--color-popover-foreground)' }} formatter={(value: number, _name, item) => [item.payload.display ?? value, item.payload.label]} />
  const axes = <><XAxis dataKey="label" tick={TICK} tickLine={false} /><YAxis width={40} tick={TICK} tickLine={false} /></>
  return (
    <figure className="min-w-0">
      {block.title && <figcaption className="mb-1 text-sm font-medium">{block.title}</figcaption>}
      <div role="img" aria-label={label} className="h-[200px] min-w-0">
        <ResponsiveContainer width="100%" height={200}>
          {block.chartType === 'pie' ? (
            <PieChart>{tooltip}<Pie data={block.points} dataKey="value" nameKey="label" outerRadius="80%" isAnimationActive={false} onClick={(_point, index) => navigate(index)}>
              {block.points.map((point, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} cursor={internalAppHref(point.href) ? 'pointer' : undefined} />)}
            </Pie></PieChart>
          ) : block.chartType === 'bar' ? (
            <BarChart data={block.points}>{axes}{tooltip}<Bar dataKey="value" isAnimationActive={false} onClick={(_point, index) => navigate(index)}>
              {block.points.map((point, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} cursor={internalAppHref(point.href) ? 'pointer' : undefined} />)}
            </Bar></BarChart>
          ) : (
            <LineChart data={block.points}>{axes}{tooltip}<Line dataKey="value" stroke={COLORS[0]} isAnimationActive={false} activeDot={false} dot={(props) => (
              <circle key={props.index} cx={props.cx} cy={props.cy} r={5} fill={COLORS[0]} onClick={() => navigate(props.index ?? -1)} style={{ cursor: internalAppHref(props.payload?.href) ? 'pointer' : undefined }} />
            )} /></LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <ul aria-label={`${block.title ?? 'Chart'} data`} className="sr-only focus-within:not-sr-only focus-within:mt-2 focus-within:space-y-1">
        {block.points.map((point, index) => <li key={index}><PresentationLink href={point.href}>{point.label}: {point.display ?? point.value}</PresentationLink></li>)}
      </ul>
    </figure>
  )
}
