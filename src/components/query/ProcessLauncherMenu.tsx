'use client'

// ProcessLauncherMenu — dropdown menu for launching processes from the record query toolbar
// Supports both selected-record and filter-based process invocation

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Play, ChevronDown } from 'lucide-react'

import type { QProcessMetaData, QQueryFilter } from '@/types'

interface ProcessLauncherMenuProps {
  processes: QProcessMetaData[]
  selectedRecordIds: (string | number)[]
  tableName: string
  currentFilter: QQueryFilter
}

export function ProcessLauncherMenu({
  processes,
  selectedRecordIds,
  tableName,
  currentFilter,
}: ProcessLauncherMenuProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close on Escape and restore focus to trigger button
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  const visibleProcesses = processes.filter((p) => !p.isHidden && p.hasPermission)

  if (visibleProcesses.length === 0) return null

  const handleProcessClick = (process: QProcessMetaData) => {
    const params = new URLSearchParams()

    if (selectedRecordIds.length > 0) {
      params.set('recordsParam', 'recordIds')
      params.set('recordIds', selectedRecordIds.join(','))
    } else if (currentFilter.criteria.length > 0) {
      params.set('recordsParam', 'queryFilter')
      params.set('filterJSON', JSON.stringify(currentFilter))
    }

    const queryString = params.toString()
    const url = `/app/${encodeURIComponent(process.name)}${queryString ? `?${queryString}` : ''}`
    router.push(url)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative" data-qqq-id="process-launcher-menu">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        aria-label="Run process"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        data-qqq-id="process-launcher-trigger"
      >
        <Play className="h-4 w-4" aria-hidden="true" />
        Run Process
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
            role="menu"
            aria-label="Available processes"
          >
            <div className="max-h-64 overflow-y-auto py-1">
              {visibleProcesses.map((process) => (
                <button
                  key={process.name}
                  type="button"
                  role="menuitem"
                  onClick={() => handleProcessClick(process)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none dark:text-gray-300 dark:hover:bg-gray-800 dark:focus:bg-gray-800"
                  data-qqq-id={`process-launcher-item-${process.name}`}
                >
                  <Play className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                  <span className="truncate">{process.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
