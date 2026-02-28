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

/** QContext — application-wide UI state provider for navigation, page headers, theme, modals, branding, and table context */
'use client'

// QContext — application-wide UI state provider
// Equivalent to the QContext in the reference implementation

import React, { createContext, type ReactNode, useCallback, useContext, useState } from 'react'

import type { QTableMetaData, QProcessMetaData, QBrandingMetaData } from '@/types'

/**
 * Shape of the value provided by {@link QContext}.
 *
 * Holds application-wide UI state shared across the entire component tree.
 * Consumers should use the {@link useQContext} hook rather than reading the
 * context directly.
 */
export interface QContextType {
  // Navigation
  /** Map from URL path segments to human-readable breadcrumb labels. */
  pathToLabelMap: Record<string, string>
  /** Replaces the entire path-to-label map used for breadcrumb generation. */
  setPathToLabelMap: (map: Record<string, string>) => void

  // Page state
  /** The current page header, which may be a plain string or a React node. */
  pageHeader: string | React.ReactNode
  /** Sets the content rendered in the page header area. */
  setPageHeader: (header: string | React.ReactNode) => void

  // Theme
  /** Primary accent color hex string used throughout the UI. */
  accentColor: string
  /** Updates the primary accent color. */
  setAccentColor: (color: string) => void
  /** Light variant of the accent color, used for hover states and backgrounds. */
  accentColorLight: string
  /** Updates the light accent color variant. */
  setAccentColorLight: (color: string) => void

  // Table context (set by RecordQuery/RecordView pages)
  /** Metadata for the table currently being viewed, or `null` when not on a table page. */
  tableMetaData: QTableMetaData | null
  /** Sets the metadata for the active table. */
  setTableMetaData: (metadata: QTableMetaData) => void
  /** List of processes associated with the current table, or `null` when unavailable. */
  tableProcesses: QProcessMetaData[] | null
  /** Sets the process list for the active table. */
  setTableProcesses: (processes: QProcessMetaData[]) => void

  // UI state
  /** Whether the "dot menu" (ellipsis action menu) is currently open. */
  dotMenuOpen: boolean
  /** Opens or closes the dot menu. */
  setDotMenuOpen: (open: boolean) => void

  // Modal stack — tracks open modal identifiers for keyboard nav
  /** Ordered list of currently open modal identifiers, newest last. */
  modalStack: string[]
  /**
   * Pushes a modal identifier onto the stack when a modal opens.
   *
   * @param id - Unique identifier for the modal being opened.
   */
  pushModalOnStack: (id: string) => void
  /**
   * Removes a modal identifier from the top of the stack when it closes.
   *
   * Logs a warning if the supplied id is not the top-most item.
   *
   * @param id - Unique identifier for the modal being closed.
   */
  popModalOffStack: (id: string) => void
  /** Clears all modal identifiers from the stack. */
  clearModalStack: () => void

  // Help
  /** Whether the keyboard shortcut help overlay is currently visible. */
  keyboardHelpOpen: boolean
  /** Shows or hides the keyboard shortcut help overlay. */
  setKeyboardHelpOpen: (open: boolean) => void
  /** Reserved flag for a secondary help mode; currently always `false`. */
  helpHelpActive: boolean

  // User
  /** Identifier of the currently authenticated user, if known. */
  userId?: string
  /** Sets or clears the current user's identifier. */
  setUserId: (id: string | undefined) => void

  // Branding
  /** Branding metadata (company name, URL, app name) returned by the backend. */
  branding: QBrandingMetaData | null
  /** Replaces the current branding metadata. */
  setBranding: (branding: QBrandingMetaData) => void
}

/**
 * Fallback branding used before the backend metadata is loaded.
 */
const defaultBranding: QBrandingMetaData = {
  companyName: '',
  companyUrl: '',
  appName: 'QQQ',
}

/**
 * React context that holds the application-wide UI state.
 *
 * Prefer using the {@link useQContext} hook rather than consuming this context
 * directly — the hook validates that a provider is present in the tree.
 */
