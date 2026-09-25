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
 * @file CronScheduleEditor — edits a cron expression on record forms, as the
 * Material `CronUIWidget` does: a Basic mode that picks days, hours and minutes,
 * an Advanced mode for the raw Quartz expression, and a live human-readable
 * description (or the reason the expression is not valid).
 */
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { ChevronDown } from 'lucide-react'

import {
  CRON_PART_NAMES,
  CRON_WEEKDAYS,
  buildBasicExpression,
  checkCron,
  cronPartAtCaret,
  hourLabel,
  minuteLabel,
  ordinalDay,
  parseBasicSchedule,
} from '@/lib/utils/cron-utils'
import type { BasicCronSchedule, CronCheck, CronDaysOption, CronTimeOption } from '@/lib/utils/cron-utils'
import { cn } from '@/lib/utils/cn'

/** Pause after typing before the description is refreshed. */
const DESCRIBE_DELAY_MS = 250

/** Props accepted by {@link CronScheduleEditor}. */
export interface CronScheduleEditorProps {
  /** Id of the expression input; other element ids derive from it. */
  id: string
  /** Suffix of the `data-qqq-id` attributes (the cron widget's name). */
  qqqId: string
  /** Label of the cron expression field. */
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  /** Receives the element to focus for a validation error (React Hook Form's `field.ref`). */
  focusRef?: React.Ref<HTMLElement>
  required?: boolean
  disabled?: boolean
  /** Form validation message for the expression field. */
  error?: string
}

type Slot = 'days' | 'hours' | 'minutes'

interface SlotChoice { value: number; label: string }

const WEEKDAY_CHOICES: SlotChoice[] = CRON_WEEKDAYS.map((day) => ({ value: day.number, label: day.label }))
const DATE_CHOICES: SlotChoice[] = Array.from({ length: 31 }, (_, index) => ({ value: index + 1, label: ordinalDay(index + 1) }))
const HOUR_CHOICES: SlotChoice[] = Array.from({ length: 24 }, (_, index) => ({ value: index, label: hourLabel(index) }))
const MINUTE_CHOICES: SlotChoice[] = Array.from({ length: 60 }, (_, index) => ({ value: index, label: minuteLabel(index) }))

const weekdayShort = (value: number) => CRON_WEEKDAYS[value - 1]?.label.slice(0, 3) ?? String(value)

/**
 * The text a Basic slot shows for its current choice.
 *
 * @param slot - Days, hours or minutes.
 * @param schedule - The parsed schedule.
 * @returns The summary text.
 */
function slotSummary(slot: Slot, schedule: BasicCronSchedule): string {
  if (slot === 'days') {
    const { option, values } = schedule.days
    if (option === 'selectedWeekdays' && values.length > 0) return values.map(weekdayShort).join(', ')
    if (option === 'selectedDates' && values.length > 0) return values.map(ordinalDay).join(', ')
    return 'Every day'
  }
  const { option, values } = schedule[slot]
  if (option === 'every' || values.length === 0) return slot === 'hours' ? 'Every hour' : 'Every minute'
  return values.map(slot === 'hours' ? hourLabel : minuteLabel).join(', ')
}

/** The radio options of each slot: value, label, and the values it selects from. */
const SLOT_OPTIONS: Record<Slot, Array<{ option: string; label: string; choices?: SlotChoice[] }>> = {
  days: [
    { option: 'selectedWeekdays', label: 'Selected Weekdays', choices: WEEKDAY_CHOICES },
    { option: 'selectedDates', label: 'Selected Dates', choices: DATE_CHOICES },
    { option: 'every', label: 'Every Day' },
  ],
  hours: [
    { option: 'selected', label: 'Selected Hours', choices: HOUR_CHOICES },
    { option: 'every', label: 'Every Hour' },
  ],
  minutes: [
    { option: 'selected', label: 'Selected Minutes', choices: MINUTE_CHOICES },
    { option: 'every', label: 'Every Minute' },
  ],
}

const SLOT_LABELS: Record<Slot, string> = { days: 'Days', hours: 'Hours', minutes: 'Minutes' }
const CHOICE_COLUMNS: Record<string, string> = {
  selectedWeekdays: 'grid-cols-2',
  selectedDates: 'grid-cols-5',
  hours: 'grid-cols-4',
  minutes: 'grid-cols-6',
}

interface SlotPickerProps {
  slot: Slot
  baseId: string
  qqqId: string
  schedule: BasicCronSchedule
  isEmpty: boolean
  required: boolean
  disabled: boolean
  invalid: boolean
  describedBy?: string
  onChange: (slot: Slot, next: { option: string; values: number[] }) => void
  onClose?: () => void
  triggerRef?: React.Ref<HTMLButtonElement>
}

/**
 * One Basic-mode slot: a button showing the current choice that opens a popover
 * with "every" or "selected" options and the values to select.
 *
 * @param props - See {@link SlotPickerProps}.
 * @returns The labeled picker.
 */
