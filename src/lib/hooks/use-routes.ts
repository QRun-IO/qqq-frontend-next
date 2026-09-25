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
 * @file use-routes — derives sidebar navigation routes and path metadata from a QInstance app tree.
 */
'use client'

import { useMemo } from 'react'

import type { QInstance, QAppTreeNode, QIcon } from '@/types'
import type { QAppNodeType } from '@/types/enums'

/**
 * A single entry in the sidebar navigation tree.
 *
 * Nodes with `type: 'collapse'` are APP nodes (expandable when they have children).
 * Nodes with `type: 'item'` are leaf links (TABLE, PROCESS, or REPORT nodes, or the Dashboard).
 */
export interface SidebarRoute {
  /** Display label shown in the sidebar (the metadata `label`). */
  name: string
  /** Stable identifier: the backend node name, or `dashboard` for the landing page. */
  key: string
  /** Absolute path used for Next.js routing. */
  path: string
  /** Icon declared in metadata. */
  icon?: QIcon
  /** App-tree node type; absent for the Dashboard entry. */
  nodeType?: QAppNodeType
  /** Whether this node is an app group or a direct link. */
  type: 'collapse' | 'item'
  /** Child routes nested under an APP node (child apps nest recursively). */
  children?: SidebarRoute[]
}

/** An enclosing APP node, used for breadcrumbs and navigation context. */
export interface ParentAppInfo {
  /** Human-readable label of the APP node. */
  label: string
  /** URL path of the APP node. */
  path: string
}

/** A navigable (non-hidden) app-tree node, in tree order. */
export interface NavTarget {
  /** Backend node name. */
  key: string
  /** Metadata label. */
  label: string
  /** URL path (`/app/{name}`). */
  path: string
  /** App-tree node type. */
  nodeType: QAppNodeType
  /** Icon declared in metadata. */
  icon?: QIcon
  /** Enclosing apps, outermost first. */
  ancestors: ParentAppInfo[]
}

/**
 * All derived routing data computed from the QInstance app tree.
 *
 * Returned by {@link useAppTreeRoutes} and consumed by the sidebar, breadcrumbs,
 * command palette, header search and landing page.
 */
export interface RouteMap {
  /** Ordered sidebar nodes: the Dashboard entry, then every top-level APP node. */
  sidebarRoutes: SidebarRoute[]
  /** Maps every known route path to a human-readable label for breadcrumbs. */
  pathToLabelMap: Record<string, string>
  /** Maps each node path (`/app/{name}`) to its enclosing apps, outermost first. */
  ancestorAppMap: Record<string, ParentAppInfo[]>
  /** Every navigable node (hidden tables, processes and reports excluded), in tree order. */
  navTargets: NavTarget[]
  /** The first accessible app route, used as the post-login redirect target. */
  defaultRoute: string
}

/** Fixed pages under `/app` that are not app-tree nodes. */
const STATIC_PAGE_LABELS: Record<string, string> = {
  '/app': 'Dashboard',
  '/app/developer': 'Developer',
  '/app/search': 'Search',
}

/**
 * Returns the structured icon for an app-tree node, accepting the legacy `iconName`.
 *
 * @param node - App-tree node from metadata.
 * @returns The node's icon, or `undefined`.
 */
function nodeIcon(node: QAppTreeNode): QIcon | undefined {
  if (node.icon?.name || node.icon?.path) return node.icon
  return node.iconName ? { name: node.iconName } : undefined
}

/**
 * Whether a leaf node refers to an object the metadata marks as hidden.
 *
 * The backend omits objects the user may not access; hidden objects the user
 * may access are still returned (with `isHidden: true`) and stay reachable by URL,
 * but they are never shown in navigation.
 *
 * @param node - App-tree node.
 * @param metaData - Instance metadata.
 * @returns `true` when the node must not appear in navigation.
 */
