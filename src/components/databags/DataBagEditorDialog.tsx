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
 * @file DataBagEditorDialog — Material's `DataBagDataEditor`: edit a data bag's JSON with a
 * live preview tree, and save it as a new, current version (`storeDataBagVersion`). Invalid
 * JSON is never sent. Like Material, the editor does not close on Esc or a click outside it.
 */

'use client'

import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Loader2, X } from 'lucide-react'

import { storeDataBagVersion } from '@/lib/api/developer'
import { toast } from '@/lib/hooks/use-toast'
import { useRestoreFocus } from '@/lib/hooks/use-restore-focus'
import { HANDLES_OWN_ERRORS } from '@/lib/query-client'
import { cn } from '@/lib/utils/cn'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { CodeEditor } from '@/components/scripts/CodeEditor'
import { ALERT_CLASS, BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/scripts/ScriptPanels'
import { domId } from '@/components/scripts/script-utils'
import { JsonPreview } from './JsonPreview'

/** Props for {@link DataBagEditorDialog}. */
export interface DataBagEditorDialogProps {
  /** Suffix of the dialog's DOM ids and `data-qqq-id`s (the widget name). */
  idKey: string
  /** Dialog title. */
  title: string
  /** Data bag to add a version to. */
  dataBagId: string | number
  /** Contents to start from (the selected version), empty for a data bag without versions. */
  initialData: string
  /** Closes the dialog without saving. */
  onClose: () => void
  /** Called after the new version was stored. */
  onSaved: () => Promise<void>
}

/**
 * The data bag JSON editor dialog.
 *
 * @param props - {@link DataBagEditorDialogProps}
 * @returns The dialog.
 */
export function DataBagEditorDialog({ idKey, title, dataBagId, initialData, onClose, onSaved }: DataBagEditorDialogProps) {
  const [data, setData] = useState(initialData)
  const [commitMessage, setCommitMessage] = useState('')
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const restoreFocus = useRestoreFocus(true)

  const save = useMutation({
    mutationFn: () => storeDataBagVersion({ dataBagId, data, commitMessage }),
    meta: HANDLES_OWN_ERRORS,
    onSuccess: () => onSaved(),
    onError: (saveError) => {
      const message = getErrorMessage(saveError)
      setError(message)
      toast.error(message)
    },
  })

  /** Blocks invalid JSON, then stores the new version. */
  function handleSave() {
    try {
      JSON.parse(data)
    } catch (parseError) {
      setError(`Cannot save Data Bag Contents. Invalid json: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
      return
    }
    setError(null)
    save.mutate()
  }

  const commitId = `data-bag-commit-message-${domId(idKey)}`

  return (
    <DialogPrimitive.Root open onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70" />
        <DialogPrimitive.Content
          onCloseAutoFocus={restoreFocus}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-lg border border-border bg-card shadow-lg focus:outline-none'
          )}
          data-qqq-id={`dialog-data-bag-editor-${idKey}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{title}</DialogPrimitive.Title>
            <div className="flex items-center gap-2">
              <div role="group" aria-label="Tools" className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground" aria-hidden="true">Tools:</span>
                <button
                  type="button"
                  aria-pressed={preview}
                  className={cn(BUTTON_CLASS, preview && 'border-primary bg-accent')}
                  onClick={() => setPreview((current) => !current)}
                  data-qqq-id={`button-data-bag-preview-${idKey}`}
                >
                  Preview
                </button>
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  aria-label="Close dialog"
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
            <CodeEditor
              id={`data-bag-editor-${domId(idKey)}`}
              ariaLabel="Data bag contents"
              value={data}
              onChange={setData}
              language="json"
              rows={preview ? 10 : 18}
              dataQqqId={`data-bag-editor-code-${idKey}`}
            />
            {preview && (
              <section aria-label="Preview" className="max-h-72 overflow-auto rounded-md border border-border p-2">
                <JsonPreview json={data} idKey={`${idKey}-editor`} />
              </section>
            )}
            <div className="space-y-1">
              <label htmlFor={commitId} className="block text-sm font-medium text-foreground">Commit Message</label>
              <input
                id={commitId}
                type="text"
                maxLength={250}
                className={INPUT_CLASS}
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleSave()
                  }
                }}
              />
            </div>
            {error && <p role="alert" className={ALERT_CLASS} data-qqq-id={`data-bag-editor-error-${idKey}`}>{error}</p>}
          </div>
          <div className="flex items-center justify-end gap-3 rounded-b-lg border-t border-border bg-muted px-4 py-3">
            <button
              type="button"
              className={BUTTON_CLASS}
              onClick={onClose}
              disabled={save.isPending}
              data-qqq-id={`button-cancel-data-bag-${idKey}`}
            >
              Cancel
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={save.isPending}
              onClick={handleSave}
              data-qqq-id={`button-save-data-bag-${idKey}`}
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
