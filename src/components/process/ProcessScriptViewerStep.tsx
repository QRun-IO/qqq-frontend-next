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
 * ProcessScriptViewerStep — renders a SCRIPT_VIEWER process step.
 *
 * Displays code/script content from `stepValues` or step component metadata
 * inside a syntax-highlighted, scrollable code block.  Supports an optional
 * language hint from the component's `values.language` field.  Provides the
 * standard Cancel / Back / Next navigation bar.
 */
'use client'

// ProcessScriptViewerStep -- renders a SCRIPT_VIEWER step
// Shows code/script content in a styled read-only code block with copy support

import React, { useState, useMemo } from 'react'
import { ChevronRight, X, Code, Copy, Check as CheckIcon } from 'lucide-react'

import type { QFrontendStepMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

/**
 * Props for the {@link ProcessScriptViewerStep} component.
 */
export interface ProcessScriptViewerStepProps {
  /** Metadata for the current process step, including `components` and `viewFields`. */
  step: QFrontendStepMetaData
  /** Current accumulated step values; `script` / `code` / `scriptContent` keys are checked. */
  stepValues: Record<string, unknown>
  /** Whether a submission is in progress; disables navigation controls while true. */
  isLoading: boolean
  /**
   * Called when the user advances past this step.
   *
   * @param values - The current step values passed through unchanged.
   */
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  /** Called when the user confirms cancellation of the process. */
  onCancel: () => void
  /** Called when the user clicks Back; only rendered if `canGoBack` is true. */
  onBack?: () => void
  /** Whether a previous step exists to navigate back to. */
  canGoBack: boolean
  /** Whether this is the final step in the process (controls button label). */
  isLastStep: boolean
}

/**
 * Resolves the script/code content to display from multiple candidate sources.
 *
 * Checks `stepValues` for common keys, then falls back to the step's SCRIPT_VIEWER
 * component values.
 *
 * @param step - The current step metadata.
 * @param stepValues - The current accumulated step values.
 * @returns The raw script string, or an empty string if none is found.
 */
function resolveScriptContent(
  step: QFrontendStepMetaData,
  stepValues: Record<string, unknown>
): string {
  // Check stepValues for script content under common keys
  for (const key of ['script', 'code', 'scriptContent', 'codeContent']) {
    const val = stepValues[key]
    if (typeof val === 'string' && val.length > 0) return val
  }

  // Check the SCRIPT_VIEWER component's values
  const scriptComp = step.components.find((c) => (c.type as string) === 'SCRIPT_VIEWER')
  for (const key of ['script', 'code', 'content']) {
    const val = scriptComp?.values?.[key]
    if (typeof val === 'string' && val.length > 0) return val
  }

  return ''
}

/**
 * Resolves the programming language hint for the code block, used for labelling.
 *
 * @param step - The current step metadata.
 * @param stepValues - The current accumulated step values.
 * @returns A language string (e.g. `'javascript'`), or `'plaintext'` as default.
 */
function resolveLanguage(
  step: QFrontendStepMetaData,
  stepValues: Record<string, unknown>
): string {
  const fromValues = stepValues.language ?? stepValues.scriptLanguage
  if (typeof fromValues === 'string' && fromValues.length > 0) return fromValues

  const scriptComp = step.components.find((c) => (c.type as string) === 'SCRIPT_VIEWER')
  const fromComp = scriptComp?.values?.language
  if (typeof fromComp === 'string' && fromComp.length > 0) return fromComp

  return 'plaintext'
}

/**
 * Renders a SCRIPT_VIEWER process step.
 *
 * Displays resolved script/code content in a scrollable monospace code block
 * with a copy-to-clipboard button.  Optional HELP_TEXT banners are shown above.
 *
 * @param props - {@link ProcessScriptViewerStepProps}
 */
export function ProcessScriptViewerStep({
  step,
  stepValues,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
  isLastStep,
}: ProcessScriptViewerStepProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [copied, setCopied] = useState(false)

  const scriptContent = useMemo(
    () => resolveScriptContent(step, stepValues),
    [step, stepValues]
  )
  const language = useMemo(
    () => resolveLanguage(step, stepValues),
    [step, stepValues]
  )

  // Help text from HELP_TEXT components
  const helpTextComponents = step.components.filter((c) => c.type === 'HELP_TEXT')

  /**
   * Copies the script content to the clipboard and shows a brief confirmation.
   */
  const handleCopy = async () => {
    if (!scriptContent) return
    try {
      await navigator.clipboard.writeText(scriptContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable; ignore silently
    }
  }

  return (
    <div className="space-y-6" data-qqq-id="process-script-viewer-step">
      {/* Help text */}
      {helpTextComponents.map((comp, idx) => (
        <div
          key={idx}
          className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
          data-qqq-id={`process-help-text-${step.name}-${idx}`}
        >
          {String(comp.values?.text ?? '')}
        </div>
      ))}

      {/* Code block */}
      {scriptContent ? (
        <div
          className="overflow-hidden rounded-xl border border-border bg-card"
          data-qqq-id="process-script-viewer-content"
        >
          {/* Header bar */}
          <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Code className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{language}</span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy code to clipboard"
              data-qqq-id="button-copy-script"
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium',
                'text-muted-foreground hover:text-foreground hover:bg-accent',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                'transition-colors duration-150'
              )}
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3 w-3 text-green-600" aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" aria-hidden="true" />
                  Copy
                </>
              )}
            </button>
          </div>
          {/* Code content */}
          <pre
            className="max-h-96 overflow-auto p-4 text-xs leading-relaxed text-foreground"
            tabIndex={0}
          >
            <code>{scriptContent}</code>
          </pre>
        </div>
      ) : (
        <div
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted p-8 text-center"
          data-qqq-id="process-script-viewer-empty"
        >
          <Code className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No script content to display for this step.</p>
        </div>
      )}

      {/* Actions */}
      <div className="sticky bottom-0 z-10 -mx-6 border-t border-border bg-card px-6 py-3 md:relative md:bottom-auto">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowCancelDialog(true)}
            disabled={isLoading}
            data-qqq-id="button-cancel"
            className={cn(
              'inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium',
              'text-foreground bg-card hover:bg-accent',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-colors duration-150'
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {canGoBack && onBack && (
              <button
                type="button"
                onClick={onBack}
                disabled={isLoading}
                data-qqq-id="button-back"
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium',
                  'text-foreground bg-card hover:bg-accent',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'transition-colors duration-150'
                )}
              >
                Back
              </button>
            )}

            <button
              type="button"
              onClick={() => onSubmit(stepValues)}
              disabled={isLoading}
              data-qqq-id="button-next"
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                'text-primary-foreground bg-primary hover:bg-primary/90',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors duration-150'
              )}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              {isLastStep ? 'Submit' : 'Next'}
            </button>
          </div>
        </div>
      </div>

      <ProcessCancelDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={onCancel}
      />
    </div>
  )
}
