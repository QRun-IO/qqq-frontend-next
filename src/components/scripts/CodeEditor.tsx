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
 * @file CodeEditor — a native textarea with a syntax-colored overlay, used for every
 * editable code box (CODE_EDITOR fields, script files, data bag JSON).
 *
 * The textarea stays the real, accessible input: its own text is transparent and an
 * `aria-hidden` `<pre>` behind it draws the same text in color. Under forced colors
 * (Windows High Contrast) the overlay is hidden and the textarea shows its text.
 *
 * Keyboard (WCAG 2.1.2 No Keyboard Trap, QRun-IO/qqq#776): Tab inserts two spaces and
 * Shift+Tab removes them, as in a code editor. Two ways out, both announced through the
 * editor's description:
 * - Esc, then Tab or Shift+Tab: the next Tab moves focus (once).
 * - Ctrl+M: switches Tab between indenting and moving focus, for every code box on the
 *   page, until pressed again (VS Code's "Toggle Tab Key Moves Focus"). Ctrl+M rather
 *   than Cmd+M, which minimizes the window on macOS.
 * A read-only editor never captures Tab. Esc is not swallowed: in a dialog that closes on
 * Esc, it still does.
 */

'use client'

import React, { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { CodeLanguage } from '@/lib/utils/code-highlight'
import { cn } from '@/lib/utils/cn'
import { findCodeCompletions, type CodeCompletionMatch } from '@/lib/utils/code-completions'
import { HighlightedCode } from './HighlightedCode'

/** The text a Tab inserts. */
const INDENT = '  '

/** Page-wide "Tab moves focus" mode (Ctrl+M), shared by every code editor. */
let tabMovesFocus = false
const tabModeListeners = new Set<() => void>()

/**
 * Subscribes to the page-wide Tab mode.
 * @param listener - Called when the mode changes.
 * @returns The unsubscribe function.
 */
function subscribeTabMode(listener: () => void): () => void {
  tabModeListeners.add(listener)
  return () => {
    tabModeListeners.delete(listener)
  }
}

/**
 * Reads the page-wide Tab mode.
 * @returns True when Tab moves focus instead of indenting.
 */
function readTabMode(): boolean {
  return tabMovesFocus
}

/**
 * The server snapshot of the Tab mode (always indenting).
 * @returns False.
 */
function readServerTabMode(): boolean {
  return false
}

/**
 * Sets the page-wide Tab mode.
 * @param value - True for "Tab moves focus".
 */
function setTabMode(value: boolean): void {
  tabMovesFocus = value
  tabModeListeners.forEach((listener) => listener())
}

/** Props for {@link CodeEditor}. */
export interface CodeEditorProps {
  /** Id of the textarea (a `<label htmlFor>` elsewhere names it, or pass `ariaLabel`). */
  id: string
  /** The code (controlled). */
  value: string
  /**
   * Called with the new code on every change.
   * @param value - The updated code.
   */
  onChange?: (value: string) => void
  /** Language to color the code as. */
  language: CodeLanguage
  /** Enable local code suggestions for script files. */
  autocomplete?: boolean
  /** Read-only: selectable and focusable, never edited, never captures Tab. */
  readOnly?: boolean
  /** Visible rows. Defaults to 12. */
  rows?: number
  /** Accessible name when no `<label>` points at the textarea. */
  ariaLabel?: string
  /** Ids of further describing elements (for example an error message). */
  describedBy?: string
  /** Marks the textarea invalid. */
  invalid?: boolean
  /** Marks the textarea required. */
  required?: boolean
  /** `data-qqq-id` of the textarea. */
  dataQqqId?: string
  /** Extra classes for the outer wrapper. */
  className?: string
  /** Classes that size the code box (height / min-height); rows apply otherwise. */
  boxClassName?: string
}

/**
 * Status text of the Tab key for the live region.
 * @param movesFocus - Page-wide mode.
 * @param released - Esc was pressed and the next Tab moves focus.
 * @returns The status sentence.
 */
function tabStatus(movesFocus: boolean, released: boolean): string {
  if (movesFocus) return 'Tab moves focus'
  if (released) return 'Next Tab moves focus'
  return 'Tab inserts spaces'
}

/**
 * Replaces a range of the textarea's text, keeping the browser's undo history when it can.
 * @param textarea - The textarea.
 * @param start - Start of the range.
 * @param end - End of the range.
 * @param text - Replacement text.
 * @returns True when the browser applied the edit (an `input` event follows).
 */
function insertText(textarea: HTMLTextAreaElement, start: number, end: number, text: string): boolean {
  textarea.setSelectionRange(start, end)
  try {
    return typeof document.execCommand === 'function' && document.execCommand('insertText', false, text)
  } catch {
    return false
  }
}

/**
 * The editable (or read-only) code box with its keyboard hint.
 *
 * @param props - {@link CodeEditorProps}
 * @returns The editor.
 */
export function CodeEditor({
  id,
  value,
  onChange,
  language,
  readOnly = false,
  autocomplete = false,
  rows = 12,
  ariaLabel,
  describedBy,
  invalid = false,
  required = false,
  dataQqqId,
  className,
  boxClassName,
}: CodeEditorProps) {
  const movesFocus = useSyncExternalStore(subscribeTabMode, readTabMode, readServerTabMode)
  const [released, setReleased] = useState(false)
  const [completion, setCompletion] = useState<(CodeCompletionMatch & { selected: number; top: number; left: number; height: number; caret: number; source: string; scrollTop: number; scrollLeft: number }) | null>(null)
  const composing = useRef(false)
  const metricsRef = useRef<HTMLSpanElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelection = useRef<[number, number] | null>(null)
  const hintId = `${id}-keyboard-hint`
  const statusId = `${id}-tab-status`
  const listId = `${id}-suggestions`
  const shown = autocomplete && !readOnly ? completion : null

  useLayoutEffect(() => {
    if (shown) document.getElementById(`${listId}-${shown.selected}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [shown, listId])

  /**
   * Refreshes local suggestions and positions the list beside the visible caret.
   * @param textarea - The editor input.
   * @param explicit - Whether Ctrl+Space requested suggestions.
   */
  function suggest(textarea: HTMLTextAreaElement, explicit = false) {
    if (!autocomplete || readOnly || composing.current || textarea.selectionStart !== textarea.selectionEnd) {
      setCompletion(null)
      return
    }
    const match = findCodeCompletions(textarea.value, textarea.selectionStart, language, explicit)
    if (!match) { setCompletion(null); return }
    const before = textarea.value.slice(0, textarea.selectionStart).split('\n')
    const metrics = metricsRef.current?.getBoundingClientRect()
    const lineHeight = metrics?.height || 24
    const characterWidth = metrics?.width || 8.4
    const caretTop = 12 + (before.length - 1) * lineHeight - textarea.scrollTop
    const height = Math.min(192, Math.max(72, textarea.clientHeight - 24))
    const top = caretTop + lineHeight + height <= textarea.clientHeight ? caretTop + lineHeight : Math.max(0, caretTop - height)
    const column = before.at(-1)!.replace(/\t/g, '        ').length
    const left = Math.min(Math.max(0, 12 + column * characterWidth - textarea.scrollLeft), Math.max(0, textarea.clientWidth - 320))
    setCompletion({ ...match, selected: 0, top, left, height, caret: textarea.selectionStart, source: textarea.value, scrollTop: textarea.scrollTop, scrollLeft: textarea.scrollLeft })
  }

  /**
   * Applies one suggestion as a normal undoable textarea edit.
   * @param index - The selected item.
   */
  function acceptCompletion(index: number) {
    const textarea = textareaRef.current
    if (!shown || !textarea) return
    if (textarea.value !== shown.source || textarea.selectionStart !== shown.caret || textarea.selectionEnd !== shown.caret) {
      setCompletion(null)
      return
    }
    const item = shown.items[index]
    let end = shown.end
    if (item.text.endsWith('(') && value[end] === '(') end++
    textarea.focus()
    const caret = shown.start + item.text.length
    edit(textarea, shown.start, end, item.text, [caret, caret])
    setCompletion(null)
  }

  useLayoutEffect(() => {
    const selection = pendingSelection.current
    const textarea = textareaRef.current
    if (selection && textarea) textarea.setSelectionRange(selection[0], selection[1])
    pendingSelection.current = null
  }, [value])

  /** Keeps the colored overlay aligned with the textarea's scroll position. */
  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current
    const overlay = overlayRef.current
    if (textarea && overlay) overlay.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`
  }, [])

  /**
   * Applies an edit: through the browser when it can (undo keeps working), else through onChange.
   * @param textarea - The textarea.
   * @param start - Start of the replaced range.
   * @param end - End of the replaced range.
   * @param text - Replacement text.
   * @param selection - Selection to restore afterwards.
   */
  function edit(textarea: HTMLTextAreaElement, start: number, end: number, text: string, selection: [number, number]) {
    if (insertText(textarea, start, end, text)) {
      textarea.setSelectionRange(selection[0], selection[1])
      return
    }
    const next = value.slice(0, start) + text + value.slice(end)
    if (next === value) {
      textarea.setSelectionRange(selection[0], selection[1])
      return
    }
    pendingSelection.current = selection
    onChange?.(next)
  }

  /**
   * Indents (Tab) or outdents (Shift+Tab) the caret or the selected lines.
   * @param textarea - The textarea.
   * @param outdent - Whether to remove indentation.
   */
  function indent(textarea: HTMLTextAreaElement, outdent: boolean) {
    const { selectionStart: start, selectionEnd: end } = textarea
    const multiLine = value.slice(start, end).includes('\n')
    if (!outdent && !multiLine) {
      edit(textarea, start, end, INDENT, [start + INDENT.length, start + INDENT.length])
      return
    }
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const block = value.slice(lineStart, end)
    const lines = block.split('\n')
    let removedBeforeCaret = 0
    const changed = lines.map((line, index) => {
      if (!outdent) return INDENT + line
      const removed = line.startsWith(INDENT) ? INDENT.length : line.startsWith(' ') || line.startsWith('\t') ? 1 : 0
      if (index === 0) removedBeforeCaret = Math.min(removed, start - lineStart)
      return line.slice(removed)
    })
    const replacement = changed.join('\n')
    if (replacement === block) return
    const delta = replacement.length - block.length
    const newStart = outdent ? start - removedBeforeCaret : start + INDENT.length
    const newEnd = multiLine ? end + delta : newStart
    edit(textarea, lineStart, end, replacement, [newStart, Math.max(newStart, newEnd)])
  }

  /**
   * Keyboard handling: Tab indents unless released; Esc releases the next Tab; Ctrl+M toggles.
   * @param event - The keydown event.
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (composing.current || event.nativeEvent.isComposing) return
    if (autocomplete && !readOnly && event.ctrlKey && event.key === ' ' && !event.altKey && !event.metaKey) {
      event.preventDefault()
      suggest(event.currentTarget, true)
      return
    }
    if (shown && !event.ctrlKey && !event.altKey && !event.metaKey) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        setCompletion({ ...shown, selected: (shown.selected + step + shown.items.length) % shown.items.length })
        return
      }
      if (event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey && !movesFocus && !released)) {
        event.preventDefault()
        acceptCompletion(shown.selected)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setCompletion(null)
        setReleased(true)
        return
      }
    }
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Tab', 'Escape'].includes(event.key) || event.ctrlKey || event.metaKey) setCompletion(null)
    if (event.key.toLowerCase() === 'm' && event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      event.preventDefault()
      setReleased(false)
      setTabMode(!movesFocus)
      return
    }
    if (event.key === 'Escape') {
      if (!readOnly) setReleased(true)
      return
    }
    if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) {
      if (released && event.key !== 'Shift') setReleased(false)
      return
    }
    if (readOnly || movesFocus || released) {
      // let the browser move focus
      setReleased(false)
      return
    }
    event.preventDefault()
    indent(event.currentTarget, event.shiftKey)
  }

  const describedByIds = [readOnly ? undefined : hintId, describedBy].filter(Boolean).join(' ') || undefined
  // A trailing newline has no height in a <pre>; a space keeps the overlay as tall as the text.
  const overlayText = value.endsWith('\n') ? `${value} ` : value

  return (
    <div className={cn('space-y-1', className)}>
      <div
        className={cn(
          'relative overflow-hidden rounded-md border bg-muted',
          invalid ? 'border-destructive' : 'border-input',
          'focus-within:ring-2 focus-within:ring-ring'
        )}
      >
        <pre
          aria-hidden="true"
          className="qqq-code-overlay pointer-events-none absolute inset-0 m-0 overflow-hidden p-3 font-mono text-sm leading-6 text-foreground"
        >
          <code ref={overlayRef} className="block whitespace-pre">
            <HighlightedCode code={overlayText} language={language} />
          </code>
        </pre>
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(event) => { onChange?.(event.target.value); suggest(event.currentTarget) }}
          onKeyDown={handleKeyDown}
          onScroll={(event) => {
            syncScroll()
            // A deferred browser event can report the position already used to place suggestions.
            if (shown && (shown.scrollTop !== event.currentTarget.scrollTop || shown.scrollLeft !== event.currentTarget.scrollLeft)) setCompletion(null)
          }}
          onClick={() => setCompletion(null)}
          onCompositionStart={() => { composing.current = true; setCompletion(null) }}
          onCompositionEnd={(event) => { composing.current = false; suggest(event.currentTarget) }}
          onBlur={(event) => {
            setReleased(false)
            if (!listRef.current?.contains(event.relatedTarget)) setCompletion(null)
          }}
          readOnly={readOnly}
          rows={rows}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={ariaLabel}
          aria-autocomplete={autocomplete && !readOnly ? 'list' : undefined}
          aria-controls={shown ? listId : undefined}
          aria-activedescendant={shown ? `${listId}-${shown.selected}` : undefined}
          aria-describedby={describedByIds}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          data-qqq-id={dataQqqId}
          className={cn(
            'qqq-code-input relative block w-full resize-y border-0 bg-transparent p-3 font-mono text-sm leading-6',
            'whitespace-pre text-transparent caret-foreground selection:bg-primary/25 focus:outline-none',
            readOnly && 'cursor-default',
            boxClassName
          )}
        />
        {autocomplete && <span ref={metricsRef} aria-hidden="true" className="pointer-events-none invisible absolute font-mono text-sm leading-6">M</span>}
        {shown && <div ref={listRef} id={listId} role="listbox" aria-label="Code suggestions"
          data-qqq-id={`code-suggestions-${id}`} className="absolute z-10 w-80 max-w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
          style={{ top: shown.top, left: shown.left, maxHeight: shown.height }}>
          {shown.items.map((item, index) => <button key={item.text} id={`${listId}-${index}`} type="button" role="option"
            tabIndex={-1} aria-selected={index === shown.selected} onMouseDown={(event) => event.preventDefault()}
            onClick={() => acceptCompletion(index)} data-qqq-id={`code-suggestion-${id}-${index}`}
            className="flex min-h-11 w-full flex-col items-start rounded px-2 py-1 text-left text-sm text-popover-foreground hover:bg-accent aria-selected:bg-accent">
            <span className="font-mono">{item.text}</span><span className="text-xs text-muted-foreground">{item.description}</span>
          </button>)}
        </div>}
      </div>
      {!readOnly && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted-foreground">
          <p id={hintId}>
            {autocomplete && 'Code suggestions: Ctrl+Space to open, arrows to choose, Enter or Tab to insert, Escape to dismiss. '}
            Tab inserts two spaces. To move focus out of the code, press Esc and then Tab, or press Ctrl+M to make Tab move focus.
          </p>
          <span id={statusId} role="status" aria-live="polite" className="font-medium">
            {tabStatus(movesFocus, released)}
          </span>
        </div>
      )}
    </div>
  )
}
