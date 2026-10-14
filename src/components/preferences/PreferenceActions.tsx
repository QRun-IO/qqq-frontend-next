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

/** @file Scoped preference actions and ephemeral, acknowledged one-time secrets. */
'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import * as Dialog from '@radix-ui/react-dialog'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
  PreferenceAction,
  PreferenceRow,
  PreferenceSection,
  PreferenceSecret,
} from '@/types/preferences'
import { runPreferenceAction } from '@/lib/api/preferences'
import { queryKeys } from '@/lib/query-client'
import { BUTTON_CLASS, buttonClass } from '@/components/ui/controls'
import { MetadataIcon } from '@/components/layout/MetadataIcon'
import { PreferenceField } from './PreferenceField'
import { preferenceDefaults, preferenceSlots, wireValue } from './preference-values'
import { preferenceMessages } from './preference-messages'

/** Shared focus-trapped action dialog; all dismissal is controlled by its owner.
 * @param props - Accessible title, description, body and dismissal policy.
 * @returns A portalled modal.
 */
function ActionDialog({
  title,
  description,
  locked,
  onClose,
  onReturnFocus,
  children,
}: {
  title: string
  description: string
  locked: boolean
  onClose: () => void
  onReturnFocus: () => void
  children: ReactNode
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !locked) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          data-qqq-id="preference-action-overlay"
          className="fixed inset-0 z-[1100] bg-foreground/40"
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[1101] max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-lg border border-border bg-card p-6 text-foreground shadow-xl"
          onEscapeKeyDown={(event) => {
            if (locked) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (locked) event.preventDefault()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            onReturnFocus()
          }}
        >
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="whitespace-pre-wrap text-sm text-muted-foreground">
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Action inputs use exactly the section editors and wire conversions.
 * @param props - Selected action, execution state and callbacks.
 * @returns Inputs and explicit confirmation/submit controls.
 */
function ActionInputs({
  section,
  action,
  pending,
  errors,
  onRun,
  onClose,
  onReturnFocus,
}: {
  section: PreferenceSection
  action: PreferenceAction
  pending: boolean
  errors: string[]
  onRun: (values: Record<string, unknown>) => void
  onClose: () => void
  onReturnFocus: () => void
}) {
  const prefix = useId()
  const slots = preferenceSlots({
    ...section,
    fields: action.inputFields ?? [],
    lists: [],
    values: {},
  })
  const form = useForm<Record<string, unknown>>({ defaultValues: preferenceDefaults(slots) })
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (errors.length) errorRef.current?.focus()
  }, [errors])
  return (
    <ActionDialog
      title={action.label}
      description={action.description || 'Review and run this action.'}
      locked={pending}
      onClose={onClose}
      onReturnFocus={onReturnFocus}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          // This portal is inside the section form's React tree; do not submit that form.
          event.stopPropagation()
          void form.handleSubmit((values) =>
            onRun(
              Object.fromEntries(
                slots
                  .filter((slot) => !slot.readOnly && !slot.field.isHidden)
                  .map((slot) => [slot.field.name, wireValue(slot, values[slot.name])])
              )
            )
          )(event)
        }}
      >
        {errors.length > 0 && (
          <div ref={errorRef} role="alert" tabIndex={-1} className="text-sm text-destructive">
            <ul>
              {errors.map((message, i) => (
                <li key={i}>{message}</li>
              ))}
            </ul>
          </div>
        )}
        {slots.map((slot) => (
          <PreferenceField
            key={slot.name}
            slot={slot}
            section={section}
            form={form}
            prefix={prefix}
            disabled={pending}
          />
        ))}
        {action.confirmationText && (
          <p className={action.isDestructive ? 'text-destructive' : ''}>
            {action.confirmationText}
          </p>
        )}
        <div className="flex gap-3">
          <button type="button" className={BUTTON_CLASS} disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className={buttonClass(action.isDestructive ? 'danger' : 'primary')}
            disabled={pending}
          >
            {pending ? 'Running…' : action.label}
          </button>
        </div>
      </form>
    </ActionDialog>
  )
}

/** Copy a value, selecting its visible text when clipboard access is unavailable.
 * @param props - Text and accessible copy label; usage renders as a code block.
 * @returns Read-only text with a copy affordance and status.
 */
