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

/** @file Generic scalar/list preference editor with partial writes and retained validation errors. */
'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { PreferenceSection, PreferencesResponse } from '@/types/preferences'
import type { QaCaptureCapabilityV1 } from '@/types/qa-capture'
import { patchPreferenceSection } from '@/lib/api/preferences'
import { queryKeys } from '@/lib/query-client'
import { useContainerWidth } from '@/lib/hooks/use-container-width'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { cn } from '@/lib/utils/cn'
import { BUTTON_CLASS } from '@/components/ui/controls'
import { PreferenceField } from './PreferenceField'
import { imageUploadSettings } from './ImageUploadField'
import { usePreferenceActions } from './PreferenceActions'
import { preferenceMessages } from './preference-messages'
import { preferenceDefaults, preferencePatch, preferenceSlots } from './preference-values'

/** Whether a field is an upload-ref image field.
 * @param field - Field metadata.
 * @returns True for a FILE_UPLOAD field with valueIsUploadRef.
 */
function isImageField(field: PreferenceSection['fields'][number]): boolean {
  return imageUploadSettings(field.adornments?.find((adornment) => adornment.type === 'FILE_UPLOAD')?.values) !== null
}

/** Renders one provider section, with one scroll owner supplied by the page or drawer.
 * @param props - Section metadata and current values.
 * @returns Metadata-driven preference form.
 */
