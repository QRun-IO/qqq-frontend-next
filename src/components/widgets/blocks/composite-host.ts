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
 * @file composite-host — what a screen hosting composite blocks (a process step) adds
 * to the shared composite renderer, as Material's ProcessRun does for its ad hoc and
 * named composite widgets: values for `${name}` interpolation and block `conditional`s,
 * INPUT_FIELD blocks bound to the host's form, and modal-mode composites opened and
 * closed by BUTTON control codes. Dashboards render composites without a host.
 */

import { createContext, useContext } from 'react'
import type React from 'react'

import type { QqqBlockData } from '../widget-types'

/** Props the host's INPUT_FIELD renderer receives. */
export interface HostInputFieldProps {
  /** The INPUT_FIELD block. */
  block: QqqBlockData
  /** Owning widget name, for `data-qqq-id` scoping. */
  widgetName: string
}

/** A screen that hosts composite blocks. */
export interface CompositeHost {
  /** Values for `${name}` interpolation in TEXT blocks and for block `conditional`s. */
  values: Record<string, unknown>
  /** Renders an INPUT_FIELD block bound to the host's form. */
  renderInputField?: (props: HostInputFieldProps) => React.ReactNode
  /** Whether the modal-mode composite with this block id is open. */
  isModalOpen?: (blockId: string) => boolean
  /** Closes the modal-mode composite with this block id (Material sends `hideModal:<blockId>`). */
  closeModal?: (blockId: string) => void
}

/** The hosting screen, or `null` on dashboards and record views. */
export const CompositeHostContext = createContext<CompositeHost | null>(null)

/**
 * The composite host of the current screen.
 * @returns The host, or `null` when composites render without one.
 */
export function useCompositeHost(): CompositeHost | null {
  return useContext(CompositeHostContext)
}

/**
 * Replace `${name}` placeholders with values; unknown or empty names stay as written.
 * @param text - Text with placeholders.
 * @param values - Values by name.
 * @returns The interpolated text.
 */
export function interpolateValues(text: string, values: Record<string, unknown>): string {
  return text.replace(/\$\{([^}]+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) && values[name] !== null && values[name] !== undefined ? String(values[name]) : placeholder)
}

/**
 * Whether a block shows on the host: a block whose `conditional` names a false value is
 * left out, as Material's `dynamicEvaluationOfCompositeWidgetData` does.
 * @param block - The block.
 * @param host - The hosting screen.
 * @returns `false` when the block's condition is not met.
 */
export function isBlockShown(block: QqqBlockData, host: CompositeHost | null): boolean {
  if (!host || typeof block.conditional !== 'string' || !block.conditional) return true
  return Boolean(host.values[block.conditional])
}
