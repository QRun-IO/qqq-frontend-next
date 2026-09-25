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
 * @file Pure helpers shared by the QQQ composite block renderers: color names,
 * value coercion, style-map conversion and `data-qqq-id` construction.
 */

import type React from 'react'

import { isPlainObject } from '../widget-types'
import type { QqqBlockData } from '../widget-types'

/** Standard QQQ block color names and their rendered colors (Material parity). */
const STANDARD_COLORS: Record<string, string> = {
  SUCCESS: '#2BA83F',
  WARNING: '#FBA132',
  ERROR: '#FB4141',
  INFO: '#458CFF',
  MUTED: '#7b809a',
}

/**
 * Resolves a color from a block style map: standard names (SUCCESS, WARNING, ERROR,
 * INFO, MUTED) map to fixed colors, bare 6/8-digit hex gains a `#`, and any other
 * CSS color passes through unchanged.
 *
 * @param color - The raw style value.
 * @returns A CSS color, or `undefined` when no color was given.
 */
export function blockColor(color: unknown): string | undefined {
  if (typeof color !== 'string' || !color) return undefined
  const standard = STANDARD_COLORS[color.toUpperCase()]
  if (standard) return standard
  if (/^[0-9A-F]{6}$/i.test(color) || /^[0-9A-F]{8}$/i.test(color)) return `#${color}`
  return color
}

/**
 * Returns a translucent tint of a color, as Material does with `${color}40`.
 *
 * @param color - A resolved CSS color.
 * @returns A CSS color at roughly 25% opacity.
 */
export function tint(color: string): string {
  if (/^#[0-9A-F]{6}$/i.test(color)) return `${color}40`
  return `color-mix(in srgb, ${color} 25%, transparent)`
}

/**
 * Returns the block's `values` map (an empty map when absent or malformed).
 *
 * @param block - The block.
 * @returns The values map.
 */
export function blockValues(block: QqqBlockData): Record<string, unknown> {
  return isPlainObject(block.values) ? block.values : {}
}

/**
 * Returns the block's `styles` map (an empty map when absent or malformed).
 *
 * @param block - The block.
 * @returns The styles map.
 */
export function blockStyles(block: QqqBlockData): Record<string, unknown> {
  return isPlainObject(block.styles) ? block.styles : {}
}

/**
 * Converts a displayable scalar to text; objects and arrays yield `undefined`.
 *
 * @param value - Any payload value.
 * @returns The value as a string, or `undefined` when absent or not scalar.
 */
export function text(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

/**
 * Converts a payload value to a finite number.
 *
 * @param value - Any payload value.
 * @returns The number, or `undefined` when not numeric.
 */
export function numeric(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

/**
 * Reads the icon name from a serialized `QIcon` (`{ name }`) or a bare string.
 *
 * @param icon - The payload value.
 * @returns The icon name, or `undefined`.
 */
export function iconName(icon: unknown): string | undefined {
  if (typeof icon === 'string' && icon) return icon
  if (isPlainObject(icon) && typeof icon.name === 'string' && icon.name) return icon.name
  return undefined
}

/**
 * Converts a backend style map (MUI `sx`-style keys) into React inline styles,
 * keeping only string and number values; hyphenated keys become camelCase.
 *
 * @param map - The style map from the payload.
 * @returns React CSS properties.
 */
export function styleMap(map: unknown): React.CSSProperties {
  if (!isPlainObject(map)) return {}
  const style: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(map)) {
    if (typeof value !== 'string' && typeof value !== 'number') continue
    const camel = key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
    style[camel] = value
  }
  return style as React.CSSProperties
}

/**
 * Builds the `data-qqq-id` for a block: `block-<lower-cased type>-<widget name>`.
 *
 * @param blockTypeName - The block's type name (e.g. `BIG_NUMBER`).
 * @param widgetName - The owning widget's name.
 * @returns The id string.
 */
export function blockQqqId(blockTypeName: string, widgetName: string): string {
  return `block-${blockTypeName.toLowerCase()}-${widgetName}`
}