export const QContext = createContext<QContextType | undefined>(undefined)

/**
 * Provider component that supplies application-wide UI state to its subtree.
 *
 * Manages navigation labels, page headers, accent colors, table metadata,
 * process lists, modal stack, keyboard help visibility, user identity, and
 * branding. Wrap the entire application (or the authenticated layout) with
 * this component so that any descendant can call {@link useQContext}.
 *
 * @param children - The component subtree that needs access to the QContext.
 */
export function QContextProvider({ children }: { children: ReactNode }) {
  const [pageHeader, setPageHeader] = useState<string | React.ReactNode>('')
  const [accentColor, setAccentColor] = useState('#0062ff')
  const [accentColorLight, setAccentColorLight] = useState('#c0d6f7')
  const [tableMetaData, setTableMetaData] = useState<QTableMetaData | null>(null)
  const [tableProcesses, setTableProcesses] = useState<QProcessMetaData[] | null>(null)
  const [dotMenuOpen, setDotMenuOpen] = useState(false)
  const [modalStack, setModalStack] = useState<string[]>([])
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false)
  const [pathToLabelMap, setPathToLabelMap] = useState<Record<string, string>>({})
  const [branding, setBranding] = useState<QBrandingMetaData | null>(defaultBranding)
  const [userId, setUserId] = useState<string | undefined>(undefined)

  /**
   * Pushes a modal identifier onto the modal stack.
   *
   * Warns to the console if the same id is already on top of the stack, which
   * indicates a double-open bug in the calling component.
   *
   * @param id - Unique string identifier for the modal being opened.
   */
  const pushModalOnStack = useCallback((id: string) => {
    setModalStack((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === id) {
        console.warn(`[QContext] Duplicate modal pushed to stack: ${id}`)
      }
      return [...prev, id]
    })
  }, [])

  /**
   * Removes a modal identifier from the top of the modal stack.
   *
   * Is a no-op when the stack is empty. Warns to the console if the supplied
   * `id` is not the current top-most item, which indicates an out-of-order
   * close in the calling component.
   *
   * @param id - Unique string identifier for the modal being closed.
   */
  const popModalOffStack = useCallback((id: string) => {
    setModalStack((prev) => {
      if (prev.length === 0) {
        return prev
      }
      if (prev[prev.length - 1] !== id) {
        console.warn(
          `[QContext] Popping modal [${id}] that is not on top of stack [${prev[prev.length - 1]}]`
        )
        return prev
      }
      return prev.slice(0, -1)
    })
  }, [])

  /**
   * Empties the modal stack.
   *
   * Useful as a cleanup step when navigating away from a page that may have
   * left modals open.
   */
  const clearModalStack = useCallback(() => {
    setModalStack([])
  }, [])

  return (
    <QContext.Provider
      value={{
        pageHeader,
        setPageHeader,
        accentColor,
        setAccentColor,
        accentColorLight,
        setAccentColorLight,
        tableMetaData,
        setTableMetaData,
        tableProcesses,
        setTableProcesses,
        dotMenuOpen,
        setDotMenuOpen,
        modalStack,
        pushModalOnStack,
        popModalOffStack,
        clearModalStack,
        keyboardHelpOpen,
        setKeyboardHelpOpen,
        helpHelpActive: false,
        pathToLabelMap,
        setPathToLabelMap,
        userId,
        setUserId,
        branding,
        setBranding,
      }}
    >
      {children}
    </QContext.Provider>
  )
}

/**
 * Returns the application-wide UI state from the nearest {@link QContextProvider}.
 *
 * Must be called inside a component that is a descendant of
 * {@link QContextProvider}. Throws at runtime if no provider is found.
 *
 * @returns The current {@link QContextType} value.
 * @throws {Error} When called outside of a {@link QContextProvider} subtree.
 */
export function useQContext(): QContextType {
  const context = useContext(QContext)
  if (!context) {
    throw new Error('useQContext must be used within QContextProvider')
  }
  return context
}
