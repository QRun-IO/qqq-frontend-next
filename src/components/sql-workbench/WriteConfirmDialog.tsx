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

import type { SqlExecuteResponse } from '@/types'

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

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[min(42rem,95vw)] -translate-x-1/2 -translate-y-1/2 space-y-3 rounded-lg border bg-background p-4 shadow-lg"
          data-qqq-id="dialog-sql-write-confirm"
        >
          <Dialog.Title className="text-base font-semibold">
            Confirm write on “{backendName}”
          </Dialog.Title>
          <Dialog.Description className="flex gap-2 rounded bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <span aria-hidden>⚠</span>
            Raw SQL bypasses QQQ record security, audits, automations and search indexing. It runs
            in one transaction and is audited.
          </Dialog.Description>
          <table className="w-full text-sm" aria-label="Statements to commit">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col">#</th>
                <th scope="col">Kind</th>
                <th scope="col">Statement</th>
                <th scope="col" className="text-right">
                  Rows
                </th>
              </tr>
            </thead>
            <tbody>
              {(preview.statements ?? []).map((s) => (
                <tr key={s.index} className="align-top">
                  <td>{s.index + 1}</td>
                  <td className="font-mono text-xs">{s.kind}</td>
                  <td className="max-w-md truncate font-mono text-xs" title={s.text}>
                    {s.text}
                  </td>
                  <td className="text-right tabular-nums">{s.affectedRows ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm">
            {preview.dryRunSupported
              ? `Dry run (rolled back): ${preview.totalAffectedRows ?? 0} rows affected.`
              : (preview.dryRunNote ?? 'This write could not be dry-run.')}
          </p>
          {guard && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                data-qqq-id="checkbox-sql-row-guard"
              />
              I understand this affects more than {preview.rowGuardLimit} rows.
            </label>
          )}
          <label className="block text-sm">
            Type <span className="font-mono">{backendName}</span> to confirm
            <input
              className="mt-1 block w-full rounded border px-2 py-1 font-mono"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              data-qqq-id="input-sql-confirm-backend"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded border px-3 py-1 text-sm"
                data-qqq-id="button-sql-write-cancel"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="rounded bg-destructive px-3 py-1 text-sm text-destructive-foreground disabled:opacity-50"
              disabled={!canCommit}
              onClick={() => onConfirm(acknowledged)}
              data-qqq-id="button-sql-write-commit"
            >
              {pending ? 'Committing…' : 'Commit write'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