function CopyValue({
  label,
  value,
  usage = false,
}: {
  label: string
  value: string
  usage?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const code = useRef<HTMLElement>(null)
  const [status, setStatus] = useState('')
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      setStatus('Copied')
    } catch {
      if (input.current) {
        input.current.focus()
        input.current.select()
      }
      if (code.current) {
        code.current.focus()
        const range = document.createRange()
        range.selectNodeContents(code.current)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      setStatus('Text selected. Press Ctrl+C or Command+C to copy.')
    }
  }
  return (
    <div className="min-w-0 space-y-2">
      {usage ? (
        <pre role="region" aria-label={label} className="overflow-x-auto rounded bg-muted p-3">
          <code ref={code} tabIndex={0}>
            {value}
          </code>
        </pre>
      ) : (
        <input
          ref={input}
          aria-label={label}
          readOnly
          value={value}
          className="w-full rounded border border-input bg-background p-2 font-mono"
        />
      )}
      <button
        type="button"
        className={BUTTON_CLASS}
        aria-label={`Copy ${label}`}
        onClick={() => void copy()}
      >
        Copy
      </button>
      <span role="status" className="ml-2 text-sm text-muted-foreground">
        {status}
      </span>
    </div>
  )
}

/** Only local component state owns the returned secrets; unmount clears all copy fields.
 * @param props - One-time values and explicit dismissal callbacks.
 * @returns An acknowledgement-gated secret dialog.
 */
export function OneTimeSecretDialog({
  secrets,
  onClose,
  onReturnFocus,
}: {
  secrets: PreferenceSecret[]
  onClose: () => void
  onReturnFocus: () => void
}) {
  const [acknowledged, setAcknowledged] = useState(false)
  return (
    <ActionDialog
      title="Show once"
      description="Copy it now. You won't be able to see it again."
      locked={!acknowledged}
      onClose={onClose}
      onReturnFocus={onReturnFocus}
    >
      {secrets.map((secret, i) => (
        <section key={i} aria-label={secret.label} className="space-y-3">
          <h3 className="font-semibold">{secret.label}</h3>
          <CopyValue label={secret.label} value={secret.value} />
          {secret.masked && (
            <p className="font-mono text-sm text-muted-foreground">{secret.masked}</p>
          )}
          {secret.usageText && (
            <CopyValue label={`${secret.label} usage`} value={secret.usageText} usage />
          )}
        </section>
      ))}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        I&apos;ve copied it
      </label>
      <button type="button" className={BUTTON_CLASS} disabled={!acknowledged} onClick={onClose}>
        Done
      </button>
    </ActionDialog>
  )
}

/** Keeps action results out of TanStack's mutation cache and serializes section editing.
 * @param props - Current metadata, edit locks, and safe section replacement callback.
 * @returns Scoped controls, dialogs and editor lock state.
 */
