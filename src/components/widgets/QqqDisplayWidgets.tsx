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
 * @file Canonical QQQ display widgets: html, alert, stepper, field value list,
 * location, USA map, QuickSight embed and generic.
 */
'use client'

import React from 'react'
import { AlertTriangle, CheckCircle, CircleDot, Circle, Info, XCircle } from 'lucide-react'

import type { QRecord } from '@/types'
import { cn } from '@/lib/utils/cn'
import type { WidgetComponentProps } from './widget-types'
import { asList, isPlainObject, payloadProblem } from './widget-types'
import { SafeHtml } from './SafeHtml'
import { WidgetEmpty, WidgetPayloadNotice } from './WidgetNotice'
import { WidgetIcon } from './WidgetIcon'
import { WidgetLink } from './QqqStatisticsWidgets'

/** `RawHTML` payload. */
export interface QqqHtmlPayload {
  type?: string
  title?: string
  html?: unknown
}

/**
 * Renders a canonical QQQ `html` widget's sanitized HTML.
 *
 * @param props - Widget props.
 * @returns The HTML body, or nothing for empty HTML.
 */
export function QqqHtmlWidget({ widgetMetaData, data }: WidgetComponentProps<QqqHtmlPayload>) {
  if (data.html !== undefined && data.html !== null && typeof data.html !== 'string') {
    return <WidgetPayloadNotice widgetName={widgetMetaData.name} message={payloadProblem('html', 'html')} />
  }
  if (!data.html) return <div data-qqq-id={`html-widget-${widgetMetaData.name}`} />
  return <SafeHtml html={data.html} className="text-sm text-foreground" qqqId={`html-widget-${widgetMetaData.name}`} />
}

/** `AlertData` payload. */
export interface QqqAlertPayload {
  type?: string
  html?: string
  alertType?: 'ERROR' | 'SUCCESS' | 'WARNING' | string
  hideWidget?: boolean
  bulletList?: unknown
}

