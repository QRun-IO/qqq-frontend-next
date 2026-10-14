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

// Tests for the search model: match quality, per-table ordering and grouping, counts,
// URL state, and the quick search's groups (top hits, pages, tables, recents, actions)

import { describe, it, expect } from 'vitest'

import type { NavTarget } from '@/lib/hooks/use-routes'
import type { RecordSearchResult } from '@/lib/api/record-search'
import type { RecentRecord } from '@/lib/utils/recent-records'
import {
  buildQuickSearchGroups,
  flattenOptions,
  groupResultsByTable,
  labelQuality,
  orderTableResults,
  parseSearchPageState,
  searchPagePath,
  tableCountLabel,
  tableHasMore,
  termCompletions,
} from './search-model'

const crm = { label: 'CRM', path: '/app/crm' }
const navTargets: NavTarget[] = [
  { key: 'crm', label: 'CRM', path: '/app/crm', nodeType: 'APP', ancestors: [] },
  { key: 'account', label: 'Accounts', path: '/app/account', nodeType: 'TABLE', ancestors: [crm] },
  { key: 'acmeSync', label: 'Sync Acme Orders', path: '/app/acmeSync', nodeType: 'PROCESS', ancestors: [crm] },
]
const tables = [{ name: 'account', label: 'Accounts', icon: { name: 'business' } }, { name: 'contact', label: 'Contacts' }]

/**
 * A record search result.
 *
 * @param tableName - Table.
 * @param recordId - Id.
 * @param recordLabel - Label.
 * @param extra - Extended fields.
 * @returns The result.
 */
function hit(tableName: string, recordId: string, recordLabel: string, extra: Partial<RecordSearchResult> = {}): RecordSearchResult {
  return { tableName, recordId, recordLabel, ...extra }
}

describe('labelQuality', () => {
  it('grades exact, prefix, word-start, contained and no match', () => {
    expect(labelQuality('Acme', 'acme')).toBe(4)
    expect(labelQuality('Acme Corp', 'acme')).toBe(3)
    expect(labelQuality('The Acme Corp', 'corp acme')).toBe(2)
    expect(labelQuality('Bigacme', 'acme')).toBe(1)
    expect(labelQuality('Other', 'acme')).toBe(0)
    expect(labelQuality('Other', '  ')).toBe(0)
  })
})

describe('orderTableResults', () => {
  const results = [hit('a', '1', 'Big Acme'), hit('a', '2', 'Acme', { updatedAt: '2026-01-01T00:00:00Z' }), hit('a', '3', 'Acme Two', { updatedAt: '2026-06-01T00:00:00Z' })]

  it('ranks better label matches first for the default search (primary key order)', () => {
    expect(orderTableResults(results, 'acme').map((result) => result.recordId)).toEqual(['2', '3', '1'])
  })

  it("keeps a provider's order (it sent scores)", () => {
    const scored = results.map((result, index) => ({ ...result, score: 10 - index }))
    expect(orderTableResults(scored, 'acme').map((result) => result.recordId)).toEqual(['1', '2', '3'])
  })

  it('orders by most recent update, undated last, for "recent"', () => {
    expect(orderTableResults(results, 'acme', 'recent').map((result) => result.recordId)).toEqual(['3', '2', '1'])
  })
})

describe('groupResultsByTable / counts', () => {
  it('groups in backend table order with metadata labels, icons and summaries', () => {
    const groups = groupResultsByTable(
      [hit('contact', '9', 'Ann'), hit('account', '1', 'Acme', { tableLabel: 'Ignored' }), hit('contact', '8', 'Bob')],
      [{ tableName: 'account', hasMore: true }],
      tables,
      'a'
    )
    expect(groups.map((group) => [group.tableName, group.tableLabel, group.results.length, group.summary?.hasMore])).toEqual([
      ['contact', 'Contacts', 2, undefined],
      ['account', 'Accounts', 1, true],
    ])
    expect(groups[1].icon).toEqual({ name: 'business' })
  })

  it('labels counts with totals, "+" when more exist, else the returned count', () => {
    expect(tableCountLabel(5, { tableName: 'a', totalCount: 128 })).toBe('128')
    expect(tableCountLabel(5, { tableName: 'a', hasMore: true })).toBe('5+')
    expect(tableCountLabel(3)).toBe('3')
  })

  it('tells when a table has more: summary first, then a full page from older backends', () => {
    expect(tableHasMore(5, { tableName: 'a', hasMore: false }, 5)).toBe(false)
    expect(tableHasMore(5, { tableName: 'a', hasMore: true }, 5)).toBe(true)
    expect(tableHasMore(5, { tableName: 'a', totalCount: 9 }, 5)).toBe(true)
    expect(tableHasMore(5, undefined, 5)).toBe(true)
    expect(tableHasMore(4, undefined, 5)).toBe(false)
  })
})

