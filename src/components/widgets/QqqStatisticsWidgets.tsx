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
 * @file Canonical QQQ statistics and multi-statistics widgets.
 */
'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'

import { cn } from '@/lib/utils/cn'
import type { WidgetComponentProps } from './widget-types'
import { asList, isPlainObject, payloadProblem } from './widget-types'
import { WidgetEmpty, WidgetPayloadNotice } from './WidgetNotice'
import { WidgetIcon } from './WidgetIcon'
import { TOUCH_LINK } from './widget-utils'

/** `StatisticsData` payload. */
export interface QqqStatisticsPayload {
  type?: string
  count?: string | number
  countFontSize?: string
  countURL?: string
  countContext?: string
  percentageAmount?: number
  percentageLabel?: string
  percentageURL?: string
  isCurrency?: boolean
  increaseIsGood?: boolean
}

/**
 * Formats a count: numbers get grouping (and USD when currency); strings pass through.
 *
 * @param count - Backend count.
 * @param isCurrency - Currency formatting flag.
 * @returns Display text.
 */
function formatCount(count: string | number | undefined, isCurrency?: boolean): string {
  if (count === undefined || count === null) return ''
  if (typeof count === 'number') {
    return isCurrency ? count.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : count.toLocaleString('en-US')
  }
  return count
}

/**
 * Link that navigates in-app for `/` paths and opens other URLs in a new tab.
 *
 * @param props - Link properties.
 * @param props.href - Target.
 * @param props.children - Link content.
 * @param props.className - Classes.
 * @param props.qqqId - `data-qqq-id`.
 * @returns The link.
 */
export function WidgetLink({ href, children, className, qqqId }: { href: string; children: React.ReactNode; className?: string; qqqId?: string }) {
  if (href.startsWith('/')) {
    return <Link href={href} prefetch={false} className={cn(TOUCH_LINK, 'underline-offset-2 hover:underline', className)} data-qqq-id={qqqId}>{children}</Link>
  }
  return <a href={href} target="_blank" rel="noopener noreferrer" className={cn(TOUCH_LINK, 'underline-offset-2 hover:underline', className)} data-qqq-id={qqqId}>{children}</a>
}

/**
 * Renders a canonical QQQ statistics payload: the count (linked when `countURL`),
 * its context, and the percentage change with an up/down indicator colored good
 * or bad according to `increaseIsGood`.
 *
 * @param props - Widget props.
 * @returns The statistics body.
 */
export function QqqStatisticsWidget({ widgetMetaData, data }: WidgetComponentProps<QqqStatisticsPayload>) {
  const name = widgetMetaData.name
  const count = formatCount(data.count, data.isCurrency)
  const percentage = typeof data.percentageAmount === 'number' ? data.percentageAmount : undefined
  const increaseIsGood = data.increaseIsGood !== false
  const direction = percentage === undefined || percentage === 0 ? 'flat' : percentage > 0 ? 'up' : 'down'
  const isGood = direction === 'flat' ? undefined : (direction === 'up') === increaseIsGood
  const Arrow = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus
  const percentText = percentage === undefined ? '' : `${percentage > 0 ? '+' : ''}${percentage.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`

  return (
    <div className="space-y-2" data-qqq-id={`statistics-widget-${name}`}>
      <div className="flex items-baseline gap-2">
        <span
          className="text-3xl font-bold text-foreground"
          style={data.countFontSize ? { fontSize: data.countFontSize } : undefined}
          data-qqq-id={`statistics-count-${name}`}
        >
          {data.countURL ? <WidgetLink href={data.countURL}>{count}</WidgetLink> : count}
        </span>
        {data.countContext && <span className="text-sm text-muted-foreground" data-qqq-id={`statistics-context-${name}`}>{data.countContext}</span>}
      </div>
      {percentage !== undefined && (
        <p
          className={cn('flex items-center gap-1 text-sm font-medium', isGood === undefined ? 'text-muted-foreground' : isGood ? 'text-emerald-600' : 'text-red-600')}
          data-qqq-id={`statistics-percentage-${name}`}
          data-direction={direction}
          data-good={isGood === undefined ? undefined : String(isGood)}
        >
          <Arrow className="h-4 w-4" aria-hidden="true" />
          {data.percentageURL ? <WidgetLink href={data.percentageURL}>{percentText}</WidgetLink> : <span>{percentText}</span>}
          {data.percentageLabel && <span className="font-normal text-muted-foreground">{data.percentageLabel}</span>}
        </p>
      )}
    </div>
  )
}

/** `MultiStatisticsData` payload. */
export interface QqqMultiStatisticsPayload {
  type?: string
  title?: string
  statisticsGroupData?: unknown
}

/** One statistics group. */
interface StatisticsGroup {
  icon?: string
  iconColor?: string
  header?: string
  subheader?: string
  statisticList?: unknown
}

/**
 * Renders a canonical QQQ multi-statistics payload: one column per group with its
 * icon, header and subheader, and each statistic as `label: value` (linked when the
 * statistic has a url).
 *
 * @param props - Widget props.
 * @returns The multi-statistics body.
 */
export function MultiStatisticsWidget({ widgetMetaData, data }: WidgetComponentProps<QqqMultiStatisticsPayload>) {
  const name = widgetMetaData.name
  const groups = asList<StatisticsGroup>(data.statisticsGroupData)
  if (!groups || groups.some((group) => !isPlainObject(group) || asList(group.statisticList) === undefined)) {
    return <WidgetPayloadNotice widgetName={name} message={payloadProblem('multi-statistics', 'statisticsGroupData')} />
  }
  if (groups.length === 0) {
    return <WidgetEmpty widgetName={name}>No statistics available</WidgetEmpty>
  }
  return (
    <div data-qqq-id={`multi-statistics-${name}`}>
      {data.title && data.title !== widgetMetaData.label && <p className="mb-3 text-sm font-medium text-muted-foreground">{data.title}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {groups.map((group, groupIndex) => (
          <section key={groupIndex} className="rounded-lg border border-border/60 p-3" data-qqq-id={`multi-statistics-group-${name}-${groupIndex}`} aria-label={group.header}>
            <div className="mb-2 flex items-center gap-2">
              {group.icon && <WidgetIcon name={group.icon} color={group.iconColor} className="text-lg" />}
              <div>
                <h4 className="text-sm font-semibold text-foreground">{group.header}</h4>
                {group.subheader && <p className="text-xs text-muted-foreground">{group.subheader}</p>}
              </div>
            </div>
            <dl className="space-y-1 text-sm">
              {(asList<{ label?: string; value?: number; url?: string }>(group.statisticList) ?? []).map((statistic, index) => (
                <div key={index} className="flex justify-between gap-2" data-qqq-id={`multi-statistics-stat-${name}-${groupIndex}-${index}`}>
                  <dt className="text-muted-foreground">{statistic.label}</dt>
                  <dd className="font-semibold text-foreground">
                    {statistic.url
                      ? <WidgetLink href={statistic.url}>{Number(statistic.value ?? 0).toLocaleString('en-US')}</WidgetLink>
                      : Number(statistic.value ?? 0).toLocaleString('en-US')}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  )
}
