// Playwright route-interception mocks for /qqq/v1/* endpoints.
// Used instead of MSW browser mocks — more reliable and server-config-independent.
//
// IMPORTANT: Playwright applies routes in REVERSE registration order (last = highest priority).
// Register GENERIC routes first, SPECIFIC routes last.

import type { Page } from '@playwright/test'

// ─── Minimal fixtures ─────────────────────────────────────────────────────────

const AUTH_META = { name: 'mockAuth', type: 'FULLY_ANONYMOUS', values: {} }

const SESSION = { uuid: 'mock-session-uuid-e2e', values: {} }

// Minimal QInstance — just enough for the app to render
const METADATA = {
  apps: {
    crm: {
      name: 'crm',
      label: 'CRM',
      iconName: 'people_alt',
      widgets: [],
      children: [
        { name: 'person', label: 'People', type: 'TABLE', iconName: 'person' },
      ],
      sections: [
        {
          name: 'contacts',
          label: 'Contacts',
          icon: { name: 'contacts' },
          tables: ['person'],
          processes: [],
          reports: [],
        },
      ],
    },
  },
  appTree: [
    {
      name: 'crm',
      label: 'CRM',
      type: 'APP',
      iconName: 'people_alt',
      children: [{ name: 'person', label: 'People', type: 'TABLE', iconName: 'person' }],
    },
  ],
  tables: {
    person: {
      name: 'person',
      label: 'People',
      isHidden: false,
      primaryKeyField: 'id',
      fields: {
        id: { name: 'id', label: 'ID', type: 'INTEGER', isEditable: false, isRequired: false, isHeavy: false, isHidden: false, adornments: [] },
        firstName: { name: 'firstName', label: 'First Name', type: 'STRING', isEditable: true, isRequired: true, isHeavy: false, isHidden: false, adornments: [], maxLength: 100 },
        lastName: { name: 'lastName', label: 'Last Name', type: 'STRING', isEditable: true, isRequired: true, isHeavy: false, isHidden: false, adornments: [], maxLength: 100 },
        email: { name: 'email', label: 'Email', type: 'STRING', isEditable: true, isRequired: false, isHeavy: false, isHidden: false, adornments: [], maxLength: 255 },
        status: { name: 'status', label: 'Status', type: 'STRING', isEditable: true, isRequired: true, isHeavy: false, isHidden: false, adornments: [{ type: 'CHIP' }] },
      },
      sections: [
        {
          name: 'identity',
          label: 'Identity',
          tier: 'T1',
          iconName: 'person',
          fieldNames: ['firstName', 'lastName', 'email', 'status'],
          isHidden: false,
          gridColumns: 2,
        },
      ],
      exposedJoins: [],
      capabilities: ['TABLE_QUERY', 'TABLE_GET', 'TABLE_COUNT', 'TABLE_INSERT', 'TABLE_UPDATE', 'TABLE_DELETE'],
      readPermission: true,
      insertPermission: true,
      editPermission: true,
      deletePermission: true,
      usesVariants: false,
      variantTableLabel: '',
    },
  },
  processes: {},
  reports: {},
  widgets: {},
  branding: {
    companyName: 'Test',
    appName: 'QQQ Test',
    logo: null,
    icon: null,
    accentColor: '#6366f1',
    banners: {},
  },
  helpContents: {},
  environmentValues: {},
}

const PERSON_RECORDS = [
  {
    tableName: 'person', recordLabel: 'Alice Johnson',
    values: { id: 1, firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com', status: 'Active' },
    displayValues: { id: '1' },
  },
  {
    tableName: 'person', recordLabel: 'Bob Martinez',
    values: { id: 2, firstName: 'Bob', lastName: 'Martinez', email: 'bob@example.com', status: 'Active' },
    displayValues: { id: '2' },
  },
  {
    tableName: 'person', recordLabel: 'Carol Williams',
    values: { id: 3, firstName: 'Carol', lastName: 'Williams', email: 'carol@example.com', status: 'Lead' },
    displayValues: { id: '3' },
  },
]

const PERSON_RECORD_1 = PERSON_RECORDS[0]

// ─── Route setup ──────────────────────────────────────────────────────────────

/**
 * Set up Playwright route interception to mock all /qqq/v1/* API calls.
 * Call this BEFORE page.goto() in each test's beforeEach.
 *
 * Routes are registered from LEAST specific to MOST specific.
 * Playwright checks routes in reverse registration order (last registered = first checked).
 */
export async function setupApiMocks(page: Page): Promise<void> {
  // ── GENERIC routes (registered first = lowest priority) ──────────────────

  // Global search
  await page.route('**/qqq/v1/globalSearch**', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  })

  // Possible values
  await page.route('**/qqq/v1/possibleValues**', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ records: [] }) })
  })

  // Audits
  await page.route('**/qqq/v1/table/*/*/audits**', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ records: [] }) })
  })

  // Person table — generic catch-all for remaining person requests
  await page.route('**/qqq/v1/table/person**', (route) => {
    const method = route.request().method()
    if (method === 'POST') {
      // Insert
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ...PERSON_RECORD_1, values: { ...PERSON_RECORD_1.values, id: 999 } }),
      })
      return
    }
    // PUT/DELETE fall through to continue
    route.continue()
  })

  // Full metadata (with optional query params like ?frontendName=...)
  await page.route('**/qqq/v1/metaData**', (route) => {
    // Default: return full QInstance
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(METADATA) })
  })

  // Logout
  await page.route('**/qqq/v1/logout**', (route) => {
    route.fulfill({ status: 200 })
  })

  // ── SPECIFIC routes (registered last = highest priority, checked first) ────

  // Person count (must be before generic table/person handler)
  await page.route('**/qqq/v1/table/person/count**', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ count: PERSON_RECORDS.length, distinctCount: PERSON_RECORDS.length }),
    })
  })

  // Person query (must be before generic table/person handler)
  await page.route('**/qqq/v1/table/person/query**', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ records: PERSON_RECORDS }),
    })
  })

  // Person record 99999 → 404 (must be before general person/:id handler)
  await page.route('**/qqq/v1/table/person/99999**', (route) => {
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: "Record '99999' not found in table 'person'" }),
    })
  })

  // Person record by ID (e.g. /table/person/1, /table/person/2)
  await page.route('**/qqq/v1/table/person/*', (route) => {
    const url = route.request().url()
    const idMatch = /\/table\/person\/(\d+)/.exec(url)
    if (idMatch) {
      const id = parseInt(idMatch[1], 10)
      const record = PERSON_RECORDS.find((r) => r.values.id === id)
      if (record) {
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(record) })
      } else {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: `Record '${id}' not found` }),
        })
      }
      return
    }
    route.continue()
  })

  // Per-table metadata (must be before generic /metaData** handler)
  await page.route('**/qqq/v1/metaData/table/**', (route) => {
    const url = route.request().url()
    const tableMatch = /\/metaData\/table\/([^/?]+)/.exec(url)
    if (tableMatch) {
      const tableName = tableMatch[1]
      const table = (METADATA.tables as Record<string, unknown>)[tableName]
      if (table) {
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(table) })
      } else {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: `Table '${tableName}' not found` }),
        })
      }
    } else {
      route.continue()
    }
  })

  // Auth metadata (MOST specific — must be highest priority / last registered)
  await page.route('**/qqq/v1/metaData/authentication**', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(AUTH_META) })
  })

  // Manage session (high priority)
  await page.route('**/qqq/v1/manageSession**', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSION) })
  })
}
