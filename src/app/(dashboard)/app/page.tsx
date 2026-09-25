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
 * @file Dashboard home page — navigation overview: counts, recently viewed records, quick actions and applications.
 */

'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
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
import { canInsertRecords, canRunProcess } from '@/lib/auth/permissions'
import { useAppTreeRoutes } from '@/lib/hooks/use-routes'
import type { SidebarRoute } from '@/lib/hooks/use-routes'
import { getRecentRecords } from '@/lib/utils/recent-records'
import type { RecentRecord } from '@/lib/utils/recent-records'
import { MetadataIcon, type MetadataIconKind } from '@/components/layout/MetadataIcon'

/** Fallback icon kind for each app-tree node type. */
const ICON_KIND: Record<string, MetadataIconKind> = { APP: 'app', TABLE: 'table', PROCESS: 'process', REPORT: 'report' }

/**
 * Flattens an app route's descendants into leaf (non-app) routes.
 *
 * @param route - App route.
 * @returns Every table, process and report under the app, in tree order.
 */
function leafRoutes(route: SidebarRoute): SidebarRoute[] {
  return (route.children ?? []).flatMap((child) => (child.nodeType === 'APP' ? leafRoutes(child) : [child]))
}

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

/**
 * Top-level dashboard home page rendered at `/app`.
 *
 * Everything shown is derived from the navigable app tree, so hidden and
 * unpermitted objects never appear and all text uses metadata labels.
 * App dashboards (widgets) live on each app's own home page.
 *
 * @returns A composed page that assembles:
 *   - A time-based greeting header with the authenticated user's first name
 *   - Counts of navigable tables, processes and apps, and of widgets on those apps
 *   - A recently-viewed records list (up to 8, sourced from localStorage)
 *   - Quick actions: create links for up to 6 insertable tables; run links for up to 4 processes
 *   - An applications overview linking to each top-level app's home
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

  const { sidebarRoutes, navTargets } = useAppTreeRoutes(metaData)
  const appRoutes = sidebarRoutes.filter((route) => route.nodeType === 'APP')

  const appName = metaData?.branding?.appName || 'QQQ Admin'

  useEffect(() => {
    setPageHeader('Dashboard')
  }, [setPageHeader])

  // Load recent records on mount
  useEffect(() => {
    setRecentRecords(getRecentRecords().slice(0, 8))
  }, [])

  const tableTargets = navTargets.filter((target) => target.nodeType === 'TABLE')
  const processTargets = navTargets.filter((target) => target.nodeType === 'PROCESS')
  const appTargets = navTargets.filter((target) => target.nodeType === 'APP')
  const widgetNames = new Set(appTargets.flatMap((target) => (metaData?.apps?.[target.key]?.widgets ?? [])
    .filter((widgetName) => metaData?.widgets?.[widgetName]?.hasPermission)))

  // Tables in navigation the user may insert into (permission and TABLE_INSERT capability)
  const creatableTables = tableTargets
    .filter((target) => canInsertRecords(metaData?.tables?.[target.key]))
    .slice(0, 6)

  // Processes in navigation the user may run: DenyBehavior.DISABLED processes are
  // listed with hasPermission false and must not be offered (QRun-IO/qqq#671)
  const runnableProcesses = processTargets
    .filter((target) => canRunProcess(metaData?.processes?.[target.key]))
    .slice(0, 4)

  // Time-based greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name?.split(' ')[0] || ''

  const stats: Array<{ label: string; value: number; hint: string; icon: React.ReactNode; id: string }> = [
    { id: 'tables', label: 'Tables', value: tableTargets.length, hint: 'Data tables available', icon: <Database className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> },
    { id: 'processes', label: 'Processes', value: processTargets.length, hint: 'Automated workflows', icon: <Workflow className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> },
    { id: 'apps', label: 'Applications', value: appTargets.length, hint: 'App modules', icon: <Layers className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> },
    { id: 'widgets', label: 'Widgets', value: widgetNames.size, hint: 'Dashboard components', icon: <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> },
  ]

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
        {stats.map((stat) => (
          <div key={stat.id} className="rounded-xl border border-border bg-card p-5 shadow-sm" data-qqq-id={`dashboard-stat-${stat.id}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
              {stat.icon}
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground" data-qqq-id={`dashboard-stat-${stat.id}-value`}>{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
          </div>
        ))}
      </div>

      {/* Two-column layout: Recent Records + Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Records — takes 2 columns */}
        <section aria-labelledby="dashboard-recent-heading" className="lg:col-span-2 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h2 id="dashboard-recent-heading" className="text-lg font-bold text-foreground">Recently Viewed</h2>
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
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground" aria-hidden="true">
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
        </section>

        {/* Quick Actions — takes 1 column */}
        <section aria-labelledby="dashboard-actions-heading" className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 id="dashboard-actions-heading" className="text-lg font-bold text-foreground">Quick Actions</h2>
          </div>
          <div className="p-4 space-y-2">
            {creatableTables.map((target) => (
              <Link
                key={target.key}
                href={`${target.path}/create`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                data-qqq-id={`dashboard-create-${target.key}`}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                Create {target.label}
              </Link>
            ))}
            {runnableProcesses.map((target) => (
              <Link
                key={target.key}
                href={target.path}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                data-qqq-id={`dashboard-process-${target.key}`}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-chart-2/10 text-chart-2">
                  <MetadataIcon icon={target.icon} kind="process" className="h-3.5 w-3.5" />
                </div>
                {target.label}
              </Link>
            ))}
            {creatableTables.length === 0 && runnableProcesses.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No quick actions available</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Applications overview */}
      <section aria-labelledby="dashboard-apps-heading" className="space-y-4">
        <h2 id="dashboard-apps-heading" className="text-lg font-bold text-foreground">Applications</h2>
        {appRoutes.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {appRoutes.map((route) => {
              const leaves = leafRoutes(route)
              return (
                <Link
                  key={route.path}
                  href={route.path}
                  className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-qqq-id={`dashboard-app-${route.key}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <MetadataIcon icon={route.icon} kind="app" className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                          {route.name}
                        </h3>
                        {leaves.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {leaves.length} {leaves.length === 1 ? 'item' : 'items'}
                          </p>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                  </div>
                  {leaves.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {leaves.slice(0, 5).map((leaf) => (
                        <span
                          key={leaf.path}
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          <MetadataIcon icon={leaf.icon} kind={leaf.nodeType ? ICON_KIND[leaf.nodeType] : 'table'} className="h-3 w-3" />
                          {leaf.name}
                        </span>
                      ))}
                      {leaves.length > 5 && (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          +{leaves.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center" data-qqq-id="dashboard-no-apps">
            {/* Material Dashboard's NoApps message */}
            <p className="text-muted-foreground">You do not have permission to access any apps.</p>
          </div>
        )}
      </section>

      {/* System info footer */}
      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-border bg-card px-6 py-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" aria-hidden="true" />
          <span>{tableTargets.length} tables</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Workflow className="h-4 w-4" aria-hidden="true" />
          <span>{processTargets.length} processes</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>Logged in as {user?.email || 'unknown'}</span>
        </div>
      </div>
    </div>
  )
}
