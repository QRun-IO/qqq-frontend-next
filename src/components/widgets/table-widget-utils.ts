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
 * @file Pure helpers for the QQQ table widget (`TableData`): column widths, paging and the
 * CSV export built from columns and rows when the payload has no `csvData` (Material parity).
 */

/** One `TableData.Column` as serialized by the backend. */
export interface TableWidgetColumn {
  /** `default`, `html`, `htmlAndTooltip`, `composite`, `block`, `image` or `hidden`. */
  type?: string
  header?: string
  accessor?: string
  /** CSS width: `fr` units share the space left by fixed widths (Material's grid template). */
  width?: string
  align?: string
  verticalAlign?: string
}

/** Rows per page when the payload sets no `rowsPerPage` (Material DataTable default). */
export const DEFAULT_TABLE_PAGE_SIZE = 10

/** Choices of the entries-per-page select (Material DataTable default options). */
export const TABLE_PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25]

/** Above this many pages the numbered page buttons become a jump-to-page input (Material). */
export const MAX_NUMBERED_PAGES = 6

/** Column type whose values are helper data (image URL, tooltip) and are never shown. */
export const HIDDEN_COLUMN_TYPE = 'hidden'

/**
 * Resolves the CSS width of each shown column for a fixed-layout table, as Material's CSS
 * grid template does: a column without a width takes `1fr`, `fr` columns share what fixed
 * widths leave, fixed widths (px, rem, %, ...) stay as declared.
 *
 * An `fr` column becomes its percentage share of the width that declared percentages leave:
 * with `table-layout: fixed`, Chromium, Firefox and WebKit give fixed-length columns their
 * width first and scale the percentage columns into what remains (a `calc()` mixing % and px
 * is ignored on a `<col>`), which is exactly how `fr` tracks share the free space.
 *
 * @param widths - Declared widths of the shown columns, in order.
 * @returns One CSS width per column, or null when no column declares a width (auto layout).
 */
export function resolveColumnWidths(widths: Array<string | undefined>): string[] | null {
  if (!widths.some((width) => typeof width === 'string' && width.trim() !== '')) return null
  const parsed: Array<{ fr: number; fixed: null } | { fr: null; fixed: string }> = widths.map((width) => {
    const text = (width ?? '').trim() || '1fr'
    const fr = /^(\d*\.?\d+)fr$/.exec(text)?.[1]
    return fr !== undefined ? { fr: Number(fr), fixed: null } : { fr: null, fixed: text }
  })
  const totalFr = parsed.reduce((sum, width) => sum + (width.fr ?? 0), 0)
  const percentages = parsed.reduce((sum, width) => sum + (width.fixed?.endsWith('%') ? Number.parseFloat(width.fixed) || 0 : 0), 0)
  const free = Math.max(0, 100 - percentages)
  return parsed.map((width) => {
    if (width.fixed !== null) return width.fixed
    const share = totalFr > 0 ? (width.fr ?? 0) / totalFr : 0
    return `${Number((share * free).toFixed(4))}%`
  })
}

/**
 * The narrowest a fixed-layout table may get before it scrolls inside its card (phones): each
 * `fr` (or unsized, or percentage) column keeps 6rem, fixed widths keep their size.
 *
 * @param widths - Declared widths of the shown columns (and the expander), in order.
 * @returns A CSS length for `min-width`.
 */
export function minTableWidth(widths: Array<string | undefined>): string {
  const flexible = widths.filter((width) => !width || /fr$|%$/.test(width.trim())).length
  const fixed = widths.flatMap((width) => (width && !/fr$|%$/.test(width.trim()) ? [width.trim()] : []))
  return fixed.length === 0 ? `${flexible * 6}rem` : `calc(${[`${flexible * 6}rem`, ...fixed].join(' + ')})`
}

/**
 * The page-size choices to offer: the Material options plus the current size when it is not
 * one of them (a payload `rowsPerPage` of 7 stays selectable).
 *
 * @param current - The page size in effect.
 * @returns Ascending page sizes.
 */
export function pageSizeOptions(current: number): number[] {
  return [...new Set([...TABLE_PAGE_SIZE_OPTIONS, current])].sort((a, b) => a - b)
}

/** Class names whose elements are glyphs or controls, not text (Material's export skips them). */
const NON_TEXT_CLASS = /(^|\s)(MuiIcon-root|material-icons[\w-]*|material-symbols[\w-]*|button)(\s|$)/

/** Elements that start a new line in text export. */
const BLOCK_TAGS = new Set(['ADDRESS', 'ARTICLE', 'BLOCKQUOTE', 'DIV', 'DL', 'DT', 'DD', 'FIELDSET', 'FIGURE', 'FOOTER', 'FORM',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TR', 'UL'])

/**
 * Converts cell HTML to its plain text for a CSV export, the way the Material table widget
 * does with `html-to-text`: links keep only their text, and icon glyphs (Material icon
 * spans such as `open_in_new`) and button-styled elements are skipped. Block elements and
 * `<br>` start new lines; runs of spaces collapse.
 *
 * @param html - Cell HTML from the backend.
 * @returns The cell's visible text.
 */
export function htmlToExportText(html: unknown): string {
  if (html === null || html === undefined) return ''
  const source = String(html)
  if (!/[<&]/.test(source)) return source.trim()
  const document = new DOMParser().parseFromString(`<body>${source}</body>`, 'text/html')
  const lines: string[] = ['']
  const newLine = () => { if (lines[lines.length - 1].trim() !== '') lines.push('') }
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      lines[lines.length - 1] += node.textContent ?? ''
      return
    }
    if (!(node instanceof Element)) return
    const tag = node.tagName.toUpperCase()
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'BUTTON' || tag === 'SVG') return
    if (NON_TEXT_CLASS.test(node.getAttribute('class') ?? '')) return
    if (tag === 'BR') {
      lines.push('')
      return
    }
    const block = BLOCK_TAGS.has(tag)
    if (block) newLine()
    node.childNodes.forEach(walk)
    if (block) newLine()
  }
  document.body.childNodes.forEach(walk)
  return lines.map((line) => line.replace(/\s+/g, ' ').trim()).filter((line) => line !== '').join('\n')
}

/**
 * Builds the CSV the Material table widget exports when a table payload has no `csvData`:
 * a header line of every column's header, then one line per top-level row; `default`
 * cells export their raw value, other types their text (see {@link htmlToExportText});
 * every cell is quoted with inner quotes doubled.
 *
 * @param columns - Every column of the payload, including hidden ones (Material exports them too).
 * @param rows - The payload rows (sub-rows are not exported).
 * @returns CSV text with a trailing newline per line.
 */
export function tableExportCsv(columns: TableWidgetColumn[], rows: Array<Record<string, unknown>>): string {
  const quote = (value: unknown) => `"${(value === null || value === undefined ? '' : String(value)).replace(/"/g, '""')}"`
  let csv = columns.map((column) => quote(column.header ?? column.accessor ?? '')).join(',') + '\n'
  for (const row of rows) {
    csv += columns.map((column) => {
      const value = row?.[column.accessor ?? '']
      if (value !== null && typeof value === 'object') return quote('')
      return quote(!column.type || column.type === 'default' ? value : htmlToExportText(value))
    }).join(',') + '\n'
  }
  return csv
}
