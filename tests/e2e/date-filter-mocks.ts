// Mock backend for the date-filter e2e specs: DATE_TIME and DATE fields on person, and a query that
// applies the filter it is sent (including StartOfPeriod expressions, in the zone from
// X-QQQ-UserTimezone, as of a settable "now").

import type { Page, Route } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'
import { evaluateStartOfPeriod, startOfDayMs } from '../../src/lib/utils/date-range-utils'

export const NOW = new Date('2026-10-14T15:30:00Z')
export const TOMORROW = new Date('2026-10-15T15:30:00Z')

export type Criterion = { fieldName: string; operator: string; values: unknown[] }

/** People by when they were created, around the edges of "Oct 1 to Oct 12" in Chicago (CDT, UTC-5). */
export const PEOPLE = [
  { id: 1, firstName: 'BeforeEdge', createdAt: '2026-10-01T04:59:59.999Z', dueDate: '2026-09-30' }, // Sep 30, 11:59:59.999 PM
  { id: 2, firstName: 'FirstEdge', createdAt: '2026-10-01T05:00:00Z', dueDate: '2026-10-01' }, // Oct 1, 12:00 AM
  { id: 3, firstName: 'Middle', createdAt: '2026-10-08T05:00:00Z', dueDate: '2026-10-08' }, // Oct 8, 12:00 AM: the first moment of "Last 7 days" on Oct 14
  { id: 4, firstName: 'LastEdge', createdAt: '2026-10-13T04:59:00Z', dueDate: '2026-10-12' }, // Oct 12, 11:59 PM
  { id: 5, firstName: 'AfterEdge', createdAt: '2026-10-13T05:00:00Z', dueDate: '2026-10-13' }, // Oct 13, 12:00 AM
  { id: 6, firstName: 'Recent', createdAt: '2026-10-14T13:00:00Z', dueDate: '2026-10-14' }, // Oct 14, 8:00 AM
]

let now = NOW

/**
 * Sets the moment the mock backend evaluates relative dates as of.
 *
 * @param value - The moment.
 */
export function setNow(value: Date): void {
  now = value
}

/** The value a criterion value stands for, as the backend would evaluate it. */
function resolve(value: unknown, fieldType: 'DATE' | 'DATE_TIME', zone: string): string {
  if (typeof value === 'object' && value !== null && (value as { type?: string }).type === 'StartOfPeriod') {
    const ymd = evaluateStartOfPeriod(value as Parameters<typeof evaluateStartOfPeriod>[0], now, zone)
    return fieldType === 'DATE' ? ymd : new Date(startOfDayMs(ymd, zone)).toISOString()
  }
  return String(value)
}

function matches(person: (typeof PEOPLE)[number], criterion: Criterion, zone: string): boolean {
  if (criterion.fieldName !== 'createdAt' && criterion.fieldName !== 'dueDate') return true
  const type = criterion.fieldName === 'dueDate' ? 'DATE' : 'DATE_TIME'
  const actual = String(person[criterion.fieldName as 'createdAt' | 'dueDate'])
  const compare = (a: string, b: string) => (type === 'DATE' ? a.localeCompare(b) : Date.parse(a) - Date.parse(b))
  const [v0, v1] = criterion.values.map((v) => resolve(v, type, zone))
  switch (criterion.operator) {
    case 'EQUALS': return compare(actual, v0) === 0
    case 'GREATER_THAN': return compare(actual, v0) > 0
    case 'GREATER_THAN_OR_EQUALS': return compare(actual, v0) >= 0
    case 'LESS_THAN': return compare(actual, v0) < 0
    case 'LESS_THAN_OR_EQUALS': return compare(actual, v0) <= 0
    case 'BETWEEN': return compare(actual, v0) >= 0 && compare(actual, v1) <= 0
    default: return true
  }
}

/** Replaces the person fixtures with ones that have DATE_TIME and DATE fields, and a query that applies the filter. */
export async function setupDateMocks(page: Page): Promise<{ queries: Criterion[][]; headers: string[] }> {
  await setupApiMocks(page)
  const person = METADATA.tables.person
  const fields = {
    ...person.fields,
    createdAt: { name: 'createdAt', label: 'Created', type: 'DATE_TIME', isEditable: false, isRequired: false, isHeavy: false, isHidden: false, adornments: [] },
    dueDate: { name: 'dueDate', label: 'Due', type: 'DATE', isEditable: true, isRequired: false, isHeavy: false, isHidden: false, adornments: [] },
  }
  const sections = [{ ...person.sections[0], fieldNames: [...person.sections[0].fieldNames, 'createdAt', 'dueDate'] }]
  const metaData = { ...METADATA, tables: { person: { ...person, fields, sections } } }
  await page.route('**/qqq/v1/metaData**', (route) => {
    if (!/\/qqq\/v1\/metaData\/?(\?|$)/.test(route.request().url())) return route.fallback()
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(metaData) })
  })

  await page.route('**/qqq/v1/metaData/table/person**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(metaData.tables.person) }))

  const seen = { queries: [] as Criterion[][], headers: [] as string[] }
  const records = (list: typeof PEOPLE) => list.map((p) => ({
    tableName: 'person', recordLabel: p.firstName, values: { ...p, lastName: 'X', email: `${p.id}@example.com`, status: 'Active' }, displayValues: {},
  }))
  const filtered = (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { filter?: { criteria?: Criterion[] } }
    const criteria = body.filter?.criteria ?? []
    const zone = route.request().headers()['x-qqq-usertimezone'] ?? 'UTC'
    seen.queries.push(criteria)
    seen.headers.push(zone)
    return PEOPLE.filter((p) => criteria.every((c) => matches(p, c, zone)))
  }
  await page.route('**/qqq/v1/table/person/count**', (route) => {
    const list = filtered(route)
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ count: list.length, distinctCount: list.length }) })
  })
  await page.route('**/qqq/v1/table/person/query**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ records: records(filtered(route)) }) }))
  return seen
}

