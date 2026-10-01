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
 * @file ScriptEditor — the labeled code box of CODE_EDITOR form fields (Material: an Ace
 * editor in the field's `languageMode`).
 *
 * Provides:
 * - Language badge and line-count toolbar
 * - Syntax coloring ({@link CodeEditor})
 * - Tab indents, with a documented way out: Esc then Tab, or Ctrl+M (QRun-IO/qqq#776)
 * - Read-only mode with distinct styling
 * - Inline error message display
 */

'use client'

import React from 'react'

import { languageFor } from '@/lib/utils/code-highlight'
import { cn } from '@/lib/utils/cn'
import { CodeEditor } from '@/components/scripts/CodeEditor'

/** Languages the editor badge names. */
export type ScriptEditorLanguage = 'javascript' | 'groovy' | 'java' | 'python' | 'sql' | 'json' | 'velocity' | 'html' | 'text'

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
  /** Programming language used for the badge and the coloring. Defaults to `'text'`. */
  language?: ScriptEditorLanguage
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
const LANGUAGE_LABELS: Record<ScriptEditorLanguage, string> = {
  javascript: 'JavaScript',
  groovy: 'Groovy',
  java: 'Java',
  python: 'Python',
  sql: 'SQL',
  json: 'JSON',
  velocity: 'Velocity',
  html: 'HTML',
  text: 'Text',
}

/**
 * Maps a CODE_EDITOR `languageMode` or a script file type to an editor language.
 *
 * @param mode - Language mode or file type.
 * @returns The editor language (`text` when not one of its languages).
 */
export function scriptEditorLanguage(mode: string | null | undefined): ScriptEditorLanguage {
  const normalized = (mode ?? '').trim().toLowerCase()
  if (normalized === 'js') return 'javascript'
  if (normalized === 'xml') return 'html'
  return normalized in LANGUAGE_LABELS ? normalized as ScriptEditorLanguage : 'text'
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
 * Renders a labeled, syntax-colored code editor with toolbar, language badge, keyboard
 * hint and optional error display.
 *
 * @param props - {@link ScriptEditorProps}
 * @returns The rendered script editor with toolbar and optional error message.
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
  const hasError = Boolean(error?.message)

  return (
    <div className="space-y-1" data-qqq-id={`script-editor-${id}`}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>

      <div className={cn(readOnly ? 'opacity-75' : '')}>
        <div
          className="flex items-center justify-between px-1 pb-1 text-xs text-muted-foreground"
          aria-hidden="true"
        >
          <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {LANGUAGE_LABELS[language]}
          </span>
          <span>
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>
        <CodeEditor
          id={id}
          value={value}
          onChange={onChange}
          language={languageFor(language)}
          readOnly={readOnly}
          rows={rows}
          invalid={hasError}
          describedBy={hasError ? `${id}-error` : undefined}
        />
      </div>

      {hasError && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error!.message}
        </p>
      )}
    </div>
  )
}
