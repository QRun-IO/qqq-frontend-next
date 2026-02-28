'use client'

/**
 * ScriptEditor — a styled textarea for editing QQQ automation scripts.
 *
 * Provides a monospace editor with:
 * - Language badge and line-count toolbar
 * - Tab-key interception (inserts 2 spaces instead of changing focus)
 * - Read-only mode with distinct styling
 * - Inline error message display
 */

import React, { useCallback } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Props for the {@link ScriptEditor} component.
 */
export interface ScriptEditorProps {
  /** Unique identifier used for the `<label>` / `<textarea>` association and `data-qqq-id`. */
  id: string
  /** Human-readable label displayed above the editor. */
  label: string
  /** Current script content value (controlled). */
  value: string
  /**
   * Called whenever the editor content changes.
   *
   * @param value - The updated script content.
   */
  onChange: (value: string) => void
  /** Programming language used for the badge display. Defaults to `'text'`. */
  language?: 'javascript' | 'groovy' | 'python' | 'sql' | 'text'
  /** When `true`, the textarea is rendered as read-only with muted styling. */
  readOnly?: boolean
  /**
   * Validation error to display below the editor.
   * Compatible with React Hook Form's `FieldError` shape.
   */
  error?: { message?: string }
  /** Number of visible text rows for the textarea. Defaults to 12. */
  rows?: number
}

/** Human-readable display names for each supported language. */
const LANGUAGE_LABELS: Record<NonNullable<ScriptEditorProps['language']>, string> = {
  javascript: 'JavaScript',
  groovy: 'Groovy',
  python: 'Python',
  sql: 'SQL',
  text: 'Text',
}

/**
 * Counts the number of lines in the given string.
 *
 * @param value - The text content to count lines in.
 * @returns The number of lines (minimum 1).
 */
function countLines(value: string): number {
  if (!value) return 1
  return value.split('\n').length
}

/**
 * Renders a styled script editor textarea with toolbar, language badge, and
 * optional error display.
 *
 * Intercepts the Tab key to insert two spaces instead of moving focus, which
 * is the standard behavior users expect in code editors.
 *
 * @param props - {@link ScriptEditorProps}
 */
export function ScriptEditor({
  id,
  label,
  value,
  onChange,
  language = 'text',
  readOnly = false,
  error,
  rows = 12,
}: ScriptEditorProps) {
  const lineCount = countLines(value)
  const languageLabel = LANGUAGE_LABELS[language]
  const hasError = Boolean(error?.message)

  /**
   * Handles keydown events on the textarea.
   *
   * Intercepts Tab to insert two spaces at the cursor position instead of
   * shifting focus away from the editor.
   *
   * @param e - The keyboard event from the textarea.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        const textarea = e.currentTarget
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = value.substring(0, start) + '  ' + value.substring(end)
        onChange(newValue)
        // Restore cursor position after the inserted spaces
        // Use setTimeout so the DOM has time to update before repositioning
        setTimeout(() => {
          textarea.selectionStart = start + 2
          textarea.selectionEnd = start + 2
        }, 0)
      }
    },
    [value, onChange]
  )

  return (
    <div
      className="space-y-1"
      data-qqq-id={`script-editor-${id}`}
    >
      {/* Label */}
      <label
        htmlFor={id}
        className="block text-sm font-medium text-foreground"
      >
        {label}
      </label>

      {/* Editor container */}
      <div
        className={cn(
          'rounded-lg border',
          hasError ? 'border-destructive' : 'border-input',
          readOnly ? 'opacity-75' : ''
        )}
      >
        {/* Toolbar */}
        <div
          className={cn(
            'flex items-center justify-between px-3 py-1',
            'border-b border-input rounded-t-lg',
            'bg-background text-xs text-muted-foreground'
          )}
          aria-hidden="true"
        >
          {/* Language badge */}
          <span
            className={cn(
              'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
              'bg-muted text-muted-foreground'
            )}
          >
            {languageLabel}
          </span>

          {/* Right side: line count + keyboard hint */}
          <div className="flex items-center gap-3">
            {!readOnly && (
              <span className="text-muted-foreground/70 hidden sm:inline">
                Tab inserts spaces
              </span>
            )}
            <span>
              {lineCount} {lineCount === 1 ? 'line' : 'lines'}
            </span>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          rows={rows}
          aria-label={label}
          aria-required={false}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
          spellCheck={false}
          className={cn(
            'font-mono text-sm w-full resize-y p-3',
            'bg-muted rounded-b-lg',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
            'placeholder:text-muted-foreground/50',
            readOnly
              ? 'cursor-default text-muted-foreground'
              : 'text-foreground',
            'border-0' // border is on the container
          )}
        />
      </div>

      {/* Error message */}
      {hasError && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-sm text-destructive"
        >
          {error!.message}
        </p>
      )}
    </div>
  )
}