export function PreferenceSectionForm({
  section,
  hideHeading = false,
}: {
  section: PreferenceSection
  /** Omit the section title and description when a container (the drawer) already shows them. */
  hideHeading?: boolean
}) {
  const client = useQueryClient()
  const prefix = useId()
  const [containerRef, width] = useContainerWidth<HTMLFormElement>()
  const desktop = useMediaQuery('(min-width: 768px)')
  const table = width ? width >= 768 : desktop
  const [snapshot, setSnapshot] = useState(section)
  const slots = useMemo(() => preferenceSlots(snapshot), [snapshot])
  const defaults = useMemo(() => preferenceDefaults(slots), [slots])
  const form = useForm<Record<string, unknown>>({ defaultValues: defaults })
  const {
    reset,
    control,
    formState: { isDirty },
  } = form
  const values = useWatch({ control })
  const patch = preferencePatch(slots, values)
  const dirty = Boolean(patch.values || patch.lists)
  const mutation = useMutation({
    mutationFn: () => patchPreferenceSection(snapshot.name, patch),
    onSuccess: (saved) => {
      setSnapshot(saved)
      reset(preferenceDefaults(preferenceSlots(saved)))
      client.setQueryData(queryKeys.preferenceSection(saved.name), saved)
      void client.invalidateQueries({ queryKey: queryKeys.preferences() })
      void client.invalidateQueries({ queryKey: queryKeys.alerts() })
      // the QA mode toggle changes whether QA capture is on for this user
      if (client.getQueryData<QaCaptureCapabilityV1>(queryKeys.qaCaptureCapability())?.qaMode.preferenceSection === saved.name) {
        void client.invalidateQueries({ queryKey: queryKeys.qaCaptureCapability() })
      }
      toast.success('Preferences saved')
    },
  })
  const actions = usePreferenceActions({
    section: snapshot,
    dirty,
    saving: mutation.isPending,
    onSaved: (saved) => {
      setSnapshot(saved)
      reset(preferenceDefaults(preferenceSlots(saved)))
      client.setQueryData(queryKeys.preferenceSection(saved.name), saved)
      client.setQueryData<PreferencesResponse>(queryKeys.preferencesIndex(), (current) =>
        current
          ? {
              ...current,
              sections: current.sections.map((item) => (item.name === saved.name ? saved : item)),
            }
          : current
      )
    },
  })
  const previousSection = useRef(section)
  // A background refetch must not discard unsaved edits.
  useEffect(() => {
    if (previousSection.current === section) return
    previousSection.current = section
    if (!isDirty && !actions.active) {
      setSnapshot(section)
      reset(preferenceDefaults(preferenceSlots(section)))
    }
  }, [section, reset, isDirty, actions.active])
  const cell = (name: string, hideLabel = false) => {
    const slot = slots.find((slot) => slot.name === name)!
    return (
      <PreferenceField
        slot={slot}
        section={snapshot}
        form={form}
        prefix={prefix}
        disabled={mutation.isPending || actions.active}
        hideLabel={hideLabel}
      />
    )
  }
  return (
    <form
      ref={containerRef}
      tabIndex={-1}
      onSubmit={form.handleSubmit(() => {
        if (dirty && !actions.active) mutation.mutate()
      })}
      className="min-w-0 space-y-6 [&_input]:min-w-0 [&_input]:max-w-full [&_select]:min-w-0 [&_select]:max-w-full"
      data-qqq-id={`preferences-form-${snapshot.name}`}
    >
      <header className={cn('flex flex-wrap items-center justify-between gap-3', hideHeading && 'justify-end')}>
        {!hideHeading && <h2 className="text-lg font-semibold">{snapshot.label}</h2>}
        {actions.controls('SECTION')}
      </header>
      {!hideHeading && snapshot.description && (
        <p className="text-sm text-muted-foreground">{snapshot.description}</p>
      )}
      {dirty && Boolean(snapshot.actions?.length) && (
        <p role="status" className="text-sm text-muted-foreground">
          Save or discard your changes first
        </p>
      )}
      {actions.dialogs}
      {mutation.isError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-semibold">Could not save changes</p>
          <ul className="list-inside list-disc">
            {preferenceMessages(mutation.error).map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid min-w-0 gap-5 md:grid-cols-2">
        {snapshot.fields.map(
          (field, i) =>
            !field.isHidden && (
              // an image field takes the whole row: its preview and buttons never squeeze into half
              <div key={field.name} className={cn(isImageField(field) && 'md:col-span-2')}>
                {cell(`scalar${i}`)}
              </div>
            )
        )}
      </div>
      {snapshot.lists.map((list, li) => (
        <section key={list.name} aria-label={list.label} className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-foreground">{list.label}</h3>
            {actions.controls('LIST', list.name)}
          </div>
          {list.description && <p className="text-sm text-muted-foreground">{list.description}</p>}
          {!list.rows.length ? (
            <p className="text-sm text-muted-foreground">No items available.</p>
          ) : table ? (
            <table
              className="w-full table-fixed border-collapse text-left text-sm"
              data-qqq-id={`preferences-list-table-${list.name}`}
            >
              <caption className="sr-only">{list.label}</caption>
              <thead>
                <tr>
                  <th scope="col" className="break-words p-2">
                    {list.rowLabel}
                  </th>
                  {list.fields
                    .filter((field) => !field.isHidden)
                    .map((field) => (
                      <th scope="col" className="break-words p-2" key={field.name}>
                        {field.label}
                      </th>
                    ))}
                  {snapshot.actions?.some(
                    (action) => action.scope === 'ROW' && action.listName === list.name
                  ) && (
                    <th scope="col" className="w-20 p-2">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {list.rows.map((row, ri) => (
                  <tr
                    key={row.key}
                    tabIndex={-1}
                    data-preference-row-key={row.key}
                    className="border-t border-border"
                  >
                    <th scope="row" className="break-words p-2 align-top font-medium">
                      {row.label}
                      {row.description && (
                        <p className="text-xs font-normal text-muted-foreground">
                          {row.description}
                        </p>
                      )}
                    </th>
                    {list.fields.map(
                      (field, fi) =>
                        !field.isHidden && (
                          <td key={field.name} className="p-2 align-top">
                            {cell(`list${li}row${ri}field${fi}`, true)}
                          </td>
                        )
                    )}
                    {snapshot.actions?.some(
                      (action) => action.scope === 'ROW' && action.listName === list.name
                    ) && (
                      <td className="p-2 align-top">{actions.controls('ROW', list.name, row)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="space-y-3" data-qqq-id={`preferences-list-cards-${list.name}`}>
              {list.rows.map((row, ri) => (
                <fieldset
                  key={row.key}
                  tabIndex={-1}
                  data-preference-row-key={row.key}
                  className="min-w-0 rounded-lg border border-border p-4"
                >
                  <legend className="px-1 font-medium">{row.label}</legend>
                  {actions.controls('ROW', list.name, row)}
                  {row.description && (
                    <p className="mb-3 text-sm text-muted-foreground">{row.description}</p>
                  )}
                  <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                    {list.fields.map(
                      (field, fi) =>
                        !field.isHidden && (
                          <div key={field.name}>{cell(`list${li}row${ri}field${fi}`)}</div>
                        )
                    )}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
        </section>
      ))}
      {!snapshot.fields.length && !snapshot.lists.length && (
        <p className="text-muted-foreground">No preferences available in this section.</p>
      )}
      <div className="flex flex-wrap gap-3 border-t border-border pt-4">
        <button
          type="submit"
          className={BUTTON_CLASS}
          disabled={!dirty || mutation.isPending || actions.active}
          data-qqq-id="preferences-save"
        >
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={!dirty || mutation.isPending || actions.active}
          onClick={() => {
            reset(defaults)
            mutation.reset()
          }}
          data-qqq-id="preferences-discard"
        >
          Discard
        </button>
      </div>
    </form>
  )
}
