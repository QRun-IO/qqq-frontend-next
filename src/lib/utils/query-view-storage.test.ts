/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AD_HOC_VIEW_IDENTITY, clearStoredQueryState, readCurrentSavedViewId, readLegacyColumnState,
  readStoredQueryView, savedViewIdentity, writeCurrentSavedViewId, writeStoredQueryView,
} from './query-view-storage'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('Material query view persistence', () => {
  it('round trips one table view without leaking it to another table', () => {
    const view = { queryFilter: { criteria: [] }, rowsPerPage: 50, mode: 'advanced', viewIdentity: savedViewIdentity(7) }
    writeStoredQueryView('person', view)
    expect(readStoredQueryView('person')).toMatchObject(view)
    expect(readStoredQueryView('pet')).toBeNull()
    expect(AD_HOC_VIEW_IDENTITY).toBe('empty')
  })

  it('ignores invalid stored views rather than crashing the query screen', () => {
    localStorage.setItem('qqq.recordQueryView.person', '{bad json')
    expect(readStoredQueryView('person')).toBeNull()
    localStorage.setItem('qqq.recordQueryView.person', '[]')
    expect(readStoredQueryView('person')).toBeNull()
    localStorage.setItem('qqq.recordQueryView.person', JSON.stringify({ queryFilter: 'bad', quickFilterFieldNames: ['name', 2] }))
    expect(readStoredQueryView('person')).toMatchObject({ queryFilter: {}, quickFilterFieldNames: ['name'] })
  })

  it('remembers and clears the current saved view independently for each table', () => {
    expect(readCurrentSavedViewId('person')).toBeNull()
    writeCurrentSavedViewId('person', 17)
    writeCurrentSavedViewId('pet', 2)
    expect(readCurrentSavedViewId('person')).toBe(17)
    writeCurrentSavedViewId('person', null)
    expect(readCurrentSavedViewId('person')).toBeNull()
    expect(readCurrentSavedViewId('pet')).toBe(2)
    localStorage.setItem('qqq.currentSavedViewId.person', '0')
    expect(readCurrentSavedViewId('person')).toBeNull()
    localStorage.setItem('qqq.currentSavedViewId.person', 'garbage')
    expect(readCurrentSavedViewId('person')).toBeNull()
    clearStoredQueryState('pet')
    expect(readCurrentSavedViewId('pet')).toBeNull()
  })

  it('migrates valid legacy column choices and ignores malformed values', () => {
    expect(readLegacyColumnState('person')).toBeNull()
    localStorage.setItem('qqq-person-columns', JSON.stringify({ id: true, name: false }))
    localStorage.setItem('qqq-person-column-order', JSON.stringify(['name', 'id']))
    localStorage.setItem('qqq-person-column-widths', JSON.stringify({ name: 180 }))
    expect(readLegacyColumnState('person')).toEqual({
      columnVisibility: { id: true, name: false }, columnOrder: ['name', 'id'], columnWidths: { name: 180 },
    })
    localStorage.setItem('qqq-person-column-order', JSON.stringify(['name', 3]))
    expect(readLegacyColumnState('person')?.columnOrder).toEqual([])
  })

  it('treats unavailable browser storage as best effort', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readStoredQueryView('person')).toBeNull()
    expect(readCurrentSavedViewId('person')).toBeNull()
    expect(readLegacyColumnState('person')).toBeNull()
    vi.restoreAllMocks()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => writeStoredQueryView('person', { queryFilter: {} })).not.toThrow()
    expect(() => writeCurrentSavedViewId('person', 1)).not.toThrow()
    vi.restoreAllMocks()
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => writeCurrentSavedViewId('person', null)).not.toThrow()
    expect(() => clearStoredQueryState('person')).not.toThrow()
  })
})