export function usePreferenceActions({
  section,
  dirty,
  saving,
  onSaved,
}: {
  section: PreferenceSection
  dirty: boolean
  saving: boolean
  onSaved: (section: PreferenceSection) => void
}) {
  const client = useQueryClient()
  const [selected, setSelected] = useState<{
    action: PreferenceAction
    row?: PreferenceRow
  } | null>(null)
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [secrets, setSecrets] = useState<PreferenceSecret[]>([])
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const returnFocus = useRef<HTMLElement | null>(null)
  const focusFallback = useRef<HTMLElement | null>(null)
  const focusRowKey = useRef<string | undefined>(undefined)
  const showingSecrets = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const restoreFocus = () => {
    // Moving from inputs to secrets must keep focus in the new modal.
    if (showingSecrets.current) return
    const row =
      focusRowKey.current &&
      Array.from(
        focusFallback.current?.querySelectorAll<HTMLElement>('[data-preference-row-key]') ?? []
      ).find((element) => element.dataset.preferenceRowKey === focusRowKey.current)
    if (row) row.focus()
    else if (returnFocus.current?.isConnected) returnFocus.current.focus()
    else focusFallback.current?.focus()
  }
  const active = pending || Boolean(selected) || secrets.length > 0
  const disabled = dirty || saving || active
  const actions = [...(section.actions ?? [])].sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100) || a.label.localeCompare(b.label)
  )
  const run = async (
    action: PreferenceAction,
    row?: PreferenceRow,
    values?: Record<string, unknown>
  ) => {
    if (dirty || saving || inFlight.current) return
    inFlight.current = true
    setPending(true)
    setErrors([])
    try {
      await client.cancelQueries({ queryKey: queryKeys.preferences() })
      const result = await runPreferenceAction(section.name, action.name, {
        ...(row ? { rowKey: row.key } : {}),
        ...(values ? { values } : {}),
      })
      if (!mounted.current) return
      focusRowKey.current = result.focusRowKey
      showingSecrets.current = Boolean(result.secrets?.length)
      onSaved(result.section)
      setSelected(null)
      if (result.message) toast.success(result.message)
      setSecrets(result.secrets ?? [])
    } catch (error) {
      if (mounted.current) setErrors(preferenceMessages(error))
    } finally {
      inFlight.current = false
      if (mounted.current) setPending(false)
    }
  }
  const start = (action: PreferenceAction, row?: PreferenceRow) => {
    if (disabled) return
    returnFocus.current = document.activeElement as HTMLElement
    focusFallback.current = returnFocus.current?.closest('form') ?? focusFallback.current
    focusRowKey.current = undefined
    setErrors([])
    if (action.inputFields?.length || action.confirmationText) setSelected({ action, row })
    else void run(action, row)
  }
  const controls = (scope: PreferenceAction['scope'], listName?: string, row?: PreferenceRow) => {
    const allowed = actions.filter(
      (action) =>
        action.scope === scope &&
        (scope === 'SECTION' || action.listName === listName) &&
        (!row || row.actionNames == null || row.actionNames.includes(action.name))
    )
    if (!allowed.length) return null
    if (scope === 'ROW')
      return (
        <Menu.Root>
          <Menu.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={BUTTON_CLASS}
              aria-label={`Actions for ${row?.label}`}
              title={dirty ? 'Save or discard your changes first' : undefined}
              onPointerDown={(event) => {
                returnFocus.current = event.currentTarget
                focusFallback.current = event.currentTarget.closest('form')
              }}
              onFocus={(event) => {
                returnFocus.current = event.currentTarget
                focusFallback.current = event.currentTarget.closest('form')
              }}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content
              className="z-[1102] min-w-40 rounded border border-border bg-popover p-1 shadow-lg"
              onCloseAutoFocus={(event) => {
                if (selected) event.preventDefault()
              }}
            >
              {allowed.map((action) => (
                <Menu.Item
                  key={action.name}
                  className={`flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none focus:bg-accent ${action.isDestructive ? 'text-destructive' : 'text-foreground'}`}
                  onSelect={() => {
                    const trigger = returnFocus.current
                    start(action, row)
                    returnFocus.current = trigger
                  }}
                >
                  <MetadataIcon icon={action.icon} kind="process" className="h-4 w-4" />
                  {action.label}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      )
    return (
      <div className="flex flex-wrap gap-2">
        {allowed.map((action) => (
          <button
            key={action.name}
            type="button"
            disabled={disabled}
            title={dirty ? 'Save or discard your changes first' : action.description || undefined}
            className={buttonClass(action.isDestructive ? 'destructive' : 'secondary')}
            onClick={() => start(action)}
          >
            <MetadataIcon icon={action.icon} kind="process" className="h-4 w-4" />
            {action.label}
          </button>
        ))}
      </div>
    )
  }
  return {
    active,
    controls,
    dialogs: (
      <>
        {!selected && errors.length > 0 && (
          <div role="alert" className="text-destructive">
            {errors.map((message, i) => (
              <p key={i}>{message}</p>
            ))}
          </div>
        )}
        {selected && (
          <ActionInputs
            section={section}
            action={selected.action}
            pending={pending}
            errors={errors}
            onRun={(values) => void run(selected.action, selected.row, values)}
            onClose={() => {
              setSelected(null)
              setErrors([])
            }}
            onReturnFocus={restoreFocus}
          />
        )}
        {secrets.length > 0 && (
          <OneTimeSecretDialog
            secrets={secrets}
            onClose={() => {
              showingSecrets.current = false
              setSecrets([])
            }}
            onReturnFocus={restoreFocus}
          />
        )}
      </>
    ),
  }
}
