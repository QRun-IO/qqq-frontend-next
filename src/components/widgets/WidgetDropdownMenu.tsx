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
 * @file WidgetDropdownMenu — a widget header dropdown, as Material Dashboard's
 * `WidgetDropdownMenu`: a searchable combobox for possible-value dropdowns (clear
 * button, start icon, previous/next arrows, metadata width, and a custom start/end
 * range for a `timeframe` dropdown's `custom` option), or a date picker with a Today
 * action and a day either way.
 */
'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

import { cn } from '@/lib/utils/cn'
import { WidgetIcon } from './WidgetIcon'
import {
  CUSTOM_TIMEFRAME, TIMEFRAME_DROPDOWN, customTimeframeValue, formatDropdownDate, isoDay, parseCustomTimeframe,
  parseDropdownDate,
} from './widget-utils'

/** One dropdown control resolved from the widget payload and metadata. */
export interface WidgetDropdownControl {
  /** Query parameter the selection is sent under. */
  paramName: string
  /** Dropdown label (the control is labelled `Select <label>`). */
  label: string
  /** Control kind. */
  type: 'POSSIBLE_VALUE_SOURCE' | 'DATE_PICKER'
  /** Options for possible-value dropdowns. */
  options: Array<{ id: string; label: string }>
  /** Currently selected option id (or date value, or custom timeframe value), or null. */
  value: string | null
  /** Label of an explicit "no selection" option. */
  labelForNullValue?: string
  /** Whether the backend declared a default selection (a null option is only offered without one). */
  hasDefault?: boolean
  /** Control width in pixels (Material default 225). */
  width?: number
  /** Material icon name shown at the start of the control. */
  startIconName?: string
  /** Shows previous/next arrows. */
  allowBackAndForth?: boolean
  /** Swaps the directions of the arrows. */
  backAndForthInverted?: boolean
  /** Hides the clear button. */
  disableClearable?: boolean
}

/** A selection handed to the widget: the value sent to the renderer and its label. */
export type WidgetDropdownSelection = { id: string; label: string } | null

/** Props accepted by {@link WidgetDropdownMenu}. */
interface WidgetDropdownMenuProps {
  /** Owning widget name, for `data-qqq-id` scoping. */
  widgetName: string
  /** The control. */
  control: WidgetDropdownControl
  /** Called with the new selection (null to clear). */
  onChange: (selection: WidgetDropdownSelection) => void
}

/** Default dropdown width in pixels (Material `dropdownMetaData.width ?? 225`). */
export const DEFAULT_DROPDOWN_WIDTH = 225

/** Debounce before a custom timeframe range is sent (Material: 500 ms). */
export const CUSTOM_TIMEFRAME_DEBOUNCE_MS = 500

/** Classes for a small icon button that is a 44 px target on touch screens. */
const ICON_BUTTON = 'inline-flex flex-shrink-0 items-center justify-center rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 pointer-coarse:min-h-11 pointer-coarse:min-w-11'

/**
 * Renders one widget header dropdown.
 *
 * @param props - See {@link WidgetDropdownMenuProps}.
 * @returns The control.
 */
export function WidgetDropdownMenu({ widgetName, control, onChange }: WidgetDropdownMenuProps) {
  return control.type === 'DATE_PICKER'
    ? <DatePickerDropdown widgetName={widgetName} control={control} onChange={onChange} />
    : <ComboboxDropdown widgetName={widgetName} control={control} onChange={onChange} />
}

/**
 * A date-picker dropdown: a native date input (the platform calendar), a Today action,
 * and, with `allowBackAndForth`, a day either way. The value sent is the day's
 * `toLocaleDateString()`, as Material sends it.
 *
 * @param props - See {@link WidgetDropdownMenuProps}.
 * @returns The date picker.
 */
function DatePickerDropdown({ widgetName, control, onChange }: WidgetDropdownMenuProps) {
  const { paramName, label } = control
  const date = parseDropdownDate(control.value)
  const choose = (day: Date | null) => {
    onChange(day ? { id: formatDropdownDate(day), label: formatDropdownDate(day) } : null)
  }
  const step = (event: React.MouseEvent, direction: -1 | 1) => {
    event.stopPropagation()
    const from = date ?? new Date()
    choose(new Date(from.getFullYear(), from.getMonth(), from.getDate() + (control.backAndForthInverted ? -direction : direction)))
  }
  const id = `${widgetName}-${paramName}`

  return (
    <div className="flex max-w-full items-center gap-1" data-qqq-id={`widget-date-picker-${id}`}>
      {control.allowBackAndForth && (
        <button type="button" className={ICON_BUTTON} onClick={(event) => step(event, -1)} aria-label={`Previous day for ${label}`} data-qqq-id={`button-widget-dropdown-previous-${id}`}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      <input
        type="date"
        value={date ? isoDay(date) : ''}
        onChange={(event) => {
          const [year, month, day] = event.target.value.split('-').map(Number)
          choose(event.target.value ? new Date(year, month - 1, day) : null)
        }}
        aria-label={`Select ${label}`}
        className="rounded border border-input bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring pointer-coarse:h-11"
        data-qqq-id={`widget-dropdown-${id}`}
      />
      <button
        type="button"
        onClick={() => choose(new Date())}
        className="rounded px-2 py-1 text-sm font-medium text-primary hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 pointer-coarse:min-w-11"
        aria-label={`Today for ${label}`}
        data-qqq-id={`button-widget-dropdown-today-${id}`}
      >
        Today
      </button>
      {control.allowBackAndForth && (
        <button type="button" className={ICON_BUTTON} onClick={(event) => step(event, 1)} aria-label={`Next day for ${label}`} data-qqq-id={`button-widget-dropdown-next-${id}`}>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/** Sentinel id of the explicit "no selection" option (`labelForNullValue`). */
const NULL_OPTION_ID = '\u0000null'

/**
 * A searchable combobox for a possible-value dropdown (the ARIA combobox pattern: an
 * editable input with a listbox). Typing filters the options by label; the list says
 * "No options found" when nothing matches.
 *
 * @param props - See {@link WidgetDropdownMenuProps}.
 * @returns The combobox, with its custom timeframe inputs when they apply.
 */
function ComboboxDropdown({ widgetName, control, onChange }: WidgetDropdownMenuProps) {
  const { paramName, label } = control
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const id = `${widgetName}-${paramName}`

  // Material offers the "label for null value" option only when the backend declared no default
  const options = useMemo(() => (control.labelForNullValue && !control.hasDefault
    ? [{ id: NULL_OPTION_ID, label: control.labelForNullValue }, ...control.options]
    : control.options), [control.labelForNullValue, control.hasDefault, control.options])

  // A timeframe's custom range: the selection shows "custom" before both ends are set, while the
  // renderer keeps its previous value (Material sends nothing until the range is complete).
  const isTimeframe = paramName === TIMEFRAME_DROPDOWN && options.some((option) => option.id === CUSTOM_TIMEFRAME)
  const storedRange = isTimeframe ? parseCustomTimeframe(control.value) : null
  const [customChosen, setCustomChosen] = useState(Boolean(storedRange))
  const [range, setRange] = useState(() => storedRange ?? { start: '', end: '' })
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (debounce.current) clearTimeout(debounce.current) }, [])
  useEffect(() => {
    if (control.value && !control.value.startsWith(`${CUSTOM_TIMEFRAME},`)) setCustomChosen(false)
  }, [control.value])

  const selectedId = customChosen ? CUSTOM_TIMEFRAME : control.value
  const selected = options.find((option) => option.id === selectedId)
    ?? (selectedId === null && options[0]?.id === NULL_OPTION_ID ? options[0] : undefined)
  const filtered = query === null || query === (selected?.label ?? '')
    ? options
    : options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))

  // Close on an outside click or tap
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return
      setOpen(false)
      setQuery(null)
      setActiveIndex(-1)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  /** Closes the list and drops any typed filter. */
  function close() {
    setOpen(false)
    setQuery(null)
    setActiveIndex(-1)
  }

  /**
   * Sends a custom timeframe once both ends are set.
   *
   * @param next - The local start and end inputs.
   * @param delay - Debounce in milliseconds (0 sends at once).
   */
  function sendRange(next: { start: string; end: string }, delay: number) {
    if (debounce.current) clearTimeout(debounce.current)
    const value = customTimeframeValue(next.start, next.end)
    if (!value) return
    const send = () => onChange({ id: value, label: 'Custom' })
    if (delay > 0) debounce.current = setTimeout(send, delay)
    else send()
  }

  /**
   * Applies a chosen option.
   *
   * @param option - The option, or null to clear.
   */
  function choose(option: { id: string; label: string } | null) {
    close()
    if (isTimeframe && option?.id === CUSTOM_TIMEFRAME) {
      setCustomChosen(true)
      sendRange(range, 0)
      return
    }
    setCustomChosen(false)
    onChange(option && option.id !== NULL_OPTION_ID ? option : null)
  }

  /**
   * Moves the selection to the previous or next option (Material `allowBackAndForth`).
   *
   * @param direction - -1 for previous, 1 for next (before inversion).
   */
  function step(direction: -1 | 1) {
    const index = options.findIndex((option) => option.id === selected?.id)
    if (index < 0) return
    const next = options[index + (control.backAndForthInverted ? -direction : direction)]
    if (next) choose(next)
  }

  /**
   * Keyboard handling for the combobox input.
   *
   * @param event - The keydown event.
   */
  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) setOpen(true)
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => Math.min(filtered.length - 1, Math.max(0, current + delta)))
    } else if (event.key === 'Enter' && open) {
      event.preventDefault()
      if (activeIndex >= 0 && filtered[activeIndex]) choose(filtered[activeIndex])
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'Tab') {
      close()
    }
  }

  const hasValue = Boolean(selected && selected.id !== NULL_OPTION_ID)
  const width = control.width ?? DEFAULT_DROPDOWN_WIDTH

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2" data-qqq-id={`widget-dropdown-control-${id}`}>
      <div ref={containerRef} className="relative max-w-full" style={{ width: `${width}px` }}>
        <div className="flex items-center rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
          {control.allowBackAndForth && (
            <button type="button" className={ICON_BUTTON} onClick={() => step(-1)} aria-label={`Previous ${label}`} data-qqq-id={`button-widget-dropdown-previous-${id}`}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {control.startIconName && (
            <WidgetIcon name={control.startIconName} className="ml-2 flex-shrink-0 text-lg text-muted-foreground" qqqId={`widget-dropdown-icon-${id}`} />
          )}
          <input
            ref={inputRef}
            role="combobox"
            aria-label={`Select ${label}`}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={open && activeIndex >= 0 && filtered[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
            placeholder={`Select ${label}`}
            value={query ?? selected?.label ?? ''}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
              setActiveIndex(0)
            }}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none pointer-coarse:h-11"
            data-qqq-id={`widget-dropdown-${id}`}
          />
          {hasValue && !control.disableClearable && (
            <button type="button" className={ICON_BUTTON} onClick={() => choose(null)} aria-label={`Clear ${label}`} data-qqq-id={`button-widget-dropdown-clear-${id}`}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          {control.allowBackAndForth && (
            <button type="button" className={ICON_BUTTON} onClick={() => step(1)} aria-label={`Next ${label}`} data-qqq-id={`button-widget-dropdown-next-${id}`}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {open && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={`${label} options`}
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg"
            data-qqq-id={`widget-dropdown-options-${id}`}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground" data-qqq-id={`widget-dropdown-no-options-${id}`}>No options found</li>
            ) : filtered.map((option, index) => (
              <li
                key={option.id}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={option.id === selected?.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'cursor-pointer whitespace-normal px-3 py-2 text-sm text-foreground pointer-coarse:min-h-11',
                  index === activeIndex && 'bg-accent',
                  option.id === selected?.id && 'font-semibold',
                )}
                data-qqq-id={`widget-dropdown-option-${id}-${option.id === NULL_OPTION_ID ? 'null' : option.id}`}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {isTimeframe && customChosen && (
        <div className="flex flex-wrap items-center gap-2" data-qqq-id={`widget-dropdown-custom-${id}`}>
          {(['start', 'end'] as const).map((end) => (
            <label key={end} className="flex flex-col text-xs text-muted-foreground">
              {end === 'start' ? 'Custom Timeframe Start' : 'Custom Timeframe End'}
              <input
                type="datetime-local"
                value={range[end]}
                onChange={(event) => {
                  const next = { ...range, [end]: event.target.value }
                  setRange(next)
                  sendRange(next, CUSTOM_TIMEFRAME_DEBOUNCE_MS)
                }}
                className="rounded border border-input bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring pointer-coarse:h-11"
                data-qqq-id={`widget-dropdown-custom-${end}-${id}`}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
