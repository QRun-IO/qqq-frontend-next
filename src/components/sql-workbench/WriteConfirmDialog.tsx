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
 * @file WriteConfirmDialog — the second step of write mode. Shows every statement with its kind
 * and the affected rows from the rolled-back dry run, requires acknowledging the row guard when
 * it is exceeded, and requires typing the backend name before the commit is sent.
 */

'use client'

import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, Loader2 } from 'lucide-react'

import type { SqlExecuteResponse, SqlStatementView } from '@/types'
import { cn } from '@/lib/utils/cn'
import { buttonClass, CHECKBOX_CLASS, INPUT_CLASS, WARNING_CLASS } from '@/components/ui/controls'

/** Plain names of the statement kinds. */
const STATEMENT_KIND_LABELS: Record<SqlStatementView['kind'], string> = {
  READ: 'Read',
  EXPLAIN_ANALYZE: 'Explain',
  WRITE: 'Write',
  DDL: 'Schema change',
  FORBIDDEN: 'Not allowed',
}

/**
 * Counts affected rows in words.
 *
 * @param count - The number of rows.
 * @returns E.g. `1 row affected`, `1,204 rows affected`.
 */
function rowsAffected(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'row' : 'rows'} affected`
}

/** Props for {@link WriteConfirmDialog}. */
export interface WriteConfirmDialogProps {
  preview: SqlExecuteResponse
  backendName: string
  pending: boolean
  onConfirm: (acknowledgeRowGuard: boolean) => void
  onCancel: () => void
}

/**
 * Renders the confirmation dialog (open while mounted).
 *
 * @param props - Component props.
 * @returns The dialog.
 */
export function WriteConfirmDialog({
  preview,
  backendName,
  pending,
  onConfirm,
  onCancel,
}: WriteConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const guard = preview.rowGuardExceeded === true
  const canCommit = typed === backendName && (!guard || acknowledged) && !pending
  const inputId = React.useId()

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-xl border border-border bg-background text-foreground shadow-lg focus:outline-none'
          )}
          data-qqq-id="dialog-sql-write-confirm"
        >
          <div className="min-h-0 space-y-4 overflow-y-auto p-6">
            <Dialog.Title className="text-lg font-semibold">
              Confirm write on “{backendName}”
            </Dialog.Title>
            <Dialog.Description className={cn(WARNING_CLASS, 'flex gap-2')}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Raw SQL bypasses QQQ record security, audits, automations and search indexing. It
                runs in one transaction and is audited.
              </span>
            </Dialog.Description>
            <div className="rounded-md border border-border">
              <table className="w-full border-collapse text-sm" aria-label="Statements to commit">
                <thead>
                  <tr className="border-b border-border bg-muted text-left">
                    <th scope="col" className="bg-muted px-3 py-2 font-semibold">
                      #
                    </th>
                    <th scope="col" className="bg-muted px-3 py-2 font-semibold">
                      Type
                    </th>
                    <th scope="col" className="bg-muted px-3 py-2 font-semibold">
                      Statement
                    </th>
                    <th scope="col" className="bg-muted px-3 py-2 text-right font-semibold">
                      Rows
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.statements ?? []).map((s) => (
                    <tr key={s.index} className="border-b border-border align-top last:border-b-0">
                      <td className="px-3 py-2 tabular-nums">{s.index + 1}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {STATEMENT_KIND_LABELS[s.kind] ?? s.kind}
                      </td>
                      <td className="break-all px-3 py-2 font-mono text-xs">{s.text}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.affectedRows?.toLocaleString() ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm">
              {preview.dryRunSupported
                ? `Dry run (rolled back): ${rowsAffected(preview.totalAffectedRows ?? 0)}.`
                : (preview.dryRunNote ?? 'This write could not be dry-run.')}
            </p>
            {guard && (
              <label className="flex cursor-pointer items-start gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className={cn(CHECKBOX_CLASS, 'mt-0.5')}
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  data-qqq-id="checkbox-sql-row-guard"
                />
                I understand this affects more than {preview.rowGuardLimit?.toLocaleString()} rows.
              </label>
            )}
            <div className="space-y-1">
              <label htmlFor={inputId} className="block text-sm font-medium">
                Type <span className="font-mono">{backendName}</span> to confirm
              </label>
              <input
                id={inputId}
                className={cn(INPUT_CLASS, 'font-mono')}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                data-qqq-id="input-sql-confirm-backend"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 rounded-b-xl border-t border-border bg-muted px-6 py-4">
            <Dialog.Close asChild>
              <button
                type="button"
                className={buttonClass('secondary')}
                data-qqq-id="button-sql-write-cancel"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={buttonClass('danger')}
              disabled={!canCommit}
              onClick={() => onConfirm(acknowledged)}
              data-qqq-id="button-sql-write-commit"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {pending ? 'Committing…' : 'Commit write'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