describe('termCompletions', () => {
  it('completes the last word from label words, most frequent first, keeping the earlier words', () => {
    expect(termCompletions('acme co', ['Acme Corp', 'Acme Corporation', 'Corp of Acme', 'Cobalt'])).toEqual(['acme corp', 'acme cobalt', 'acme corporation'])
    expect(termCompletions('pe', ['Person', 'Pet', 'Pet Species'])).toEqual(['pet', 'person'])
  })

  it('needs two characters, and never offers the term itself', () => {
    expect(termCompletions('a', ['Acme'])).toEqual([])
    expect(termCompletions('acme', ['Acme'])).toEqual([])
  })
})

describe('search page URL state', () => {
  it('round-trips q, tables, view and sort, omitting defaults', () => {
    expect(searchPagePath({ q: ' acme ' })).toBe('/app/search?q=acme')
    expect(searchPagePath({ q: 'acme', tables: ['account', 'contact'], sort: 'recent' })).toBe('/app/search?q=acme&tables=account%2Ccontact&sort=recent')
    expect(searchPagePath({ q: 'acme', tables: ['account'], view: 'pages' })).toBe('/app/search?q=acme&view=pages')
    expect(searchPagePath({ q: '' })).toBe('/app/search')
    expect(parseSearchPageState(new URLSearchParams('q=acme&tables=account,,contact,account&sort=recent'))).toEqual({ q: 'acme', tables: ['account', 'contact'], sort: 'recent', view: 'all' })
    expect(parseSearchPageState(new URLSearchParams('q=x&sort=bogus&view=pages&tables=a'))).toEqual({ q: 'x', tables: [], sort: 'relevance', view: 'pages' })
  })
})

describe('buildQuickSearchGroups', () => {
  const recent: RecentRecord[] = [
    { tableName: 'contact', tableLabel: 'Contacts', recordId: '5', recordLabel: 'Acme buyer', path: '/app/contact/5', viewedAt: 2 },
    { tableName: 'account', tableLabel: 'Accounts', recordId: '1', recordLabel: 'Acme', path: '/app/account/1', viewedAt: 1 },
  ]

  it('without a term lists recent searches, then recently viewed records', () => {
    const groups = buildQuickSearchGroups({ term: ' ', navTargets, recentRecords: recent, recentSearches: ['acme', 'bolt'], results: [], tables, limitPerTable: 6 })
    expect(groups.map((group) => [group.kind, group.options.length])).toEqual([['recent-searches', 2], ['recent', 2]])
    expect(groups[0].options[0]).toEqual({ id: 'query:acme', kind: 'query', term: 'acme' })
  })

  it('promotes exact and prefix matches to top hits, then pages, tables with counts and more links, recents and search-all', () => {
    const results = [
      hit('account', '1', 'Acme', { tableLabel: 'Accounts' }),
      hit('account', '2', 'Big Acme Holdings'),
      hit('contact', '7', 'Wile E. Coyote', { highlights: [{ fieldName: 'company', text: 'Acme', matches: [{ start: 0, end: 4 }] }] }),
    ]
    const groups = buildQuickSearchGroups({
      term: 'acme', navTargets, recentRecords: recent, recentSearches: [], results,
      summaries: [{ tableName: 'account', hasMore: true, totalCount: 14 }], tables, limitPerTable: 6,
    })
    expect(groups.map((group) => [group.kind, group.heading, group.count ?? null])).toEqual([
      ['top', 'Top hits', null],
      ['pages', 'Pages', null],
      ['table', 'Accounts', '14'],
      ['table', 'Contacts', '1'],
      ['recent', 'Recently viewed', null],
      ['actions', 'Search', null],
    ])
    expect(groups[0].options.map((option) => option.id)).toEqual(['record:account:1'])
    expect(groups[1].options.map((option) => option.id)).toEqual(['page:/app/acmeSync'])
    // the top hit is not repeated; the table still links to all its matches
    expect(groups[2].options.map((option) => option.id)).toEqual(['record:account:2', 'more:account'])
    expect(groups[2].options[1]).toMatchObject({ kind: 'more', path: '/app/search?q=acme&tables=account', count: '14' })
    // a recently viewed record found by the search is not listed twice
    expect(groups[4].options.map((option) => option.id)).toEqual(['recent:/app/contact/5'])
    expect(flattenOptions(groups).at(-1)).toEqual({ id: 'all', kind: 'all', path: '/app/search?q=acme', term: 'acme' })
  })

  it('always ends with search-all, even when nothing matches', () => {
    const groups = buildQuickSearchGroups({ term: 'zzz', navTargets, recentRecords: [], recentSearches: [], results: [], tables, limitPerTable: 6 })
    expect(groups.map((group) => group.kind)).toEqual(['actions'])
  })
})
