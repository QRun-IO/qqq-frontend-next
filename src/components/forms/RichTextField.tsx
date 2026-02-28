/** RichTextField — a controlled textarea with a basic HTML formatting toolbar */
'use client'

import React, { useRef } from 'react'
import { Bold, Italic, Underline, Link } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Props for the {@link RichTextField} component.
 */
export interface RichTextFieldProps {
  /** Current HTML string value of the field. */
  value: string
  /** Callback invoked with the updated HTML string whenever the content changes. */
  onChange: (value: string) => void
  /** When true, the editor and all toolbar buttons are non-interactive. */
  disabled?: boolean
  /** HTML `id` applied to the contentEditable region for label association. */
  id?: string
  /** Accessible label for the content-editable region. */
  'aria-label'?: string
  /** Whether a value is required. */
  required?: boolean
  /** CSS class names appended to the outermost wrapper div. */
  className?: string
}

/** Labels and helpers for each toolbar formatting action. */
const TOOLBAR_ACTIONS = [
  { command: 'bold', icon: Bold, label: 'Bold' },
  { command: 'italic', icon: Italic, label: 'Italic' },
  { command: 'underline', icon: Underline, label: 'Underline' },
] as const

/**
 * A controlled rich-text editor built on a `contentEditable` `<div>`.
 *
 * Provides a lightweight formatting toolbar (Bold, Italic, Underline, Link)
 * that uses `document.execCommand` to apply inline HTML formatting.  The
 * component remains self-contained — no third-party WYSIWYG library is needed.
 *
 * The `value` / `onChange` interface mirrors a controlled `<textarea>` so the
 * parent form can treat this field identically to any other controlled input.
 *
 * @param props - See {@link RichTextFieldProps}.
 */
export function RichTextField({
  value,
  onChange,
  disabled = false,
  id,
  'aria-label': ariaLabel,
  required = false,
  className,
}: RichTextFieldProps) {
  const editorRef = useRef<HTMLDivElement>(null)

  /**
   * Applies a `document.execCommand` formatting instruction to the current
   * selection inside the contentEditable editor.
   *
   * @param command - The execCommand command string (e.g. 'bold', 'italic').
   */
  const applyFormat = (command: string) => {
    if (disabled) return
    editorRef.current?.focus()
    document.execCommand(command, false)
    // Sync updated inner HTML back to the parent form state
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  /**
   * Prompts for a URL and wraps the current selection in an anchor tag.
   */
  const applyLink = () => {
    if (disabled) return
    const url = window.prompt('Enter URL:')
    if (!url) return
    editorRef.current?.focus()
    document.execCommand('createLink', false, url)
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  /**
   * Syncs the contentEditable HTML to React state on every input event.
   */
  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  return (
    <div
      className={cn('flex flex-col gap-0', className)}
      data-qqq-id="rich-text-field"
    >
      {/* Formatting toolbar */}
      <div
        role="toolbar"
        aria-label="Text formatting"
        className={cn(
          'flex items-center gap-0.5 rounded-t-md border border-b-0 border-input bg-muted/50 px-2 py-1',
          disabled ? 'opacity-50 pointer-events-none' : ''
        )}
        data-qqq-id="rich-text-toolbar"
      >
        {TOOLBAR_ACTIONS.map(({ command, icon: Icon, label }) => (
          <button
            key={command}
            type="button"
            onMouseDown={(e) => {
              // Prevent the editor from losing focus
              e.preventDefault()
              applyFormat(command)
            }}
            disabled={disabled}
            aria-label={label}
            title={label}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded text-sm',
              'text-muted-foreground hover:text-foreground hover:bg-accent',
              'focus:outline-none focus:ring-1 focus:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-colors duration-100'
            )}
            data-qqq-id={`rich-text-${command}`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ))}

        {/* Separator */}
        <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

        {/* Link */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            applyLink()
          }}
          disabled={disabled}
          aria-label="Insert link"
          title="Insert link"
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded text-sm',
            'text-muted-foreground hover:text-foreground hover:bg-accent',
            'focus:outline-none focus:ring-1 focus:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors duration-100'
          )}
          data-qqq-id="rich-text-link"
        >
          <Link className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Content-editable editor */}
      <div
        ref={editorRef}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        aria-required={required}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        // Set initial HTML; subsequent updates are managed by execCommand
        dangerouslySetInnerHTML={{ __html: value }}
        className={cn(
          'min-h-[120px] w-full rounded-b-md border border-input bg-background px-3 py-2',
          'text-sm text-foreground',
          'focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring',
          'disabled:cursor-not-allowed',
          disabled ? 'bg-muted text-muted-foreground cursor-not-allowed' : '',
          '[&_a]:text-primary [&_a]:underline',
          'prose prose-sm max-w-none'
        )}
        data-qqq-id="rich-text-editor"
      />

      <p className="mt-1 text-xs text-muted-foreground">
        HTML formatting is supported. Use the toolbar or type HTML directly.
      </p>
    </div>
  )
}