const ALERT_STYLES: Record<string, { icon: React.ElementType; className: string }> = {
  ERROR: { icon: XCircle, className: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100' },
  WARNING: { icon: AlertTriangle, className: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100' },
  SUCCESS: { icon: CheckCircle, className: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100' },
  INFO: { icon: Info, className: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100' },
}

/**
 * Renders a canonical QQQ `alert`: severity from `alertType`, sanitized HTML and
 * an optional bullet list. Hidden alerts are filtered out by ConnectedWidget;
 * an alert without HTML renders nothing, as in Material.
 *
 * @param props - Widget props.
 * @returns The alert, or nothing.
 */
export function QqqAlertWidget({ widgetMetaData, data }: WidgetComponentProps<QqqAlertPayload>) {
  const bullets = asList<string>(data.bulletList)
  if (!bullets) return <WidgetPayloadNotice widgetName={widgetMetaData.name} message={payloadProblem('alert', 'bulletList')} />
  if (!data.html) return null
  const style = ALERT_STYLES[String(data.alertType ?? 'INFO').toUpperCase()] ?? ALERT_STYLES.INFO
  const Icon = style.icon
  return (
    <div role="alert" className={cn('flex items-start gap-3 rounded-lg border p-3 text-sm', style.className)} data-qqq-id={`alert-widget-${widgetMetaData.name}`} data-alert-type={data.alertType}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <SafeHtml html={data.html} />
        {bullets.length > 0 && (
          <ul className="mt-1 list-disc pl-5">
            {bullets.map((bullet, index) => <SafeHtml key={index} as="li" html={String(bullet)} />)}
          </ul>
        )}
      </div>
    </div>
  )
}

/** `StepperData` payload. */
export interface QqqStepperPayload {
  type?: string
  title?: string
  activeStep?: number
  steps?: unknown
}

/**
 * Renders a canonical QQQ `stepper`: steps before `activeStep` are complete, the
 * active step shows its link, later steps are upcoming.
 *
 * @param props - Widget props.
 * @returns The stepper.
 */
export function QqqStepperWidget({ widgetMetaData, data }: WidgetComponentProps<QqqStepperPayload>) {
  const name = widgetMetaData.name
  const steps = asList<{ label?: string; linkText?: string; linkURL?: string; colorOverride?: string; iconOverride?: string }>(data.steps)
  if (!steps || steps.some((step) => !isPlainObject(step))) {
    return <WidgetPayloadNotice widgetName={name} message={payloadProblem('stepper', 'steps')} />
  }
  if (steps.length === 0) return <WidgetEmpty widgetName={name}>No steps to show</WidgetEmpty>
  const active = typeof data.activeStep === 'number' ? data.activeStep : 0
  return (
    <ol className="flex flex-wrap items-start gap-4" data-qqq-id={`stepper-${name}`} aria-label={data.title ?? widgetMetaData.label}>
      {steps.map((step, index) => {
        const state = index < active ? 'complete' : index === active ? 'current' : 'upcoming'
        const Icon = state === 'complete' ? CheckCircle : state === 'current' ? CircleDot : Circle
        return (
          <li
            key={index}
            className="flex min-w-[6rem] flex-1 flex-col items-center gap-1 text-center text-sm"
            aria-current={state === 'current' ? 'step' : undefined}
            data-step-state={state}
            data-qqq-id={`stepper-step-${name}-${index}`}
          >
            <Icon
              className={cn('h-7 w-7', state === 'complete' ? 'text-emerald-600' : state === 'current' ? 'text-primary' : 'text-muted-foreground/60')}
              style={step.colorOverride ? { color: step.colorOverride } : undefined}
              aria-hidden="true"
            />
            <span className={cn(state === 'upcoming' ? 'text-muted-foreground' : 'font-medium text-foreground')}>{step.label}</span>
            {state === 'current' && step.linkURL && (
              <WidgetLink href={step.linkURL} className="text-xs text-primary" qqqId={`stepper-link-${name}-${index}`}>{step.linkText ?? step.linkURL}</WidgetLink>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** `FieldValueListData` payload. */
export interface QqqFieldValueListPayload {
  type?: string
  fields?: unknown
  record?: unknown
  fieldLabelPrefixIconNames?: Record<string, string>
  fieldLabelPrefixIconColors?: Record<string, string>
  fieldIndentLevels?: Record<string, number>
}

/**
 * Display text for one value: the record's display value, else the raw value
 * (0 and false are shown), else an em dash.
 *
 * @param record - Record with values/displayValues.
 * @param fieldName - Field name.
 * @returns Display text.
 */
function valueText(record: Partial<QRecord>, fieldName: string): string {
  const display = record.displayValues?.[fieldName]
  if (display !== undefined && display !== null && display !== '') return String(display)
  const value = record.values?.[fieldName]
  if (value === undefined || value === null || value === '') return '—'
  return String(value)
}

/**
 * Renders a canonical QQQ `fieldValueList`: `Label: value` pairs with optional
 * prefix icons and indentation.
 *
 * @param props - Widget props.
 * @returns The value list.
 */
export function QqqFieldValueListWidget({ widgetMetaData, data }: WidgetComponentProps<QqqFieldValueListPayload>) {
  const name = widgetMetaData.name
  const fields = asList<{ name: string; label?: string }>(data.fields)
  if (!fields || fields.some((field) => !isPlainObject(field)) || (data.record !== undefined && !isPlainObject(data.record))) {
    return <WidgetPayloadNotice widgetName={name} message={payloadProblem('field value list', 'fields/record')} />
  }
  if (fields.length === 0) return <WidgetEmpty widgetName={name}>No values to show</WidgetEmpty>
  const record = (data.record ?? {}) as Partial<QRecord>
  return (
    <dl className="space-y-1.5 text-sm" data-qqq-id={`field-value-list-${name}`}>
      {fields.map((field) => (
        <div
          key={field.name}
          className="flex items-baseline gap-2"
          style={{ paddingLeft: `${1.5 * (data.fieldIndentLevels?.[field.name] ?? 0)}rem` }}
          data-qqq-id={`field-value-${name}-${field.name}`}
        >
          <dt className="flex items-center gap-1 font-semibold text-foreground">
            {data.fieldLabelPrefixIconNames?.[field.name] && (
              <WidgetIcon name={data.fieldLabelPrefixIconNames[field.name]} color={data.fieldLabelPrefixIconColors?.[field.name]} qqqId={`field-value-icon-${name}-${field.name}`} />
            )}
            {field.label ?? field.name}:
          </dt>
          <dd className="text-muted-foreground">{valueText(record, field.name)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** `LocationData` payload. */
export interface QqqLocationPayload {
  type?: string
  imageUrl?: string
  title?: string
  description?: string
  location?: string
  footerText?: string
}

/**
 * Renders a canonical QQQ `location` card: image, title, description, location and footer.
 *
 * @param props - Widget props.
 * @returns The location card.
 */
export function QqqLocationWidget({ widgetMetaData, data }: WidgetComponentProps<QqqLocationPayload>) {
  const name = widgetMetaData.name
  return (
    <article className="space-y-2 text-sm" data-qqq-id={`location-${name}`}>
      {data.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- backend-provided absolute URL, not a bundled asset
        <img src={data.imageUrl} alt={data.title ?? widgetMetaData.label} className="h-32 w-full rounded-md object-cover" data-qqq-id={`location-image-${name}`} />
      )}
      {data.title && <h4 className="font-semibold text-foreground">{data.title}</h4>}
      {data.description && <p className="text-muted-foreground">{data.description}</p>}
      {data.location && <p className="text-foreground" data-qqq-id={`location-address-${name}`}>{data.location}</p>}
      {data.footerText && <p className="border-t border-border pt-2 text-xs text-muted-foreground">{data.footerText}</p>}
    </article>
  )
}

/** `USMapWidgetData` payload. */
export interface QqqUsaMapPayload {
  type?: string
  height?: string
  mapMarkerList?: unknown
}

/** Contiguous-US bounding box used to place markers (longitude / latitude). */
const US_BOUNDS = { west: -125, east: -66.5, north: 49.5, south: 24.5 }

/**
 * Renders a canonical QQQ `usaMap`: an equirectangular plot of the contiguous
 * United States with one marker per `mapMarkerList` entry, plus a list of the
 * markers with their coordinates for screen readers and keyboard users.
 *
 * @param props - Widget props.
 * @returns The map.
 */
export function QqqUsaMapWidget({ widgetMetaData, data }: WidgetComponentProps<QqqUsaMapPayload>) {
  const name = widgetMetaData.name
  const markers = asList<{ name?: string; latitude?: number; longitude?: number }>(data.mapMarkerList)
  if (!markers || markers.some((marker) => !isPlainObject(marker))) {
    return <WidgetPayloadNotice widgetName={name} message={payloadProblem('USA map', 'mapMarkerList')} />
  }
  const width = 600
  const height = 360
  const x = (longitude: number) => ((longitude - US_BOUNDS.west) / (US_BOUNDS.east - US_BOUNDS.west)) * width
  const y = (latitude: number) => ((US_BOUNDS.north - latitude) / (US_BOUNDS.north - US_BOUNDS.south)) * height
  const placed = markers.filter((marker) => typeof marker.latitude === 'number' && typeof marker.longitude === 'number')
  return (
    <figure className="space-y-2" data-qqq-id={`usa-map-${name}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${widgetMetaData.label}: ${placed.length} location${placed.length === 1 ? '' : 's'}`}
        className="w-full rounded-md border border-border bg-muted/40"
        style={data.height ? { maxHeight: data.height } : undefined}
      >
        <rect x="0" y="0" width={width} height={height} fill="transparent" />
        {placed.map((marker, index) => (
          <g key={index} data-qqq-id={`usa-map-marker-${name}-${index}`} data-marker-name={marker.name}>
            <circle cx={x(marker.longitude as number)} cy={y(marker.latitude as number)} r="7" className="fill-primary stroke-background" strokeWidth="2">
              <title>{marker.name}</title>
            </circle>
          </g>
        ))}
      </svg>
      {placed.length === 0
        ? <WidgetEmpty widgetName={name}>No locations to show</WidgetEmpty>
        : (
          <figcaption>
            <ul className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              {placed.map((marker, index) => (
                <li key={index} data-qqq-id={`usa-map-location-${name}-${index}`}>
                  <span className="font-medium text-foreground">{marker.name}</span> ({marker.latitude}, {marker.longitude})
                </li>
              ))}
            </ul>
          </figcaption>
        )}
    </figure>
  )
}

/** `QuickSightChart` payload. */
export interface QqqQuickSightPayload {
  type?: string
  label?: string
  name?: string
  url?: string
}

/**
 * Renders a canonical QQQ `quickSightChart`: the provider's embed URL in an iframe.
 *
 * @param props - Widget props.
 * @returns The embed, or an empty message when the provider returned no URL.
 */
export function QqqQuickSightWidget({ widgetMetaData, data }: WidgetComponentProps<QqqQuickSightPayload>) {
  const name = widgetMetaData.name
  if (data.url !== undefined && typeof data.url !== 'string') {
    return <WidgetPayloadNotice widgetName={name} message={payloadProblem('QuickSight', 'url')} />
  }
  if (!data.url) return <WidgetEmpty widgetName={name}>No dashboard is available to embed.</WidgetEmpty>
  return (
    <iframe
      src={data.url}
      title={data.label ?? widgetMetaData.label}
      className="h-[411px] w-full rounded-md border-0"
      data-qqq-id={`quicksight-${name}`}
    />
  )
}

/** Generic payload: only the common widget fields (label, sublabel, footer) plus optional HTML. */
export interface QqqGenericPayload {
  type?: string
  html?: string
}

/**
 * Renders a `generic` widget: its common fields render in the chrome (label
 * override, sublabel, footer HTML); any `html` renders as the body.
 *
 * @param props - Widget props.
 * @returns The body.
 */
export function QqqGenericWidget({ widgetMetaData, data }: WidgetComponentProps<QqqGenericPayload>) {
  return (
    <div data-qqq-id={`generic-widget-${widgetMetaData.name}`}>
      {typeof data.html === 'string' && data.html && <SafeHtml html={data.html} className="text-sm" />}
    </div>
  )
}
