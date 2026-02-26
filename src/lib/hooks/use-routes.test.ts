// Tests for app tree route generation

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'

import type { QInstance, QAppTreeNode } from '@/types'
import { useAppTreeRoutes } from './use-routes'

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

  it('should return empty routes for empty appTree', () => {
    const { result } = renderHook(() => useAppTreeRoutes(makeMetaData([])))

    expect(result.current.sidebarRoutes).toEqual([])
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

    expect(result.current.sidebarRoutes).toHaveLength(1)
    expect(result.current.sidebarRoutes[0]).toMatchObject({
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

    expect(tableKeys.length).toBeGreaterThanOrEqual(5)
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

  it('should handle nested APP nodes (depth 2)', () => {
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
            children: [],
          },
        ],
      },
    ]

    const { result } = renderHook(() => useAppTreeRoutes(makeMetaData(appTree)))

    expect(result.current.sidebarRoutes.length).toBeGreaterThanOrEqual(1)

    const mainApp = result.current.sidebarRoutes.find((r) => r.path === '/app/mainApp')
    expect(mainApp).toBeDefined()

    expect(mainApp?.children).toBeDefined()
    expect(mainApp?.children?.some((c) => c.path === '/app/mainApp/subApp')).toBe(true)
  })
})