function SlotPicker({ slot, baseId, qqqId, schedule, isEmpty, required, disabled, invalid, describedBy, onChange, onClose, triggerRef }: SlotPickerProps) {
  const [open, setOpen] = useState(false)
  const current = schedule[slot]
  // The chosen option while the popover is open: "selected" with nothing checked yet
  // still schedules every value, so it is kept here rather than read from the expression.
  const [draftOption, setDraftOption] = useState<string>(current.option)
  const labelId = `${baseId}-${slot}-label`
  const triggerId = `${baseId}-${slot}`
  const options = SLOT_OPTIONS[slot]
  const active = options.find((entry) => entry.option === draftOption)
  const summary = isEmpty ? 'Not set' : slotSummary(slot, schedule)

  const openChange = (next: boolean) => {
    if (next) setDraftOption(current.option)
    setOpen(next)
    if (!next) onClose?.()
  }

  const chooseOption = (option: string) => {
    setDraftOption(option)
    if (option === 'every') onChange(slot, { option, values: [] })
  }

  const toggleValue = (value: number, checked: boolean) => {
    const values = draftOption === current.option ? current.values : []
    onChange(slot, { option: draftOption, values: checked ? [...values, value] : values.filter((existing) => existing !== value) })
  }

  const selectedValues = draftOption === current.option ? current.values : []
  const columns = CHOICE_COLUMNS[slot === 'days' ? draftOption : slot] ?? 'grid-cols-4'

  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-sm font-medium text-foreground">
        {SLOT_LABELS[slot]}
        {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
      </span>
      <PopoverPrimitive.Root open={open} onOpenChange={openChange}>
        <PopoverPrimitive.Trigger asChild>
          <button
            ref={triggerRef}
            id={triggerId}
            type="button"
            disabled={disabled}
            aria-labelledby={`${labelId} ${triggerId}`}
            aria-describedby={describedBy}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm',
              'focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted',
              invalid ? 'border-destructive' : 'border-input',
              isEmpty ? 'text-muted-foreground' : 'text-foreground'
            )}
            data-qqq-id={`cron-${slot}-${qqqId}`}
          >
            <span className="truncate">{summary}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={4}
            collisionPadding={16}
            role="dialog"
            aria-label={SLOT_LABELS[slot]}
            className="z-[200] w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-4 text-sm text-popover-foreground shadow-md"
            data-qqq-id={`cron-${slot}-popover-${qqqId}`}
          >
            <fieldset className="space-y-2">
              <legend className="mb-1 font-semibold">{SLOT_LABELS[slot]}</legend>
              {options.map((entry) => (
                <div key={entry.option} className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`${triggerId}-option`}
                      value={entry.option}
                      checked={draftOption === entry.option}
                      onChange={() => chooseOption(entry.option)}
                      className="h-4 w-4 accent-primary"
                    />
                    {entry.label}
                  </label>
                  {entry.choices && draftOption === entry.option && (
                    <fieldset className={cn('grid gap-1 pl-6', columns)} data-qqq-id={`cron-${slot}-choices-${qqqId}`}>
                      <legend className="sr-only">{entry.label}</legend>
                      {entry.choices.map((choice) => (
                        <label key={choice.value} className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent">
                          <input
                            type="checkbox"
                            checked={selectedValues.includes(choice.value)}
                            onChange={(event) => toggleValue(choice.value, event.target.checked)}
                            className="h-4 w-4 accent-primary"
                          />
                          {choice.label}
                        </label>
                      ))}
                    </fieldset>
                  )}
                </div>
              ))}
            </fieldset>
            {active?.choices && selectedValues.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">{`With nothing selected, the schedule runs ${SLOT_OPTIONS[slot].find((entry) => entry.option === 'every')?.label.toLowerCase()}.`}</p>
            )}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  )
}

/**
 * Edits a Quartz cron expression with Basic and Advanced modes and a live
 * description. The description follows the backend's describer, so it matches
 * the one stored with the record; the server still validates the expression on save.
 *
 * @param props - See {@link CronScheduleEditorProps}.
 * @returns The schedule editor.
 */
