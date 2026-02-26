'use client'

// BlockWidget -- Renders a collection of block elements from the backend
// Supports text, big_number, up_or_down, progress, button, icon, image,
// audio, divider, input, and html block types

import React from 'react'
import {
  ArrowUp,
  ArrowDown,
  HelpCircle,
} from 'lucide-react'

import type { BlockData } from '@/types'
import { cn } from '@/lib/utils/cn'

export interface BlockWidgetPayload {
  type?: string
  /** Block elements to render */
  blocks?: BlockData[]
  /** Layout direction for blocks */
  layout?: 'vertical' | 'horizontal' | 'grid'
  /** Legacy: raw HTML payload for backward compat with plain 'html' widget type */
  html?: string
}

interface BlockWidgetProps {
  data: BlockWidgetPayload
  widgetName: string
}

const LAYOUT_CLASSES: Record<string, string> = {
  vertical: 'flex flex-col gap-4',
  horizontal: 'flex flex-row flex-wrap gap-4',
  grid: 'grid grid-cols-2 gap-4',
}

export function BlockWidget({ data, widgetName }: BlockWidgetProps) {
  // Legacy backward compat: if there's a raw html string and no blocks, render as HTML directly
  if (data.html && (!data.blocks || data.blocks.length === 0)) {
    return (
      <div
        className="prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: data.html }}
        data-qqq-id={`block-widget-${widgetName}`}
      />
    )
  }

  const blocks = data.blocks ?? []
  const layoutClass = LAYOUT_CLASSES[data.layout ?? 'vertical'] ?? LAYOUT_CLASSES.vertical

  if (blocks.length === 0) {
    return (
      <p
        className="text-sm text-gray-500 dark:text-gray-400"
        data-qqq-id={`block-widget-empty-${widgetName}`}
      >
        No block content available
      </p>
    )
  }

  return (
    <div
      className={layoutClass}
      data-qqq-id={`block-widget-${widgetName}`}
    >
      {blocks.map((block, index) => (
        <BlockRenderer key={index} block={block} widgetName={widgetName} index={index} />
      ))}
    </div>
  )
}

// ------------------------------------------------------------------
// BlockRenderer -- Dispatches to the correct renderer for each block type
// ------------------------------------------------------------------
interface BlockRendererProps {
  block: BlockData
  widgetName: string
  index: number
}

function BlockRenderer({ block, widgetName, index }: BlockRendererProps) {
  switch (block.type) {
    case 'text':
      return (
        <p
          className="text-sm text-gray-700 dark:text-gray-300"
          style={block.styles}
          data-qqq-id={`block-text-${widgetName}-${index}`}
        >
          {block.text}
        </p>
      )

    case 'big_number':
      return (
        <div
          className="flex flex-col items-center gap-1"
          data-qqq-id={`block-big-number-${widgetName}-${index}`}
        >
          <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {block.value}
          </span>
          {block.label && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {block.label}
            </span>
          )}
        </div>
      )

    case 'up_or_down': {
      const isUp = block.value >= block.baseValue
      return (
        <div
          className="flex items-center gap-2"
          data-qqq-id={`block-up-or-down-${widgetName}-${index}`}
        >
          {isUp ? (
            <ArrowUp
              className="h-4 w-4 text-green-600 dark:text-green-400"
              aria-label="Up"
            />
          ) : (
            <ArrowDown
              className="h-4 w-4 text-red-600 dark:text-red-400"
              aria-label="Down"
            />
          )}
          <span
            className={cn(
              'text-lg font-semibold',
              isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            )}
          >
            {block.value}
          </span>
          {block.label && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {block.label}
            </span>
          )}
        </div>
      )
    }

    case 'progress': {
      const percentage = block.max > 0 ? Math.min(Math.round((block.value / block.max) * 100), 100) : 0
      return (
        <div
          className="flex flex-col gap-1"
          data-qqq-id={`block-progress-${widgetName}-${index}`}
        >
          {block.label && (
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {block.label}
            </span>
          )}
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
            role="progressbar"
            aria-valuenow={block.value}
            aria-valuemin={0}
            aria-valuemax={block.max}
            aria-label={block.label ?? `Progress: ${percentage}%`}
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-all dark:bg-blue-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {percentage}%
          </span>
        </div>
      )
    }

    case 'button':
      return (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          data-qqq-id={`block-button-${block.label}`}
          data-action-code={block.actionCode}
          aria-label={block.label}
        >
          {block.label}
        </button>
      )

    case 'icon':
      return (
        <div
          className="inline-flex items-center justify-center"
          data-qqq-id={`block-icon-${widgetName}-${index}`}
          aria-label={block.iconName}
        >
          <HelpCircle
            className="text-gray-500 dark:text-gray-400"
            style={{
              color: block.color ?? undefined,
              width: block.size ?? 24,
              height: block.size ?? 24,
            }}
            aria-hidden="true"
          />
        </div>
      )

    case 'image':
      return (
        <img
          src={block.src}
          alt={block.alt}
          width={block.width}
          height={block.height}
          className="max-w-full rounded"
          data-qqq-id={`block-image-${widgetName}-${index}`}
        />
      )

    case 'audio':
      return (
        <div data-qqq-id={`block-audio-${widgetName}-${index}`}>
          {block.label && (
            <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
              {block.label}
            </p>
          )}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio
            controls
            src={block.src}
            aria-label={block.label ?? 'Audio player'}
            className="w-full"
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      )

    case 'divider':
      return (
        <hr
          className="border-gray-200 dark:border-gray-700"
          data-qqq-id={`block-divider-${widgetName}-${index}`}
        />
      )

    case 'input':
      return (
        <div
          className="flex flex-col gap-1"
          data-qqq-id={`block-input-${widgetName}-${block.name}`}
        >
          <label
            htmlFor={`block-input-${widgetName}-${block.name}`}
            className="text-xs font-medium text-gray-600 dark:text-gray-400"
          >
            {block.label}
          </label>
          <input
            id={`block-input-${widgetName}-${block.name}`}
            name={block.name}
            type={block.inputType ?? 'text'}
            defaultValue={block.defaultValue ?? ''}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            aria-label={block.label}
            data-qqq-id={`block-input-field-${widgetName}-${block.name}`}
          />
        </div>
      )

    case 'html':
      return (
        <div
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: block.html }}
          data-qqq-id={`block-html-${widgetName}-${index}`}
        />
      )

    default: {
      // Exhaustive check: if a new block type is added without a case,
      // TypeScript will flag this assignment as an error.
      const _exhaustive: never = block
      return (
        <p className="text-xs text-gray-400" data-qqq-id={`block-unknown-${widgetName}-${index}`}>
          Unknown block type: {(_exhaustive as BlockData).type}
        </p>
      )
    }
  }
}
