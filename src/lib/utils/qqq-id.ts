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
 * @file The Material Dashboard `data-qqq-id` contract (QRun-IO/qqq#731): the id sanitizer and
 * the type-prefixed id builders, ported from Material's `qqqIdUtils.ts` so that app custom CSS
 * written for Material (`MaterialDashboardThemeMetaData.customCss`) targets the same UI in Next.
 * See docs/CSS-HOOKS.md.
 */

import { isValidElement, type ReactNode } from 'react'

/** Longest id the sanitizer returns (Material's limit). */
export const QQQ_ID_MAX_LENGTH = 50

/**
 * Sanitizes text for use in a `data-qqq-id` value, exactly as Material does: lowercase, every
 * run of characters other than a-z and 0-9 becomes one dash, leading and trailing dashes are
 * removed, and the result is cut to 50 characters. Camel case is not split: `firstName` gives
 * `firstname`.
 *
 * @param text - The text (a name, label or button text).
 * @returns The sanitized id part, or an empty string.
 */
export function sanitizeQqqId(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, QQQ_ID_MAX_LENGTH)
}

/**
 * The text content of React children (strings, numbers, arrays and nested elements), joined
 * with spaces, as Material's `extractTextFromChildren`.
 *
 * @param children - The children.
 * @returns Their text.
 */
export function textOfChildren(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(textOfChildren).filter(Boolean).join(' ')
  if (isValidElement(children)) {
    const props = children.props as { children?: ReactNode }
    if (props.children) return textOfChildren(props.children)
  }
  return ''
}

/**
 * Builds `{prefix}-{sanitized}` from the first source that yields text.
 *
 * @param prefix - The id type prefix.
 * @param sources - Candidate texts, in priority order.
 * @returns The id, or undefined when no source has text.
 */
function prefixed(prefix: string, ...sources: (string | undefined)[]): string | undefined {
  for (const source of sources) {
    if (source) return `${prefix}-${sanitizeQqqId(source)}`
  }
  return undefined
}

/**
 * The last non-empty path segment of a route or URL.
 *
 * @param path - The path.
 * @returns The segment, or an empty string.
 */
function lastSegment(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? ''
}

/**
 * Button id: explicit id, else the button text, else `button-icon-{icon}`.
 *
 * @param qqqId - Explicit id.
 * @param children - The button content.
 * @param iconName - The icon name.
 * @returns `button-...`, or undefined.
 */
export function buttonQqqId(qqqId?: string, children?: ReactNode, iconName?: string): string | undefined {
  if (qqqId) return `button-${sanitizeQqqId(qqqId)}`
  const text = children ? textOfChildren(children) : ''
  if (text) return `button-${sanitizeQqqId(text)}`
  if (iconName) return `button-icon-${sanitizeQqqId(iconName)}`
  return undefined
}

/**
 * Text input id: explicit id, else the field name, else the label.
 *
 * @param qqqId - Explicit id.
 * @param fieldName - Field name.
 * @param label - Field label.
 * @returns `input-...`, or undefined.
 */
export function inputQqqId(qqqId?: string, fieldName?: string, label?: string): string | undefined {
  return prefixed('input', qqqId, fieldName, label)
}

/**
 * Select (possible-value) id: explicit id, else the field name, else the label.
 *
 * @param qqqId - Explicit id.
 * @param fieldName - Field name.
 * @param label - Field label.
 * @returns `select-...`, or undefined.
 */
export function selectQqqId(qqqId?: string, fieldName?: string, label?: string): string | undefined {
  return prefixed('select', qqqId, fieldName, label)
}

/**
 * Switch / checkbox id: explicit id, else the field name, else the label.
 *
 * @param qqqId - Explicit id.
 * @param fieldName - Field name.
 * @param label - Field label.
 * @returns `switch-...`, or undefined.
 */
