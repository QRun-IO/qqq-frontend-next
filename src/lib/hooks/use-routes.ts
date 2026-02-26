'use client'

// Hook for generating routes and path label maps from QInstance app tree

import { useMemo } from 'react'

import type { QInstance, QAppTreeNode } from '@/types'

export interface SidebarRoute {
  name: string
  path: string
  icon?: string
  type: 'collapse' | 'item'
  children?: SidebarRoute[]
}

export interface RouteMap {
  sidebarRoutes: SidebarRoute[]
  pathToLabelMap: Record<string, string>
  defaultRoute: string
}

/**
 * Generates sidebar navigation routes and path-to-label mapping from QInstance app tree.
 * Supports max depth 2 (top-level apps + one level of children).
 * Returns the first accessible app as the default route.
 */
export function useAppTreeRoutes(metaData: QInstance | undefined): RouteMap {
  return useMemo(() => {
    if (!metaData?.appTree?.length) {
      return {
        sidebarRoutes: [],
        pathToLabelMap: {},
        defaultRoute: '/no-apps',
      }
    }

    const sidebarRoutes: SidebarRoute[] = []
    const pathToLabelMap: Record<string, string> = {}
    let defaultRoute = '/no-apps'
    let foundFirstApp = false

    // QQQ URL scheme is flat: /app/{name} for all node types.
    // App hierarchy is only for sidebar visual grouping — not reflected in URLs.
    function buildRoutes(nodes: QAppTreeNode[], parentPath: string, depth: number) {
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

          const children: SidebarRoute[] = []
          if (node.children && depth < 2) {
            buildRoutes(node.children, path, depth + 1)

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
        } else if (node.type === 'PROCESS') {
          pathToLabelMap[path] = node.label
        } else if (node.type === 'REPORT') {
          pathToLabelMap[path] = node.label
        }
      }
    }

    buildRoutes(metaData.appTree, '/app', 0)

    return { sidebarRoutes, pathToLabelMap, defaultRoute }
  }, [metaData])
}
