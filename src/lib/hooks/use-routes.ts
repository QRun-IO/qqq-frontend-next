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

import type { QInstance, QAppTreeNode, QIcon, QAppSection, QAppSectionRole } from '@/types'
import type { QAppNodeType } from '@/types/enums'
import { DEFAULT_HOME_PATH, homePath as instanceHomePath } from '@/lib/utils/home-app'

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
  /**
   * The app's sections (UI API 1.7.0 roles), each holding some of `children` in server order.
   * Absent when the app has no sections, or only one plain (PRIMARY) section.
   */
  sections?: SidebarSection[]
  /**
   * Other paths this entry stands for. An app with a single child is shown as one leaf, active on
   * the app's home and on its only child.
   */
  alsoActivePaths?: string[]
}

/**
 * A heading inside an app's sidebar list (an app section). A section is a visual grouping only:
 * it is never a destination (no page, no URL, no breadcrumb level).
 */
export interface SidebarSection {
  /** Section name, unique within the app. */
  key: string
  /** Heading text (the metadata `label`). */
  label: string
  /** How the section is presented: PRIMARY without a heading, HISTORY and GROUP under a heading, SETTINGS collapsible. */
  role: QAppSectionRole
  /** Whether the section starts collapsed (SETTINGS unless the metadata says otherwise). */
  collapsedByDefault: boolean
  /** The section's entries, in server order. */
  routes: SidebarRoute[]
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
  /** Search aliases from metadata (old labels, jargon): matched by search, never displayed. */
  keywords?: string[]
}

/**
 * All derived routing data computed from the QInstance app tree.
 *
 * Returned by {@link useAppTreeRoutes} and consumed by the sidebar, breadcrumbs,
 * command palette, header search and landing page.
 */
export interface RouteMap {
  /** Ordered sidebar nodes: the Dashboard entry (or, with a home app, that app as the single top entry), then every top-level APP node. */
  sidebarRoutes: SidebarRoute[]
  /** Maps every known route path to a human-readable label for breadcrumbs. */
  pathToLabelMap: Record<string, string>
  /** Maps each node path (`/app/{name}`) to its enclosing apps, outermost first. */
  ancestorAppMap: Record<string, ParentAppInfo[]>
  /** Every navigable node (hidden tables, processes and reports excluded), in tree order. */
  navTargets: NavTarget[]
  /** The first accessible app route, used as the post-login redirect target. */
  defaultRoute: string
  /**
   * Where "home" goes (sidebar logo, breadcrumb root, `/app` itself): the instance's home app
   * (`homeAppName`) when it designates one the user may open, otherwise the `/app` overview.
   */
  homePath: string
  /**
   * Where a section name used as a page path goes: `/app/{section}` to `/app/{app}#{section}`.
   * Groups that used to be apps (and their saved links) land on the app that now heads them.
   */
  sectionRedirects: Record<string, string>
}

/** Known section roles; anything else from a newer server is shown as PRIMARY. */
const SECTION_ROLES: readonly QAppSectionRole[] = ['PRIMARY', 'HISTORY', 'SETTINGS', 'GROUP']

/**
 * The role a client uses for a section: the metadata `role` (UI API 1.7.0), or, from an older
 * server, inferred like the server does: `settings` (name or label) is SETTINGS, `history` is
 * HISTORY, a section of apps only is GROUP, anything else PRIMARY.
 *
 * @param section - App section metadata.
 * @returns The effective role.
 */
export function sectionRole(section: QAppSection): QAppSectionRole {
  if (section.role) {
    return (SECTION_ROLES as readonly string[]).includes(section.role) ? (section.role as QAppSectionRole) : 'PRIMARY'
  }
  if (section.name?.toLowerCase() === 'settings' || section.label?.toLowerCase() === 'settings') return 'SETTINGS'
  if (section.name?.toLowerCase() === 'history') return 'HISTORY'
  const hasObjects = Boolean(section.tables?.length || section.processes?.length || section.reports?.length)
  return !hasObjects && Boolean(section.apps?.length) ? 'GROUP' : 'PRIMARY'
}

/**
 * Splits an app's child routes into its sections, keeping the server's order inside each one.
 * Children no section lists join the first PRIMARY section (or a leading untitled one). Empty
 * sections are dropped. A lone PRIMARY section is no grouping at all, so it returns `undefined`.
 *
 * @param sections - The app's section metadata.
 * @param children - The app's child routes, in server order.
 * @returns The sidebar sections, or `undefined` for a plain list.
 */
