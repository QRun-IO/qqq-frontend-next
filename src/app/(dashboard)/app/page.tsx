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
 * @file Dashboard home page — shows system stats, recently viewed records, quick actions, widgets, and app navigation.
 */

'use client'

// Dashboard — top-level home page showing system overview
// Demonstrates: stats, recent records, quick actions, app navigation, widget rendering

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Table2,
  Workflow,
  Clock,
  ArrowRight,
  Plus,
  Activity,
  Database,
  Layers,
  TrendingUp,
  Users,
  FileText,
} from 'lucide-react'

import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { useQContext } from '@/lib/context/q-context'
import { useAuth } from '@/lib/auth/use-auth'
import { useAppTreeRoutes } from '@/lib/hooks/use-routes'
import { getRecentRecords } from '@/lib/utils/recent-records'
import type { RecentRecord } from '@/lib/utils/recent-records'
import type { QWidgetMetaData } from '@/types'
import { ConnectedWidget } from '@/components/widgets/ConnectedWidget'

/**
 * Top-level dashboard home page rendered at `/app`.
 *
 * Displays system statistics derived from application metadata, a recently-viewed
 * records list sourced from localStorage, quick-action links for creatable tables
 * and runnable processes, home-level widgets from any app definition, and an
 * applications overview grid.
 *
 * @returns The full dashboard home page layout.
 */
export default function DashboardPage() {
  const { setPageHeader } = useQContext()
  const { user } = useAuth()
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([])

  const { data: metaData } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
  })

  const { sidebarRoutes } = useAppTreeRoutes(metaData)
  const appRoutes = sidebarRoutes.filter((r) => r.path !== '/app')

  const appName = metaData?.branding?.appName || 'QQQ Admin'

  useEffect(() => {
    setPageHeader('Dashboard')
  }, [setPageHeader])

  // Load recent records on mount
  useEffect(() => {
    setRecentRecords(getRecentRecords().slice(0, 8))
  }, [])

  // Compute system stats from metadata
  const tableCount = metaData ? Object.keys(metaData.tables).length : 0
  const processCount = metaData ? Object.keys(metaData.processes).length : 0
  const appCount = metaData ? Object.keys(metaData.apps).length : 0
  const widgetCount = metaData ? Object.keys(metaData.widgets).length : 0

  // Gather tables that support create for quick actions
  const creatableTables = metaData
    ? Object.values(metaData.tables)
        .filter((t) => !t.isHidden && t.insertPermission && t.capabilities?.includes('TABLE_INSERT'))
        .slice(0, 6)
    : []

  // Gather runnable processes for quick actions
  const runnableProcesses = metaData
    ? Object.values(metaData.processes)
        .filter((p) => !p.isHidden)
        .slice(0, 4)
    : []

  // Gather home-level widgets (widgets that are on any app's home)
  const homeWidgets: QWidgetMetaData[] = []
  if (metaData) {
    const seen = new Set<string>()
    for (const app of Object.values(metaData.apps)) {
      for (const wName of app.widgets) {
        if (!seen.has(wName) && metaData.widgets[wName]?.hasPermission) {
          seen.add(wName)
          homeWidgets.push(metaData.widgets[wName])
        }
      }
    }
  }

  // Time-based greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name?.split(' ')[0] || ''

  /**
   * Formats a Unix millisecond timestamp as a human-readable relative time string.
   *
   * @param timestamp - Milliseconds since epoch (e.g. from `Date.now()`).
   * @returns A string such as "Just now", "5m ago", "3h ago", or "2d ago".
   */
  function timeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="space-y-8" data-qqq-id="dashboard-home">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s an overview of your {appName} system.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Tables</span>
            <Database className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{tableCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Data tables available</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Processes</span>
            <Workflow className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{processCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Automated workflows</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Applications</span>
            <Layers className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{appCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">App modules</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Widgets</span>
            <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{widgetCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Dashboard components</p>
        </div>
      </div>

      {/* Two-column layout: Recent Records + Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Records — takes 2 columns */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-lg font-bold text-foreground">Recently Viewed</h2>
            </div>
          </div>
          <div className="divide-y divide-border">
            {recentRecords.length > 0 ? (
              recentRecords.map((record) => (
                <Link
                  key={record.path}
                  href={record.path}
                  className="flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-accent"
                  data-qqq-id={`dashboard-recent-${record.recordId}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {record.recordLabel.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {record.recordLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">{record.tableLabel}</p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-xs text-muted-foreground">
                    {timeAgo(record.viewedAt)}
                  </span>
                </Link>
              ))
            ) : (
              <div className="px-6 py-12 text-center">
                <Activity className="mx-auto h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
                <p className="mt-2 text-sm text-muted-foreground">No recently viewed records</p>
                <p className="text-xs text-muted-foreground">Records you view will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions — takes 1 column */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-bold text-foreground">Quick Actions</h2>
          </div>
          <div className="p-4 space-y-2">
            {creatableTables.map((table) => (
              <Link
                key={table.name}
                href={`/app/${table.name}/create`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                data-qqq-id={`dashboard-create-${table.name}`}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                Create {table.label}
              </Link>
            ))}
            {runnableProcesses.map((process) => (
              <Link
                key={process.name}
                href={`/app/${process.name}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                data-qqq-id={`dashboard-process-${process.name}`}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-chart-2/10 text-chart-2">
                  <Workflow className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                {process.label}
              </Link>
            ))}
            {creatableTables.length === 0 && runnableProcesses.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No quick actions available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Home Widgets — rendered from metadata */}
      {homeWidgets.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">Widgets</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {homeWidgets.slice(0, 6).map((widget) => (
              <ConnectedWidget key={widget.name} widgetMetaData={widget} />
            ))}
          </div>
        </div>
      )}

      {/* Applications overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Applications</h2>
        </div>
        {appRoutes.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {appRoutes.map((route) => (
              <Link
                key={route.path}
                href={route.children?.[0]?.path ?? route.path}
                className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-qqq-id={`dashboard-app-${route.name}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                        {route.name}
                      </h3>
                      {route.children && route.children.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {route.children.length} {route.children.length === 1 ? 'item' : 'items'}
                        </p>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                </div>
                {/* Show child items preview */}
                {route.children && route.children.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {route.children.slice(0, 5).map((child) => (
                      <span
                        key={child.path}
                        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        <Table2 className="h-3 w-3" aria-hidden="true" />
                        {child.name}
                      </span>
                    ))}
                    {route.children.length > 5 && (
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        +{route.children.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center">
            <p className="text-muted-foreground">No applications available</p>
          </div>
        )}
      </div>

      {/* System info footer */}
      <div className="flex items-center gap-6 rounded-xl border border-border bg-card px-6 py-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" aria-hidden="true" />
          <span>{tableCount} tables</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Workflow className="h-4 w-4" aria-hidden="true" />
          <span>{processCount} processes</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>Logged in as {user?.email || 'unknown'}</span>
        </div>
      </div>
    </div>
  )
}
