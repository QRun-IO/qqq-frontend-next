'use client'

// QContext — application-wide UI state provider
// Equivalent to the QContext in the reference implementation

import React, { createContext, type ReactNode, useCallback, useContext, useState } from 'react'

import type { QTableMetaData, QProcessMetaData, QBrandingMetaData } from '@/types'

export interface QContextType {
  // Navigation
  pathToLabelMap: Record<string, string>
  setPathToLabelMap: (map: Record<string, string>) => void

  // Page state
  pageHeader: string | React.ReactNode
  setPageHeader: (header: string | React.ReactNode) => void

  // Theme
  accentColor: string
  setAccentColor: (color: string) => void
  accentColorLight: string
  setAccentColorLight: (color: string) => void

  // Table context (set by RecordQuery/RecordView pages)
  tableMetaData: QTableMetaData | null
  setTableMetaData: (metadata: QTableMetaData) => void
  tableProcesses: QProcessMetaData[] | null
  setTableProcesses: (processes: QProcessMetaData[]) => void

  // UI state
  dotMenuOpen: boolean
  setDotMenuOpen: (open: boolean) => void

  // Modal stack — tracks open modal identifiers for keyboard nav
  modalStack: string[]
  pushModalOnStack: (id: string) => void
  popModalOffStack: (id: string) => void
  clearModalStack: () => void

  // Help
  keyboardHelpOpen: boolean
  setKeyboardHelpOpen: (open: boolean) => void
  helpHelpActive: boolean

  // User
  userId?: string
  setUserId: (id: string | undefined) => void

  // Branding
  branding: QBrandingMetaData | null
  setBranding: (branding: QBrandingMetaData) => void
}

const defaultBranding: QBrandingMetaData = {
  companyName: '',
  companyUrl: '',
  appName: 'QQQ',
}

export const QContext = createContext<QContextType | undefined>(undefined)

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

  const pushModalOnStack = useCallback((id: string) => {
    setModalStack((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === id) {
        console.warn(`[QContext] Duplicate modal pushed to stack: ${id}`)
      }
      return [...prev, id]
    })
  }, [])

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

export function useQContext(): QContextType {
  const context = useContext(QContext)
  if (!context) {
    throw new Error('useQContext must be used within QContextProvider')
  }
  return context
}