export function buildSidebarSections(sections: QAppSection[] | undefined, children: SidebarRoute[]): SidebarSection[] | undefined {
  if (!sections?.length || children.length === 0) return undefined
  const placed = new Set<string>()
  const result: SidebarSection[] = []
  for (const section of sections) {
    const names = new Set([...(section.tables ?? []), ...(section.processes ?? []), ...(section.reports ?? []), ...(section.apps ?? [])])
    const routes = children.filter((child) => names.has(child.key) && !placed.has(child.key))
    routes.forEach((child) => placed.add(child.key))
    if (routes.length === 0) continue
    const role = sectionRole(section)
    result.push({ key: section.name, label: section.label, role, collapsedByDefault: section.collapsedByDefault ?? role === 'SETTINGS', routes })
  }
  const unplaced = children.filter((child) => !placed.has(child.key))
  if (unplaced.length > 0) {
    const primary = result.find((section) => section.role === 'PRIMARY')
    if (primary) {
      primary.routes = children.filter((child) => primary.routes.includes(child) || unplaced.includes(child))
    } else {
      result.unshift({ key: '', label: '', role: 'PRIMARY', collapsedByDefault: false, routes: unplaced })
    }
  }
  if (result.length === 0 || (result.length === 1 && result[0].role === 'PRIMARY')) return undefined
  return result
}

/** Fixed pages under `/app` that are not app-tree nodes. */
const STATIC_PAGE_LABELS: Record<string, string> = {
  '/app': 'Dashboard',
  '/app/developer': 'Developer',
  '/app/search': 'Search',
  '/app/notifications': 'Notifications',
  '/app/jobs': 'Jobs',
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
    return { sidebarRoutes: [], pathToLabelMap: {}, ancestorAppMap: {}, navTargets: [], defaultRoute: '/no-apps', homePath: DEFAULT_HOME_PATH, sectionRedirects: {} }
  }

  const pathToLabelMap: Record<string, string> = { ...STATIC_PAGE_LABELS }
  const ancestorAppMap: Record<string, ParentAppInfo[]> = {}
  const navTargets: NavTarget[] = []
  const sectionRedirects: Record<string, string> = {}
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
        navTargets.push({ key: node.name, label: node.label, path, nodeType: node.type, icon, ancestors, keywords: node.keywords })
        const children = visit(node.children ?? [], [...ancestors, { label: node.label, path }])
        const app = metaData!.apps?.[node.name]
        for (const section of app?.sections ?? []) {
          if (sectionRole(section) === 'GROUP') sectionRedirects[`/app/${section.name}`] ??= `${path}#${section.name}`
        }
        const only = children.length === 1 ? children[0] : undefined
        if (ancestors.length > 0 && only?.type === 'item' && only.nodeType && only.nodeType !== 'APP') {
          // One child: a leaf, not a collapse that opens to one item. With a home (widgets) it
          // opens the app's home; without, its only child.
          const hasHome = (app?.widgets?.length ?? 0) > 0
          routes.push({
            name: node.label,
            key: node.name,
            path: hasHome ? path : only.path,
            icon,
            nodeType: node.type,
            type: 'item',
            alsoActivePaths: hasHome ? [only.path] : [path],
          })
          continue
        }
        routes.push({
          name: node.label,
          key: node.name,
          path,
          icon,
          nodeType: node.type,
          type: 'collapse',
          children: children.length > 0 ? children : undefined,
          sections: buildSidebarSections(app?.sections, children),
        })
      } else if (!isHiddenNode(node, metaData!)) {
        navTargets.push({ key: node.name, label: node.label, path, nodeType: node.type, icon, ancestors, keywords: node.keywords })
        routes.push({ name: node.label, key: node.name, path, icon, nodeType: node.type, type: 'item' })
      }
    }
    return routes
  }

  // A user with no permitted apps still gets the Dashboard entry (which explains the situation)
  const appRoutes = visit(metaData.appTree ?? [], [])

  // Tables, processes and reports outside the app tree still open by direct link: name them by label too
  const objects: Array<[QAppNodeType, Record<string, { label?: string }> | undefined]> = [
    ['TABLE', metaData.tables], ['PROCESS', metaData.processes], ['REPORT', metaData.reports],
  ]
  for (const [type, byName] of objects) {
    for (const [name, object] of Object.entries(byName ?? {})) {
      const path = `/app/${name}`
      if (pathToLabelMap[path] || !object?.label) continue
      pathToLabelMap[path] = object.label
      if (type === 'TABLE') {
        pathToLabelMap[`${path}/create`] = `Create ${object.label}`
        pathToLabelMap[`${path}/dev`] = 'Developer'
        pathToLabelMap[`${path}/key`] = 'View by Key'
      }
    }
  }
  // One landing page: with a home app, /app shows that app, which becomes the single top entry in
  // place of the built-in Dashboard (no separate overview entry beside it).
  const homePath = instanceHomePath(metaData)
  const homeRoute = appRoutes.find((route) => route.path === homePath)
  const sidebarRoutes: SidebarRoute[] = homeRoute
    ? [homeRoute, ...appRoutes.filter((route) => route !== homeRoute)]
    : [{ name: 'Dashboard', key: 'dashboard', path: '/app', icon: { name: 'dashboard' }, type: 'item' }, ...appRoutes]
  return { sidebarRoutes, pathToLabelMap, ancestorAppMap, navTargets, defaultRoute: defaultRoute ?? '/no-apps', homePath, sectionRedirects }
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

