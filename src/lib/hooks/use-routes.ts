/** use-routes — derives sidebar navigation routes and path metadata from a QInstance app tree */
'use client'

import { useMemo } from 'react'

import type { QInstance, QAppTreeNode } from '@/types'

/**
 * A single entry in the sidebar navigation tree.
 *
 * Nodes with `type: 'collapse'` are expandable groups (APP nodes).
 * Nodes with `type: 'item'` are leaf links (TABLE, PROCESS, or REPORT nodes).
 */
export interface SidebarRoute {
  /** Display label shown in the sidebar. */
  name: string
  /** Absolute path used for Next.js routing. */
  path: string
  /** Optional icon identifier for the sidebar icon. */
  icon?: string
  /** Whether this node is an expandable group or a direct link. */
  type: 'collapse' | 'item'
  /** Child routes nested under a 'collapse' node. */
  children?: SidebarRoute[]
}

/** Maps a flat leaf path (e.g. /app/Products) to its parent app label + path */
export interface ParentAppInfo {
  /** Human-readable label of the parent APP node. */
  label: string
  /** URL path of the parent APP node. */
  path: string
}

/**
 * All derived routing data computed from the QInstance app tree.
 *
 * Returned by {@link useAppTreeRoutes} and consumed by the sidebar and breadcrumb components.
 */
export interface RouteMap {
  /** Ordered list of sidebar navigation nodes (Dashboard + all APP nodes). */
  sidebarRoutes: SidebarRoute[]
  /** Maps every known route path to a human-readable label for breadcrumbs. */
  pathToLabelMap: Record<string, string>
  /** Maps flat child paths to their parent app info for breadcrumbs */
  parentAppMap: Record<string, ParentAppInfo>
  /** The first accessible app route, used as the post-login redirect target. */
  defaultRoute: string
}

/**
 * Generates sidebar navigation routes and path-to-label mapping from QInstance app tree.
 *
 * Supports max depth 2 (top-level apps + one level of children).
 * Returns the first accessible app as the default route.
 * Permission filtering is done server-side; the backend only returns nodes
 * the current user may access.
 *
 * @param metaData - The full QInstance metadata object, or undefined while loading.
 * @returns A {@link RouteMap} containing sidebar routes, label map, parent map, and default route.
 */
export function useAppTreeRoutes(metaData: QInstance | undefined): RouteMap {
  return useMemo(() => {
    if (!metaData?.appTree?.length) {
      return {
        sidebarRoutes: [],
        pathToLabelMap: {},
        parentAppMap: {},
        defaultRoute: '/no-apps',
      }
    }

    const sidebarRoutes: SidebarRoute[] = [
      {
        name: 'Dashboard',
        path: '/app',
        icon: 'dashboard',
        type: 'item',
      },
    ]
    const pathToLabelMap: Record<string, string> = {
      '/app': 'Dashboard',
    }
    const parentAppMap: Record<string, ParentAppInfo> = {}
    let defaultRoute = '/app'
    let foundFirstApp = false

    // QQQ URL scheme is flat: /app/{name} for all node types.
    // App hierarchy is only for sidebar visual grouping — not reflected in URLs.
    // parentApp tracks the enclosing APP node so we can map leaves back to their parent.
    // LOW-8: permission filtering is done server-side — the backend only includes
    // nodes the current user may access, so no client-side hasPermission check needed.
    /**
     * Recursively walks the QAppTreeNode list, populating sidebarRoutes, pathToLabelMap,
     * and parentAppMap.
     *
     * @param nodes - The current level of app tree nodes to process.
     * @param parentPath - The URL path prefix built by ancestor APP nodes.
     * @param depth - Current recursion depth; stops at 2.
     * @param parentApp - The nearest enclosing APP node info, used for parentAppMap entries.
     */
    function buildRoutes(nodes: QAppTreeNode[], parentPath: string, depth: number, parentApp?: { label: string; path: string }) {
      if (depth > 2) return

      for (const node of nodes) {
        // Tables, processes, and reports always use a flat /app/{name} path.
        // Only APP nodes use the parent path to build their own URL.
        const isLeaf = node.type === 'TABLE' || node.type === 'PROCESS' || node.type === 'REPORT'
        const path = isLeaf ? `/app/${node.name}` : `${parentPath}/${node.name}`

        if (node.type === 'APP') {
          pathToLabelMap[path] = node.label

          if (!foundFirstApp) {
            defaultRoute = path
            foundFirstApp = true
          }

          const appInfo = { label: node.label, path }
          const children: SidebarRoute[] = []
          if (node.children && depth < 2) {
            buildRoutes(node.children, path, depth + 1, appInfo)

            // Build sidebar children using each child's resolved flat path
            for (const child of node.children) {
              const childPath = (child.type === 'TABLE' || child.type === 'PROCESS' || child.type === 'REPORT')
                ? `/app/${child.name}`
                : `${path}/${child.name}`
              children.push({
                name: child.label,
                path: childPath,
                icon: child.iconName,
                type: 'item',
              })
            }
          }

          sidebarRoutes.push({
            name: node.label,
            path,
            icon: node.iconName,
            type: 'collapse',
            children: children.length > 0 ? children : undefined,
          })
        } else if (node.type === 'TABLE') {
          // Register all table-related routes in the path map
          const tableRoutes: Array<[string, string]> = [
            [path, node.label],
            [`${path}/create`, `Create ${node.label}`],
            [`${path}/dev`, `${node.label} — Developer`],
            [`${path}/key`, `${node.label} — View by Key`],
            [`${path}/savedView/:viewId`, `${node.label} — Saved View`],
          ]
          for (const [routePath, label] of tableRoutes) {
            pathToLabelMap[routePath] = label
          }
          // Map this flat path back to its parent app for breadcrumbs
          if (parentApp) {
            parentAppMap[path] = parentApp
            // Also map sub-routes (create, edit, view) to the same parent
            parentAppMap[`${path}/create`] = parentApp
          }
        } else if (node.type === 'PROCESS') {
          pathToLabelMap[path] = node.label
          if (parentApp) {
            parentAppMap[path] = parentApp
          }
        } else if (node.type === 'REPORT') {
          pathToLabelMap[path] = node.label
          if (parentApp) {
            parentAppMap[path] = parentApp
          }
        }
      }
    }

    buildRoutes(metaData.appTree, '/app', 0)

    return { sidebarRoutes, pathToLabelMap, parentAppMap, defaultRoute }
  }, [metaData])
}