export function isHiddenNode(node: QAppTreeNode, metaData: QInstance): boolean {
  switch (node.type) {
    case 'TABLE':
      return metaData.tables?.[node.name]?.isHidden === true
    case 'PROCESS':
      return metaData.processes?.[node.name]?.isHidden === true
    case 'REPORT':
      return metaData.reports?.[node.name]?.isHidden === true
    default:
      return false
  }
}

/**
 * Builds the route map from instance metadata. Pure function behind {@link useAppTreeRoutes}.
 *
 * App nesting has no depth limit: child apps become nested collapse groups.
 * URLs are flat (`/app/{name}`); hierarchy is kept in `ancestorAppMap`.
 *
 * @param metaData - Instance metadata, or `undefined` while loading.
 * @returns The derived route map.
 */
export function buildRouteMap(metaData: QInstance | undefined): RouteMap {
  if (!metaData) {
    return { sidebarRoutes: [], pathToLabelMap: {}, ancestorAppMap: {}, navTargets: [], defaultRoute: '/no-apps' }
  }

  const pathToLabelMap: Record<string, string> = { ...STATIC_PAGE_LABELS }
  const ancestorAppMap: Record<string, ParentAppInfo[]> = {}
  const navTargets: NavTarget[] = []
  let defaultRoute: string | undefined

  /**
   * Walks one level of the app tree and returns its sidebar routes.
   *
   * @param nodes - Nodes at this level.
   * @param ancestors - Enclosing apps, outermost first.
   * @returns Sidebar routes for the visible nodes at this level.
   */
  function visit(nodes: QAppTreeNode[], ancestors: ParentAppInfo[]): SidebarRoute[] {
    const routes: SidebarRoute[] = []
    for (const node of nodes) {
      const path = `/app/${node.name}`
      const icon = nodeIcon(node)
      pathToLabelMap[path] = node.label
      ancestorAppMap[path] = ancestors

      if (node.type === 'TABLE') {
        pathToLabelMap[`${path}/create`] = `Create ${node.label}`
        pathToLabelMap[`${path}/dev`] = 'Developer'
        pathToLabelMap[`${path}/key`] = 'View by Key'
      }

      if (node.type === 'APP') {
        defaultRoute ??= path
        navTargets.push({ key: node.name, label: node.label, path, nodeType: node.type, icon, ancestors })
        const children = visit(node.children ?? [], [...ancestors, { label: node.label, path }])
        routes.push({
          name: node.label,
          key: node.name,
          path,
          icon,
          nodeType: node.type,
          type: 'collapse',
          children: children.length > 0 ? children : undefined,
        })
      } else if (!isHiddenNode(node, metaData!)) {
        navTargets.push({ key: node.name, label: node.label, path, nodeType: node.type, icon, ancestors })
        routes.push({ name: node.label, key: node.name, path, icon, nodeType: node.type, type: 'item' })
      }
    }
    return routes
  }

  // A user with no permitted apps still gets the Dashboard entry (which explains the situation)
  const appRoutes = visit(metaData.appTree ?? [], [])
  const sidebarRoutes: SidebarRoute[] = [
    { name: 'Dashboard', key: 'dashboard', path: '/app', icon: { name: 'dashboard' }, type: 'item' },
    ...appRoutes,
  ]
  return { sidebarRoutes, pathToLabelMap, ancestorAppMap, navTargets, defaultRoute: defaultRoute ?? '/no-apps' }
}

/**
 * Generates sidebar navigation routes, labels, app ancestry and navigable targets
 * from the QInstance app tree.
 *
 * Permission filtering is done server-side (the backend only returns nodes the
 * user may access); hidden objects are removed from navigation here.
 *
 * @param metaData - The full QInstance metadata object, or `undefined` while metadata is loading
 *   (the hook then returns an empty `RouteMap`). With no permitted apps, only the Dashboard
 *   entry is returned and `defaultRoute` is `'/no-apps'`.
 * @returns The memoized {@link RouteMap}.
 */
export function useAppTreeRoutes(metaData: QInstance | undefined): RouteMap {
  return useMemo(() => buildRouteMap(metaData), [metaData])
}