export function CronScheduleEditor({ id, qqqId, label, value, onChange, onBlur, focusRef, required = false, disabled = false, error }: CronScheduleEditorProps) {
  const basic = useMemo(() => parseBasicSchedule(value), [value])
  const basicReason = 'reason' in basic ? basic.reason : undefined
  const [mode, setMode] = useState<'basic' | 'advanced'>(() => (basicReason ? 'advanced' : 'basic'))
  const activeMode = basicReason ? 'advanced' : mode
  const [check, setCheck] = useState<CronCheck & { expression: string }>(() => ({ expression: value, ...checkCron(value) }))
  const [caretPart, setCaretPart] = useState<string | undefined>()

  useEffect(() => {
    if (check.expression === value) return
    const timer = setTimeout(() => setCheck({ expression: value, ...checkCron(value) }), DESCRIBE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [value, check.expression])

  const descriptionId = `${id}-description`
  const formErrorId = `${id}-error`
  const reasonId = `${id}-basic-reason`
  const formatId = `${id}-format`
  const invalid = Boolean(error) || (check.expression === value && Boolean(check.error))
  const describedBy = [descriptionId, error ? formErrorId : undefined].filter(Boolean).join(' ')

  const updateSlot = (slot: Slot, next: { option: string; values: number[] }) => {
    if (!('schedule' in basic)) return
    const schedule: BasicCronSchedule = {
      ...basic.schedule,
      [slot]: slot === 'days'
        ? { option: next.option as CronDaysOption, values: next.values }
        : { option: next.option as CronTimeOption, values: next.values },
    }
    onChange(buildBasicExpression(schedule))
  }

  const trackCaret = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    setCaretPart(cronPartAtCaret(input.value, input.selectionStart ?? input.value.length))
  }

  const modeButton = (buttonMode: 'basic' | 'advanced', text: string) => (
    <button
      type="button"
      aria-pressed={activeMode === buttonMode}
      disabled={disabled || (buttonMode === 'basic' && Boolean(basicReason))}
      aria-describedby={buttonMode === 'basic' && basicReason ? reasonId : undefined}
      onClick={() => setMode(buttonMode)}
      className={cn(
        'rounded px-3 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        activeMode === buttonMode ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
      data-qqq-id={`cron-mode-${buttonMode}-${qqqId}`}
    >
      {text}
    </button>
  )

  return (
    <fieldset className="min-w-0 space-y-3" data-qqq-id={`cron-editor-${qqqId}`}>
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Schedule editor mode" className="inline-flex rounded-md border border-border bg-muted/50 p-0.5">
          {modeButton('basic', 'Basic')}
          {modeButton('advanced', 'Advanced')}
        </div>
        <button
          type="button"
          disabled={disabled || value === ''}
          onClick={() => onChange('')}
          className="rounded px-2 py-1 text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Clear ${label}`}
          data-qqq-id={`cron-clear-${qqqId}`}
        >
          Clear
        </button>
      </div>
      {basicReason && (
        <p id={reasonId} className="text-xs text-muted-foreground" data-qqq-id={`cron-basic-reason-${qqqId}`}>{basicReason}</p>
      )}

      {activeMode === 'basic' && 'schedule' in basic ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(['days', 'hours', 'minutes'] as const).map((slot, index) => (
            <SlotPicker
              key={slot}
              slot={slot}
              baseId={id}
              qqqId={qqqId}
              schedule={basic.schedule}
              isEmpty={value.trim() === ''}
              required={required}
              disabled={disabled}
              invalid={invalid}
              describedBy={describedBy}
              onChange={updateSlot}
              onClose={onBlur}
              triggerRef={index === 0 ? (focusRef as React.Ref<HTMLButtonElement>) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
            {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
          </label>
          <input
            ref={focusRef as React.Ref<HTMLInputElement>}
            id={id}
            type="text"
            value={value}
            disabled={disabled}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => { onChange(event.target.value); trackCaret(event) }}
            onSelect={trackCaret}
            onKeyUp={trackCaret}
            onClick={trackCaret}
            onFocus={trackCaret}
            onBlur={() => { setCaretPart(undefined); onBlur?.() }}
            aria-required={required}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={`${describedBy} ${formatId}`}
            className={cn(
              'w-full rounded-md border bg-background px-3 py-2 font-mono text-sm text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted',
              invalid ? 'border-destructive' : 'border-input'
            )}
            data-qqq-id={`cron-expression-input-${qqqId}`}
          />
          <p id={formatId} className="flex flex-wrap gap-x-2 text-xs text-muted-foreground" data-qqq-id={`cron-format-${qqqId}`}>
            {CRON_PART_NAMES.map((part, index) => (
              <span key={part} className={cn(caretPart === part && 'font-semibold text-foreground')} aria-current={caretPart === part ? 'true' : undefined}>
                {index === CRON_PART_NAMES.length - 1 ? `[${part}]` : part}
              </span>
            ))}
          </p>
        </div>
      )}

      <div id={descriptionId} aria-live="polite" className="text-sm" data-qqq-id={`cron-live-${qqqId}`}>
        {check.description && <p className="text-foreground" data-qqq-id={`cron-editor-description-${qqqId}`}>{check.description}</p>}
        {check.error && <p className="text-destructive" data-qqq-id={`cron-editor-error-${qqqId}`}>{check.error}</p>}
      </div>
      {error && (
        <p id={formErrorId} role="alert" className="text-sm text-destructive">{error}</p>
      )}
    </fieldset>
  )
}
