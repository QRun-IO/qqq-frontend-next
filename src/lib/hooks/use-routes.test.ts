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

// Tests for app tree route generation

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'

import type { QInstance, QAppTreeNode } from '@/types'
import { buildRouteMap, useAppTreeRoutes } from './use-routes'

function makeMetaData(appTree: QAppTreeNode[]): QInstance {
  return {
    apps: {},
    appTree,
    tables: {},
    processes: {},
    reports: {},
    widgets: {},
    branding: {
      companyName: 'Test',
      companyUrl: 'https://test.com',
      appName: 'Test App',
    },
    helpContents: {},
    environmentValues: {},
  }
}

describe('useAppTreeRoutes', () => {
  it('should return empty routes for undefined metadata', () => {
    const { result } = renderHook(() => useAppTreeRoutes(undefined))

    expect(result.current.sidebarRoutes).toEqual([])
    expect(result.current.pathToLabelMap).toEqual({})
    expect(result.current.defaultRoute).toBe('/no-apps')
  })

  it('keeps only the Dashboard entry when the user may access no apps', () => {
    const { result } = renderHook(() => useAppTreeRoutes(makeMetaData([])))

    // Regression: an empty tree used to return no routes, leaving the sidebar skeleton up forever
    expect(result.current.sidebarRoutes.map((route) => route.key)).toEqual(['dashboard'])
    expect(result.current.navTargets).toEqual([])
    expect(result.current.defaultRoute).toBe('/no-apps')
  })

  it('should generate sidebar routes for APP nodes', () => {
    const appTree: QAppTreeNode[] = [
      {
        name: 'myApp',
        label: 'My App',
        type: 'APP',
        children: [],
      },
    ]

    const { result } = renderHook(() => useAppTreeRoutes(makeMetaData(appTree)))

    // First route is the Dashboard, second is the app
    const appRoute = result.current.sidebarRoutes.find((r) => r.path === '/app/myApp')
    expect(appRoute).toBeDefined()
    expect(appRoute).toMatchObject({
      name: 'My App',
      path: '/app/myApp',
      type: 'collapse',
    })
  })

  it('should set defaultRoute to first APP node', () => {
    const appTree: QAppTreeNode[] = [
      { name: 'firstApp', label: 'First App', type: 'APP', children: [] },
      { name: 'secondApp', label: 'Second App', type: 'APP', children: [] },
    ]

    const { result } = renderHook(() => useAppTreeRoutes(makeMetaData(appTree)))

    expect(result.current.defaultRoute).toBe('/app/firstApp')
  })

  it('should generate routes in pathToLabelMap for TABLE nodes using flat /app/{name} paths', () => {
    const appTree: QAppTreeNode[] = [
      {
        name: 'myApp',
        label: 'My App',
        type: 'APP',
        children: [
          { name: 'myTable', label: 'My Table', type: 'TABLE' },
        ],
      },
    ]

    const { result } = renderHook(() => useAppTreeRoutes(makeMetaData(appTree)))

    // TABLE nodes use flat /app/{tableName} paths (not nested under app)
    const tableKeys = Object.keys(result.current.pathToLabelMap).filter((k) =>
      k.startsWith('/app/myTable')
    )

    expect(tableKeys.sort()).toEqual(['/app/myTable', '/app/myTable/create', '/app/myTable/dev', '/app/myTable/key'])
  })

  it('should add TABLE nodes to pathToLabelMap with flat /app/{name} paths', () => {
    const appTree: QAppTreeNode[] = [
      {
        name: 'hrApp',
        label: 'HR',
        type: 'APP',
        children: [
          { name: 'employee', label: 'Employees', type: 'TABLE' },
        ],
      },
    ]

    const { result } = renderHook(() => useAppTreeRoutes(makeMetaData(appTree)))

    expect(result.current.pathToLabelMap['/app/employee']).toBe('Employees')
    expect(result.current.pathToLabelMap['/app/employee/create']).toBe('Create Employees')
    expect(result.current.pathToLabelMap['/app/hrApp']).toBe('HR')
  })

  it('should add PROCESS nodes to pathToLabelMap with flat /app/{name} paths', () => {
    const appTree: QAppTreeNode[] = [
      {
        name: 'adminApp',
        label: 'Admin',
        type: 'APP',
        children: [
          { name: 'bulkImport', label: 'Bulk Import', type: 'PROCESS' },
        ],
      },
    ]

    const { result } = renderHook(() => useAppTreeRoutes(makeMetaData(appTree)))

    expect(result.current.pathToLabelMap['/app/bulkImport']).toBe('Bulk Import')
  })

  it('uses flat app URLs and preserves descendant table routes and breadcrumbs', () => {
    const appTree: QAppTreeNode[] = [
      {
        name: 'mainApp',
        label: 'Main App',
        type: 'APP',
        children: [
          {
            name: 'subApp',
            label: 'Sub App',
            type: 'APP',
            children: [{ name: 'employee', label: 'Employees', type: 'TABLE' }],
          },
        ],
      },
    ]

    const { result } = renderHook(() => useAppTreeRoutes(makeMetaData(appTree)))

    // Dashboard + at least one app
    expect(result.current.sidebarRoutes.length).toBeGreaterThanOrEqual(2)

    const mainApp = result.current.sidebarRoutes.find((r) => r.path === '/app/mainApp')
    expect(mainApp).toBeDefined()

    expect(mainApp?.children).toBeDefined()
    expect(mainApp?.children?.some((c) => c.path === '/app/subApp')).toBe(true)
    // Regression: nested apps appear only under their parent, never also at the top level
    expect(result.current.sidebarRoutes.map((r) => r.path)).toEqual(['/app', '/app/mainApp'])
    expect(result.current.pathToLabelMap['/app/subApp']).toBe('Sub App')
    expect(result.current.pathToLabelMap['/app/mainApp/subApp']).toBeUndefined()
    expect(result.current.pathToLabelMap['/app/employee/create']).toBe('Create Employees')
    expect(result.current.ancestorAppMap['/app/employee']).toEqual([
      { label: 'Main App', path: '/app/mainApp' },
      { label: 'Sub App', path: '/app/subApp' },
    ])
  })

  it('nests apps to any depth and records the full ancestry of every node', () => {
    const appTree: QAppTreeNode[] = [{
      name: 'one', label: 'One', type: 'APP', icon: { path: '/one.png' },
      children: [{
        name: 'two', label: 'Two', type: 'APP',
        children: [{
          name: 'three', label: 'Three', type: 'APP', icon: { name: 'layers' },
          children: [{ name: 'deep', label: 'Deep', type: 'TABLE', icon: { name: 'inventory_2' } }],
        }],
      }],
    }]
    const { sidebarRoutes, ancestorAppMap, navTargets } = buildRouteMap(makeMetaData(appTree))
    const deep = sidebarRoutes[1].children?.[0].children?.[0].children?.[0]
    expect(deep).toMatchObject({ key: 'deep', name: 'Deep', path: '/app/deep', type: 'item', nodeType: 'TABLE', icon: { name: 'inventory_2' } })
    expect(sidebarRoutes[1].icon).toEqual({ path: '/one.png' })
    expect(ancestorAppMap['/app/deep'].map((a) => a.label)).toEqual(['One', 'Two', 'Three'])
    expect(navTargets.map((t) => t.key)).toEqual(['one', 'two', 'three', 'deep'])
  })

  it('accepts the legacy iconName when no structured icon is declared', () => {
    const { sidebarRoutes } = buildRouteMap(makeMetaData([{ name: 'a', label: 'A', type: 'APP', iconName: 'star', children: [] }]))
    expect(sidebarRoutes[1].icon).toEqual({ name: 'star' })
  })

  it('omits hidden tables, processes and reports from navigation but keeps their labels and ancestry', () => {
    const metaData = makeMetaData([{
      name: 'app', label: 'App', type: 'APP',
      children: [
        { name: 'shown', label: 'Shown', type: 'TABLE' },
        { name: 'hiddenTable', label: 'Hidden Table', type: 'TABLE' },
        { name: 'hiddenProcess', label: 'Hidden Process', type: 'PROCESS' },
        { name: 'hiddenReport', label: 'Hidden Report', type: 'REPORT' },
      ],
    }])
    metaData.tables = {
      shown: { name: 'shown', label: 'Shown', isHidden: false } as QInstance['tables'][string],
      hiddenTable: { name: 'hiddenTable', label: 'Hidden Table', isHidden: true } as QInstance['tables'][string],
    }
    metaData.processes = { hiddenProcess: { name: 'hiddenProcess', label: 'Hidden Process', isHidden: true } as QInstance['processes'][string] }
    metaData.reports = { hiddenReport: { name: 'hiddenReport', label: 'Hidden Report', isHidden: true, hasPermission: true } }

    const { sidebarRoutes, navTargets, pathToLabelMap, ancestorAppMap } = buildRouteMap(metaData)
    expect(sidebarRoutes[1].children?.map((c) => c.key)).toEqual(['shown'])
    expect(navTargets.map((t) => t.key)).toEqual(['app', 'shown'])
    expect(pathToLabelMap['/app/hiddenTable']).toBe('Hidden Table')
    expect(ancestorAppMap['/app/hiddenTable']).toEqual([{ label: 'App', path: '/app/app' }])
  })

  it('labels the fixed dashboard pages', () => {
    const { pathToLabelMap } = buildRouteMap(makeMetaData([{ name: 'a', label: 'A', type: 'APP', children: [] }]))
    expect(pathToLabelMap['/app']).toBe('Dashboard')
    expect(pathToLabelMap['/app/developer']).toBe('Developer')
    expect(pathToLabelMap['/app/search']).toBe('Search')
  })
})