export function switchQqqId(qqqId?: string, fieldName?: string, label?: string): string | undefined {
  return prefixed('switch', qqqId, fieldName, label)
}

/**
 * Navigation item id: explicit id, else the item name (its label), else the last route segment.
 *
 * @param qqqId - Explicit id.
 * @param name - The item's name as shown.
 * @param route - The item's route.
 * @returns `sidenav-...`, or undefined.
 */
export function navItemQqqId(qqqId?: string, name?: string, route?: string): string | undefined {
  return prefixed('sidenav', qqqId, name) ?? (route ? `sidenav-${sanitizeQqqId(lastSegment(route))}` : undefined)
}

/**
 * Menu item id: explicit id, else the item text, else its index.
 *
 * @param qqqId - Explicit id.
 * @param text - The item text.
 * @param index - The item's position.
 * @returns `menu-item-...`, or undefined.
 */
export function menuItemQqqId(qqqId?: string, text?: string, index?: number): string | undefined {
  return prefixed('menu-item', qqqId, text) ?? (index !== undefined ? `menu-item-${index}` : undefined)
}

/**
 * Tab id: explicit id, else the tab label, else its index.
 *
 * @param qqqId - Explicit id.
 * @param label - The tab label.
 * @param index - The tab's position.
 * @returns `tab-...`, or undefined.
 */
export function tabQqqId(qqqId?: string, label?: string, index?: number): string | undefined {
  return prefixed('tab', qqqId, label) ?? (index !== undefined ? `tab-${index}` : undefined)
}

/**
 * Table (grid) column header id: explicit id, else the field name, else the header text.
 *
 * @param qqqId - Explicit id.
 * @param fieldName - The column's field name.
 * @param headerText - The header text.
 * @returns `table-header-...`, or undefined.
 */
export function tableHeaderQqqId(qqqId?: string, fieldName?: string, headerText?: string): string | undefined {
  return prefixed('table-header', qqqId, fieldName, headerText)
}

/**
 * Link id: explicit id, else the link text, else the last segment of its href.
 *
 * @param qqqId - Explicit id.
 * @param children - The link content.
 * @param href - The link target.
 * @returns `link-...`, or undefined.
 */
export function linkQqqId(qqqId?: string, children?: ReactNode, href?: string): string | undefined {
  if (qqqId) return `link-${sanitizeQqqId(qqqId)}`
  const text = children ? textOfChildren(children) : ''
  if (text) return `link-${sanitizeQqqId(text)}`
  if (href) return `link-${sanitizeQqqId(lastSegment(href))}`
  return undefined
}

/**
 * The Material id of an editable form field, placed on the field's wrapper: `select-{name}`
 * for possible-value fields, `switch-{name}` for booleans, `input-{name}` for everything else
 * (Material puts `input-{name}` on the text field root).
 *
 * @param field - The field's name, type and possible-value source.
 * @returns The id.
 */
export function formFieldQqqId(field: { name: string; type?: string; possibleValueSourceName?: string }): string | undefined {
  if (field.possibleValueSourceName) return selectQqqId(undefined, field.name)
  if (field.type === 'BOOLEAN') return switchQqqId(undefined, field.name)
  return inputQqqId(undefined, field.name)
}

/** Material MDButton variants, exposed as `data-button-variant`. */
export type MaterialButtonVariant = 'contained' | 'outlined' | 'text' | 'gradient'

/**
 * The `data-button-variant` of Material's default buttons (DefaultButtons.tsx), by their
 * Material id. Next sets the same value on its equivalent button.
 */
export const MATERIAL_BUTTON_VARIANTS = {
  'create-new': 'gradient',
  save: 'gradient',
  delete: 'contained',
  edit: 'gradient',
  'actions-menu': 'outlined',
  cancel: 'outlined',
  close: 'outlined',
  return: 'outlined',
  submit: 'gradient',
  next: 'gradient',
  back: 'gradient',
} as const satisfies Record<string, MaterialButtonVariant>
